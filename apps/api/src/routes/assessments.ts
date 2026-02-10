import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee, canWriteTrainee } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole, AssessmentType, ASSESSMENT_TYPE_LABELS, NotificationType } from '@saga/shared';
import { createNotificationsForSupervisorSignature } from './notifications.js';

const createAssessmentSchema = z.object({
  traineeProfileId: z.string().uuid(),
  type: z.enum(['DOPS', 'MINI_CEX', 'CBD', 'ANNAT']),
  date: z.string().transform((s) => new Date(s)),
  context: z.string().optional(),
  assessorId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  narrativeFeedback: z.string().optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

const updateAssessmentSchema = z.object({
  type: z.enum(['DOPS', 'MINI_CEX', 'CBD', 'ANNAT']).optional(),
  date: z.string().transform((s) => new Date(s)).optional(),
  context: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  narrativeFeedback: z.string().optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

export async function assessmentRoutes(fastify: FastifyInstance) {
  // Get assessments for a trainee
  fastify.get('/', {
    schema: {
      tags: ['Assessments'],
      summary: 'Hämta bedömningar',
      querystring: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['DOPS', 'MINI_CEX', 'CBD', 'ANNAT'] },
          signed: { type: 'boolean' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId, type, signed } = request.query as {
      traineeProfileId: string;
      type?: AssessmentType;
      signed?: boolean;
    };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const where: Record<string, unknown> = { traineeProfileId };
    if (type) where.type = type;
    if (signed !== undefined) {
      where.signedAt = signed ? { not: null } : null;
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        assessor: { select: { id: true, name: true } },
        assessmentSubGoals: {
          include: { subGoal: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return { assessments };
  });

  // Get single assessment
  fastify.get('/:id', {
    schema: {
      tags: ['Assessments'],
      summary: 'Hämta bedömning',
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

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        assessor: { select: { id: true, name: true, email: true } },
        assessmentSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    if (!assessment) {
      return reply.status(404).send({ error: 'Bedömning hittades inte' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, assessment.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    return { assessment };
  });

  // Create assessment
  fastify.post('/', {
    schema: {
      tags: ['Assessments'],
      summary: 'Skapa bedömning',
      body: {
        type: 'object',
        required: ['traineeProfileId', 'type', 'date'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['DOPS', 'MINI_CEX', 'CBD', 'ANNAT'] },
          date: { type: 'string', format: 'date' },
          context: { type: 'string' },
          assessorId: { type: 'string', format: 'uuid' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          narrativeFeedback: { type: 'string' },
          subGoalIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createAssessmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { traineeProfileId, type, date, context, assessorId, rating, narrativeFeedback, subGoalIds } = parsed.data;
    const user = request.user!;

    if (!(await canWriteTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    // If user is supervisor/studierektor, they can be assessor
    const finalAssessorId = assessorId || (
      (user.role === UserRole.HANDLEDARE || user.role === UserRole.STUDIEREKTOR) ? user.id : undefined
    );

    const assessment = await prisma.assessment.create({
      data: {
        traineeProfileId,
        type,
        date,
        context,
        assessorId: finalAssessorId,
        rating,
        narrativeFeedback,
        ...(subGoalIds && {
          assessmentSubGoals: {
            create: subGoalIds.map((subGoalId) => ({ subGoalId })),
          },
        }),
      },
      include: {
        assessor: { select: { id: true, name: true } },
        assessmentSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Assessment',
      entityId: assessment.id,
      newValue: { type, date: date.toISOString() },
    }, request);

    return { assessment };
  });

  // Update assessment (only if not signed)
  fastify.patch('/:id', {
    schema: {
      tags: ['Assessments'],
      summary: 'Uppdatera bedömning',
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

    const parsed = updateAssessmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldAssessment = await prisma.assessment.findUnique({ where: { id } });
    if (!oldAssessment) {
      return reply.status(404).send({ error: 'Bedömning hittades inte' });
    }

    // Check if signed - locked
    if (oldAssessment.signedAt) {
      return reply.status(400).send({ error: 'Signerade bedömningar kan inte redigeras' });
    }

    if (!(await canWriteTrainee(user.id, user.role, user.clinicId, oldAssessment.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const { subGoalIds, ...data } = parsed.data;

    const assessment = await prisma.$transaction(async (tx) => {
      if (subGoalIds !== undefined) {
        await tx.assessmentSubGoal.deleteMany({ where: { assessmentId: id } });
        if (subGoalIds.length > 0) {
          await tx.assessmentSubGoal.createMany({
            data: subGoalIds.map((subGoalId) => ({ assessmentId: id, subGoalId })),
          });
        }
      }

      return tx.assessment.update({
        where: { id },
        data,
        include: {
          assessor: { select: { id: true, name: true } },
          assessmentSubGoals: {
            include: { subGoal: true },
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Assessment',
      entityId: id,
      oldValue: { type: oldAssessment.type },
      newValue: data,
    }, request);

    return { assessment };
  });

  // Sign assessment (supervisor/studierektor only)
  fastify.post('/:id/sign', {
    schema: {
      tags: ['Assessments'],
      summary: 'Signera bedömning',
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

    // Only supervisors and study directors can sign
    if (user.role !== UserRole.HANDLEDARE && user.role !== UserRole.STUDIEREKTOR && user.role !== UserRole.ADMIN) {
      return reply.status(403).send({ error: 'Endast handledare/studierektor kan signera' });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { traineeProfile: true },
    });

    if (!assessment) {
      return reply.status(404).send({ error: 'Bedömning hittades inte' });
    }

    if (assessment.signedAt) {
      return reply.status(400).send({ error: 'Bedömningen är redan signerad' });
    }

    // Verify user can access this trainee
    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, assessment.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const updatedAssessment = await prisma.assessment.update({
      where: { id },
      data: {
        signedAt: new Date(),
        assessorId: user.id,
      },
      include: {
        assessor: { select: { id: true, name: true } },
        assessmentSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'SIGN',
      entityType: 'Assessment',
      entityId: id,
      newValue: { signedAt: updatedAssessment.signedAt?.toISOString(), signedBy: user.name },
    }, request);

    // Create notification for trainee
    const assessmentLabel = ASSESSMENT_TYPE_LABELS[assessment.type as keyof typeof ASSESSMENT_TYPE_LABELS] || assessment.type;
    await createNotificationsForSupervisorSignature(
      assessment.traineeProfile.userId,
      user.name,
      'assessment',
      `${assessmentLabel}-bedömning`
    );

    return { assessment: updatedAssessment };
  });

  // Delete assessment (only if not signed)
  fastify.delete('/:id', {
    schema: {
      tags: ['Assessments'],
      summary: 'Ta bort bedömning',
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

    const assessment = await prisma.assessment.findUnique({ where: { id } });
    if (!assessment) {
      return reply.status(404).send({ error: 'Bedömning hittades inte' });
    }

    if (assessment.signedAt) {
      return reply.status(400).send({ error: 'Signerade bedömningar kan inte tas bort' });
    }

    if (!(await canWriteTrainee(user.id, user.role, user.clinicId, assessment.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    await prisma.assessment.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Assessment',
      entityId: id,
      oldValue: { type: assessment.type },
    }, request);

    return { success: true };
  });
}
