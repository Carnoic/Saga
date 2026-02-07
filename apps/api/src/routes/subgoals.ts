import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee, canWriteTrainee, requireRole } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole, SubGoalStatus } from '@saga/shared';
import { createNotificationsForSupervisorSignature } from './notifications.js';

const updateProgressSchema = z.object({
  status: z.enum(['EJ_PABORJAD', 'PAGAENDE', 'UPPNADD']),
  notes: z.string().optional(),
});

export async function subGoalRoutes(fastify: FastifyInstance) {
  // Get all goal specs
  fastify.get('/specs', {
    schema: {
      tags: ['SubGoals'],
      summary: 'Hämta målbeskrivningar',
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const specs = await prisma.goalSpec.findMany({
      include: {
        _count: { select: { subGoals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { specs };
  });

  // Get subgoals for a goal spec
  fastify.get('/specs/:specId/subgoals', {
    schema: {
      tags: ['SubGoals'],
      summary: 'Hämta delmål för målbeskrivning',
      params: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { specId } = request.params as { specId: string };

    const subGoals = await prisma.subGoal.findMany({
      where: { goalSpecId: specId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    return { subGoals };
  });

  // Get trainee's subgoal progress
  fastify.get('/progress', {
    schema: {
      tags: ['SubGoals'],
      summary: 'Hämta delmålsprogression',
      querystring: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['EJ_PABORJAD', 'PAGAENDE', 'UPPNADD'] },
          category: { type: 'string' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId, status, category } = request.query as {
      traineeProfileId: string;
      status?: SubGoalStatus;
      category?: string;
    };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const where: Record<string, unknown> = { traineeProfileId };
    if (status) where.status = status;
    if (category) where.subGoal = { category };

    const progress = await prisma.traineeSubGoalProgress.findMany({
      where,
      include: {
        subGoal: true,
        signedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ subGoal: { category: 'asc' } }, { subGoal: { sortOrder: 'asc' } }],
    });

    // Get evidence for each subgoal
    const progressWithEvidence = await Promise.all(
      progress.map(async (p) => {
        const [rotations, courses, assessments, certificates] = await Promise.all([
          prisma.rotationSubGoal.findMany({
            where: {
              subGoalId: p.subGoalId,
              rotation: { traineeProfileId },
            },
            include: { rotation: true },
          }),
          prisma.courseSubGoal.findMany({
            where: {
              subGoalId: p.subGoalId,
              course: { traineeProfileId },
            },
            include: { course: true },
          }),
          prisma.assessmentSubGoal.findMany({
            where: {
              subGoalId: p.subGoalId,
              assessment: { traineeProfileId },
            },
            include: { assessment: true },
          }),
          prisma.certificateSubGoal.findMany({
            where: {
              subGoalId: p.subGoalId,
              certificate: { traineeProfileId },
            },
            include: { certificate: true },
          }),
        ]);

        return {
          ...p,
          evidence: {
            rotations: rotations.map((r) => r.rotation),
            courses: courses.map((c) => c.course),
            assessments: assessments.map((a) => a.assessment),
            certificates: certificates.map((c) => c.certificate),
          },
        };
      })
    );

    return { progress: progressWithEvidence };
  });

  // Update subgoal progress
  fastify.patch('/progress/:id', {
    schema: {
      tags: ['SubGoals'],
      summary: 'Uppdatera delmålsstatus',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['EJ_PABORJAD', 'PAGAENDE', 'UPPNADD'] },
          notes: { type: 'string' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const parsed = updateProgressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldProgress = await prisma.traineeSubGoalProgress.findUnique({
      where: { id },
      include: { subGoal: true },
    });

    if (!oldProgress) {
      return reply.status(404).send({ error: 'Delmålsprogression hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, oldProgress.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    // If setting to UPPNADD and signed by supervisor, lock it
    const progress = await prisma.traineeSubGoalProgress.update({
      where: { id },
      data: parsed.data,
      include: {
        subGoal: true,
        signedBy: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'TraineeSubGoalProgress',
      entityId: id,
      oldValue: { status: oldProgress.status },
      newValue: parsed.data,
    }, request);

    return { progress };
  });

  // Sign subgoal as completed (supervisor)
  fastify.post('/progress/:id/sign', {
    schema: {
      tags: ['SubGoals'],
      summary: 'Signera delmål som uppnått',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    if (user.role !== UserRole.HANDLEDARE && user.role !== UserRole.STUDIEREKTOR && user.role !== UserRole.ADMIN) {
      return reply.status(403).send({ error: 'Endast handledare/studierektor kan signera' });
    }

    const progressItem = await prisma.traineeSubGoalProgress.findUnique({
      where: { id },
    });

    if (!progressItem) {
      return reply.status(404).send({ error: 'Delmålsprogression hittades inte' });
    }

    if (progressItem.signedAt) {
      return reply.status(400).send({ error: 'Delmålet är redan signerat' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, progressItem.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const progress = await prisma.traineeSubGoalProgress.update({
      where: { id },
      data: {
        status: 'UPPNADD',
        signedById: user.id,
        signedAt: new Date(),
      },
      include: {
        subGoal: true,
        signedBy: { select: { id: true, name: true } },
        traineeProfile: { include: { user: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'SIGN',
      entityType: 'TraineeSubGoalProgress',
      entityId: id,
      newValue: { signedAt: progress.signedAt?.toISOString(), signedBy: user.name },
    }, request);

    // Create notification for trainee
    await createNotificationsForSupervisorSignature(
      progress.traineeProfile.userId,
      user.name,
      'subgoal',
      `delmål ${progress.subGoal.code}: ${progress.subGoal.title}`
    );

    return { progress };
  });

  // Get summary statistics for a trainee
  fastify.get('/summary', {
    schema: {
      tags: ['SubGoals'],
      summary: 'Hämta progressionssammanfattning',
      querystring: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId } = request.query as { traineeProfileId: string };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const [total, completed, inProgress, notStarted] = await Promise.all([
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId } }),
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId, status: 'UPPNADD' } }),
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId, status: 'PAGAENDE' } }),
      prisma.traineeSubGoalProgress.count({ where: { traineeProfileId, status: 'EJ_PABORJAD' } }),
    ]);

    // By category
    const byCategory = await prisma.traineeSubGoalProgress.groupBy({
      by: ['status'],
      where: { traineeProfileId },
      _count: true,
    });

    const categoryProgress = await prisma.$queryRaw`
      SELECT sg.category,
             COUNT(*) as total,
             SUM(CASE WHEN tsp.status = 'UPPNADD' THEN 1 ELSE 0 END) as completed
      FROM TraineeSubGoalProgress tsp
      JOIN SubGoal sg ON tsp.subGoalId = sg.id
      WHERE tsp.traineeProfileId = ${traineeProfileId}
      GROUP BY sg.category
    `;

    return {
      summary: {
        total,
        completed,
        inProgress,
        notStarted,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      byCategory: categoryProgress,
    };
  });
}
