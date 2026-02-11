import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { authenticate, requireRole, canAccessTrainee } from '../lib/auth.js';
import { UserRole, RiskLevel, daysBetween } from '@saga/shared';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get trainee dashboard
  fastify.get('/trainee', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Hämta ST/BT-läkarens översikt',
      querystring: {
        type: 'object',
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId: queryProfileId } = request.query as { traineeProfileId?: string };
    const user = request.user!;

    // Get trainee profile
    let profileId = queryProfileId;
    if (!profileId && user.role === UserRole.ST_BT) {
      const profile = await prisma.traineeProfile.findUnique({
        where: { userId: user.id },
      });
      profileId = profile?.id;
    }

    if (!profileId) {
      return reply.status(400).send({ error: 'Ingen ST/BT-profil angiven' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, profileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const profile = await prisma.traineeProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        clinic: true,
        supervisor: { select: { id: true, name: true } },
      },
    });

    if (!profile) {
      return reply.status(404).send({ error: 'Profil hittades inte' });
    }

    // Get progress summary
    const [total, completed, inProgress] = await Promise.all([
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: profileId } }),
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: profileId, status: 'UPPNADD' } }),
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: profileId, status: 'PAGAENDE' } }),
    ]);

    // Get recent and upcoming rotations
    const now = new Date();
    const [recentRotations, upcomingRotations] = await Promise.all([
      prisma.rotation.findMany({
        where: { traineeProfileId: profileId, endDate: { lt: now }, planned: false },
        orderBy: { endDate: 'desc' },
        take: 3,
      }),
      prisma.rotation.findMany({
        where: { traineeProfileId: profileId, startDate: { gt: now } },
        orderBy: { startDate: 'asc' },
        take: 3,
      }),
    ]);

    // Current rotation
    const currentRotation = await prisma.rotation.findFirst({
      where: {
        traineeProfileId: profileId,
        startDate: { lte: now },
        endDate: { gte: now },
        planned: false,
      },
    });

    // Get recent assessments
    const recentAssessments = await prisma.assessment.findMany({
      where: { traineeProfileId: profileId },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        assessor: { select: { name: true } },
      },
    });

    // Get unsigned assessments count (exclude voided)
    const unsignedAssessments = await prisma.assessment.count({
      where: { traineeProfileId: profileId, signedAt: null, voidedAt: null },
    });

    // Get last supervision meeting
    const lastSupervision = await prisma.supervisionMeeting.findFirst({
      where: { traineeProfileId: profileId },
      orderBy: { date: 'desc' },
      include: {
        supervisor: { select: { name: true } },
      },
    });

    // Get certificates count
    const certificatesCount = await prisma.certificate.count({
      where: { traineeProfileId: profileId },
    });

    // Calculate warnings
    const warnings: Array<{ type: string; message: string; severity: RiskLevel }> = [];

    // Check for old supervision
    if (lastSupervision) {
      const daysSince = daysBetween(lastSupervision.date, now);
      if (daysSince > 90) {
        warnings.push({
          type: 'OLD_SUPERVISION',
          message: `Senaste handledarsamtalet var för ${daysSince} dagar sedan`,
          severity: daysSince > 180 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        });
      }
    } else {
      warnings.push({
        type: 'OLD_SUPERVISION',
        message: 'Inget handledarsamtal registrerat',
        severity: RiskLevel.HIGH,
      });
    }

    // Check for unsigned assessments
    if (unsignedAssessments > 0) {
      warnings.push({
        type: 'UNSIGNED_ASSESSMENT',
        message: `${unsignedAssessments} osignerad(e) bedömning(ar)`,
        severity: unsignedAssessments > 5 ? RiskLevel.MEDIUM : RiskLevel.LOW,
      });
    }

    // Check for ending rotation soon
    if (currentRotation) {
      const daysUntilEnd = daysBetween(now, currentRotation.endDate);
      if (daysUntilEnd <= 14 && daysUntilEnd > 0) {
        warnings.push({
          type: 'ENDING_ROTATION',
          message: `Nuvarande placering slutar om ${daysUntilEnd} dagar`,
          severity: RiskLevel.LOW,
        });
      }
    }

    return {
      dashboard: {
        profile,
        progress: {
          total,
          completed,
          inProgress,
          notStarted: total - completed - inProgress,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
        currentRotation,
        recentRotations,
        upcomingRotations,
        recentAssessments,
        unsignedAssessments,
        lastSupervision,
        daysSinceLastSupervision: lastSupervision ? daysBetween(lastSupervision.date, now) : null,
        certificatesCount,
        warnings,
      },
    };
  });

  // Get study director overview
  fastify.get('/studierektor', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Hämta studierektorns översikt',
      querystring: {
        type: 'object',
        properties: {
          clinicId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: requireRole(UserRole.STUDIEREKTOR, UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId: queryClinicId } = request.query as { clinicId?: string };
    const user = request.user!;

    const clinicId = queryClinicId || user.clinicId;

    if (!clinicId) {
      return reply.status(400).send({ error: 'Ingen klinik angiven' });
    }

    // Get all trainees in the clinic
    const trainees = await prisma.traineeProfile.findMany({
      where: { clinicId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true } },
      },
    });

    const now = new Date();

    // Get detailed info for each trainee
    const traineeOverviews = await Promise.all(
      trainees.map(async (trainee) => {
        // Progress
        const [total, completed] = await Promise.all([
          prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: trainee.id } }),
          prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: trainee.id, status: 'UPPNADD' } }),
        ]);

        // Last supervision
        const lastSupervision = await prisma.supervisionMeeting.findFirst({
          where: { traineeProfileId: trainee.id },
          orderBy: { date: 'desc' },
        });

        // Unsigned assessments (exclude voided)
        const unsignedAssessments = await prisma.assessment.count({
          where: { traineeProfileId: trainee.id, signedAt: null, voidedAt: null },
        });

        // Calculate risk level
        let riskLevel = RiskLevel.NONE;
        const daysSinceSupervision = lastSupervision
          ? daysBetween(lastSupervision.date, now)
          : 999;

        if (daysSinceSupervision > 180 || unsignedAssessments > 10) {
          riskLevel = RiskLevel.HIGH;
        } else if (daysSinceSupervision > 90 || unsignedAssessments > 5) {
          riskLevel = RiskLevel.MEDIUM;
        } else if (daysSinceSupervision > 60 || unsignedAssessments > 2) {
          riskLevel = RiskLevel.LOW;
        }

        return {
          traineeId: trainee.id,
          traineeName: trainee.user.name,
          traineeEmail: trainee.user.email,
          trackType: trainee.trackType,
          specialty: trainee.specialty,
          supervisor: trainee.supervisor,
          startDate: trainee.startDate,
          plannedEndDate: trainee.plannedEndDate,
          progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          completedSubGoals: completed,
          totalSubGoals: total,
          lastSupervisionDate: lastSupervision?.date,
          daysSinceSupervision,
          unsignedAssessments,
          riskLevel,
        };
      })
    );

    // Sort by risk level (highest first)
    const riskOrder = { [RiskLevel.HIGH]: 0, [RiskLevel.MEDIUM]: 1, [RiskLevel.LOW]: 2, [RiskLevel.NONE]: 3 };
    traineeOverviews.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    // Summary stats
    const summary = {
      totalTrainees: trainees.length,
      highRisk: traineeOverviews.filter((t) => t.riskLevel === RiskLevel.HIGH).length,
      mediumRisk: traineeOverviews.filter((t) => t.riskLevel === RiskLevel.MEDIUM).length,
      averageProgress: trainees.length > 0
        ? Math.round(traineeOverviews.reduce((sum, t) => sum + t.progressPercentage, 0) / trainees.length)
        : 0,
    };

    return {
      overview: {
        clinicId,
        summary,
        trainees: traineeOverviews,
      },
    };
  });

  // Get supervisor's assigned trainees
  fastify.get('/handledare', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Hämta handledarens tilldelade ST/BT',
    },
    preHandler: requireRole(UserRole.HANDLEDARE, UserRole.STUDIEREKTOR, UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const trainees = await prisma.traineeProfile.findMany({
      where: { supervisorId: user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        clinic: { select: { name: true } },
      },
    });

    const now = new Date();

    const traineeOverviews = await Promise.all(
      trainees.map(async (trainee) => {
        const [total, completed] = await Promise.all([
          prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: trainee.id } }),
          prisma.traineeSubGoalProgress.count({ where: { traineeProfileId: trainee.id, status: 'UPPNADD' } }),
        ]);

        const lastSupervision = await prisma.supervisionMeeting.findFirst({
          where: { traineeProfileId: trainee.id },
          orderBy: { date: 'desc' },
        });

        const unsignedAssessments = await prisma.assessment.count({
          where: { traineeProfileId: trainee.id, signedAt: null, voidedAt: null },
        });

        return {
          traineeId: trainee.id,
          traineeName: trainee.user.name,
          trackType: trainee.trackType,
          specialty: trainee.specialty,
          progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          lastSupervisionDate: lastSupervision?.date,
          daysSinceSupervision: lastSupervision ? daysBetween(lastSupervision.date, now) : null,
          unsignedAssessments,
        };
      })
    );

    return { trainees: traineeOverviews };
  });
}
