import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';
import { NotificationType, NotificationPreferenceUpdateInput } from '@saga/shared';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get all notifications for current user
  fastify.get<{
    Querystring: { unreadOnly?: string; limit?: string; offset?: string };
  }>(
    '/',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;
      const unreadOnly = request.query.unreadOnly === 'true';
      const limit = parseInt(request.query.limit || '50', 10);
      const offset = parseInt(request.query.offset || '0', 10);

      const where = {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      };

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, read: false } }),
      ]);

      return {
        data: notifications,
        total,
        unreadCount,
        limit,
        offset,
      };
    }
  );

  // Get unread count
  fastify.get(
    '/unread-count',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;
      const count = await prisma.notification.count({
        where: { userId, read: false },
      });
      return { count };
    }
  );

  // Mark notification as read
  fastify.patch<{ Params: { id: string } }>(
    '/:id/read',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user!.id;
      const { id } = request.params;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return reply.status(404).send({ error: 'Notifikation hittades inte' });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { read: true, readAt: new Date() },
      });

      return updated;
    }
  );

  // Mark all notifications as read
  fastify.patch(
    '/read-all',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;

      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      });

      return { success: true };
    }
  );

  // Delete a notification
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user!.id;
      const { id } = request.params;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return reply.status(404).send({ error: 'Notifikation hittades inte' });
      }

      await prisma.notification.delete({ where: { id } });

      return { success: true };
    }
  );

  // Delete all read notifications
  fastify.delete(
    '/read',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;

      await prisma.notification.deleteMany({
        where: { userId, read: true },
      });

      return { success: true };
    }
  );

  // Get notification preferences
  fastify.get(
    '/preferences',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;

      let preferences = await prisma.notificationPreference.findUnique({
        where: { userId },
      });

      // Create default preferences if not exists
      if (!preferences) {
        preferences = await prisma.notificationPreference.create({
          data: { userId },
        });
      }

      return preferences;
    }
  );

  // Update notification preferences
  fastify.patch<{ Body: NotificationPreferenceUpdateInput }>(
    '/preferences',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;
      const data = request.body;

      // Ensure preferences exist
      let preferences = await prisma.notificationPreference.findUnique({
        where: { userId },
      });

      if (!preferences) {
        preferences = await prisma.notificationPreference.create({
          data: { userId, ...data },
        });
      } else {
        preferences = await prisma.notificationPreference.update({
          where: { userId },
          data,
        });
      }

      return preferences;
    }
  );
}

// ============================================
// NOTIFICATION CREATION HELPERS
// ============================================

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link,
    },
  });
}

export async function createNotificationsForSupervisorSignature(
  traineeUserId: string,
  supervisorName: string,
  entityType: 'assessment' | 'subgoal' | 'supervision',
  entityTitle: string
) {
  const typeMap = {
    assessment: NotificationType.ASSESSMENT_SIGNED,
    subgoal: NotificationType.SUBGOAL_SIGNED,
    supervision: NotificationType.GENERAL,
  };

  const titleMap = {
    assessment: 'Bedömning signerad',
    subgoal: 'Delmål signerat',
    supervision: 'Handledarsamtal signerat',
  };

  return createNotification(
    traineeUserId,
    typeMap[entityType],
    titleMap[entityType],
    `${supervisorName} har signerat ${entityTitle}`,
    entityType === 'assessment' ? '/assessments' :
    entityType === 'subgoal' ? '/subgoals' : '/supervision'
  );
}

export async function notifyUnsignedAssessment(
  supervisorUserId: string,
  traineeName: string,
  assessmentType: string
) {
  return createNotification(
    supervisorUserId,
    NotificationType.UNSIGNED_ASSESSMENT,
    'Osignerad bedömning',
    `${traineeName} har en ${assessmentType}-bedömning som väntar på din signatur`,
    '/assessments'
  );
}

export async function notifySupervisionReminder(
  traineeUserId: string,
  daysSinceLast: number
) {
  return createNotification(
    traineeUserId,
    NotificationType.SUPERVISION_REMINDER,
    'Påminnelse om handledning',
    `Det har gått ${daysSinceLast} dagar sedan ditt senaste handledarsamtal. Boka ett nytt möte!`,
    '/supervision'
  );
}

export async function notifyRotationStarting(
  traineeUserId: string,
  unit: string,
  daysUntil: number
) {
  return createNotification(
    traineeUserId,
    NotificationType.ROTATION_STARTING,
    'Placering startar snart',
    `Din placering på ${unit} startar om ${daysUntil} dagar`,
    '/calendar'
  );
}

export async function notifyRotationEnding(
  traineeUserId: string,
  unit: string,
  daysUntil: number
) {
  return createNotification(
    traineeUserId,
    NotificationType.ROTATION_ENDING,
    'Placering slutar snart',
    `Din placering på ${unit} slutar om ${daysUntil} dagar`,
    '/calendar'
  );
}

export async function notifyDeadlineReminder(
  traineeUserId: string,
  daysUntil: number
) {
  return createNotification(
    traineeUserId,
    NotificationType.DEADLINE_REMINDER,
    'Påminnelse om slutdatum',
    `Ditt planerade slutdatum för utbildningen är om ${daysUntil} dagar`,
    '/dashboard'
  );
}
