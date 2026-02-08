import { prisma } from './db.js';
import { NotificationType } from '@saga/shared';
import {
  createNotification,
  notifySupervisionReminder,
  notifyRotationStarting,
  notifyRotationEnding,
  notifyDeadlineReminder,
  notifyUnsignedAssessment,
} from '../routes/notifications.js';

// Default reminder intervals
const SUPERVISION_REMINDER_DAYS = 90; // Remind if no supervision in 90 days
const ROTATION_REMINDER_DAYS = 7; // Remind 7 days before rotation starts/ends
const DEADLINE_REMINDER_DAYS = 30; // Remind 30 days before training end date

/**
 * Check for trainees who haven't had a supervision meeting in a while
 */
export async function checkSupervisionReminders() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SUPERVISION_REMINDER_DAYS);

  const trainees = await prisma.traineeProfile.findMany({
    include: {
      user: true,
      supervisionMeetings: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  for (const trainee of trainees) {
    const lastMeeting = trainee.supervisionMeetings[0];
    const lastMeetingDate = lastMeeting?.date;

    // Check if should send reminder
    const shouldRemind = !lastMeetingDate || new Date(lastMeetingDate) < cutoffDate;

    if (shouldRemind) {
      // Check preferences
      const prefs = await prisma.notificationPreference.findUnique({
        where: { userId: trainee.userId },
      });

      if (!prefs || prefs.supervisionReminders) {
        // Check if we already sent a reminder recently (within 7 days)
        const recentReminder = await prisma.notification.findFirst({
          where: {
            userId: trainee.userId,
            type: NotificationType.SUPERVISION_REMINDER,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        });

        if (!recentReminder) {
          const daysSinceLast = lastMeetingDate
            ? Math.floor((Date.now() - new Date(lastMeetingDate).getTime()) / (24 * 60 * 60 * 1000))
            : SUPERVISION_REMINDER_DAYS;

          await notifySupervisionReminder(trainee.userId, daysSinceLast);
        }
      }
    }
  }
}

/**
 * Check for upcoming rotations and send reminders
 */
export async function checkRotationReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminderDate = new Date(today);
  reminderDate.setDate(reminderDate.getDate() + ROTATION_REMINDER_DAYS);

  // Find rotations starting in the reminder window
  const startingRotations = await prisma.rotation.findMany({
    where: {
      startDate: {
        gte: today,
        lte: reminderDate,
      },
    },
    include: {
      traineeProfile: {
        include: { user: true },
      },
    },
  });

  for (const rotation of startingRotations) {
    const trainee = rotation.traineeProfile;
    const daysUntil = Math.ceil(
      (new Date(rotation.startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Check if already notified
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: trainee.userId,
        type: NotificationType.ROTATION_STARTING,
        message: { contains: rotation.unit },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (!existingNotification) {
      await notifyRotationStarting(trainee.userId, rotation.unit, daysUntil);
    }
  }

  // Find rotations ending in the reminder window
  const endingRotations = await prisma.rotation.findMany({
    where: {
      endDate: {
        gte: today,
        lte: reminderDate,
      },
    },
    include: {
      traineeProfile: {
        include: { user: true },
      },
    },
  });

  for (const rotation of endingRotations) {
    const trainee = rotation.traineeProfile;
    const daysUntil = Math.ceil(
      (new Date(rotation.endDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Check if already notified
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: trainee.userId,
        type: NotificationType.ROTATION_ENDING,
        message: { contains: rotation.unit },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (!existingNotification) {
      await notifyRotationEnding(trainee.userId, rotation.unit, daysUntil);
    }
  }
}

/**
 * Check for trainees approaching their planned end date
 */
export async function checkDeadlineReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trainees = await prisma.traineeProfile.findMany({
    include: { user: true },
  });

  for (const trainee of trainees) {
    const endDate = new Date(trainee.plannedEndDate);
    const daysUntil = Math.ceil(
      (endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Check preferences
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: trainee.userId },
    });

    const reminderDays = prefs?.daysBeforeDeadline ?? DEADLINE_REMINDER_DAYS;

    if (daysUntil > 0 && daysUntil <= reminderDays) {
      if (!prefs || prefs.deadlineReminders) {
        // Check if already notified recently
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: trainee.userId,
            type: NotificationType.DEADLINE_REMINDER,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        });

        if (!existingNotification) {
          await notifyDeadlineReminder(trainee.userId, daysUntil);
        }
      }
    }
  }
}

/**
 * Check for unsigned assessments and notify supervisors
 */
export async function checkUnsignedAssessments() {
  const unsignedAssessments = await prisma.assessment.findMany({
    where: {
      signedAt: null,
      assessorId: { not: null },
    },
    include: {
      traineeProfile: {
        include: { user: true },
      },
      assessor: true,
    },
  });

  // Group by assessor
  const byAssessor = new Map<string, typeof unsignedAssessments>();
  for (const assessment of unsignedAssessments) {
    if (!assessment.assessorId || !assessment.assessor) continue;
    const existing = byAssessor.get(assessment.assessorId) || [];
    existing.push(assessment);
    byAssessor.set(assessment.assessorId, existing);
  }

  for (const [assessorId, assessments] of byAssessor) {
    // Check preferences
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: assessorId },
    });

    if (!prefs || prefs.unsignedAssessments) {
      // Check if already notified recently
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: assessorId,
          type: NotificationType.UNSIGNED_ASSESSMENT,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Daily reminder max
        },
      });

      if (!existingNotification && assessments.length > 0) {
        const firstAssessment = assessments[0];
        const message = assessments.length === 1
          ? `${firstAssessment.traineeProfile.user.name} har en ${firstAssessment.type}-bedömning som väntar på din signatur`
          : `Du har ${assessments.length} osignerade bedömningar som väntar`;

        await createNotification(
          assessorId,
          NotificationType.UNSIGNED_ASSESSMENT,
          'Osignerade bedömningar',
          message,
          '/assessments'
        );
      }
    }
  }
}

/**
 * Run all notification checks
 */
export async function runNotificationChecks() {
  console.log('[Notifications] Running scheduled notification checks...');

  try {
    await checkSupervisionReminders();
    await checkRotationReminders();
    await checkDeadlineReminders();
    await checkUnsignedAssessments();

    console.log('[Notifications] Completed notification checks');
  } catch (error) {
    console.error('[Notifications] Error running notification checks:', error);
  }
}

/**
 * Start periodic notification checks
 * @param intervalMinutes - How often to run checks (default: 60 minutes)
 */
export function startNotificationScheduler(intervalMinutes = 60) {
  // Run immediately on startup
  runNotificationChecks();

  // Then run periodically
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(runNotificationChecks, intervalMs);

  console.log(`[Notifications] Scheduler started, running every ${intervalMinutes} minutes`);
}
