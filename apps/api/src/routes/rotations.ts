import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee, canWriteTrainee } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { isOverlapping } from '@saga/shared';

const createRotationSchema = z.object({
  traineeProfileId: z.string().uuid(),
  unit: z.string().min(1, 'Enhet krävs'),
  specialtyArea: z.string().optional(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  planned: z.boolean().default(false),
  supervisorName: z.string().optional(),
  notes: z.string().optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

const updateRotationSchema = z.object({
  unit: z.string().min(1).optional(),
  specialtyArea: z.string().optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  planned: z.boolean().optional(),
  supervisorName: z.string().optional(),
  notes: z.string().optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

export async function rotationRoutes(fastify: FastifyInstance) {
  // Get rotations for a trainee
  fastify.get('/', {
    schema: {
      tags: ['Rotations'],
      summary: 'Hämta placeringar',
      querystring: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          planned: { type: 'boolean' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId, planned, startDate, endDate } = request.query as {
      traineeProfileId: string;
      planned?: boolean;
      startDate?: string;
      endDate?: string;
    };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const where: Record<string, unknown> = { traineeProfileId };
    if (planned !== undefined) where.planned = planned;
    if (startDate) where.startDate = { gte: new Date(startDate) };
    if (endDate) where.endDate = { lte: new Date(endDate) };

    const rotations = await prisma.rotation.findMany({
      where,
      include: {
        rotationSubGoals: {
          include: { subGoal: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return { rotations };
  });

  // Get single rotation
  fastify.get('/:id', {
    schema: {
      tags: ['Rotations'],
      summary: 'Hämta placering',
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

    const rotation = await prisma.rotation.findUnique({
      where: { id },
      include: {
        traineeProfile: true,
        rotationSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    if (!rotation) {
      return reply.status(404).send({ error: 'Placering hittades inte' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, rotation.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    return { rotation };
  });

  // Create rotation
  fastify.post('/', {
    schema: {
      tags: ['Rotations'],
      summary: 'Skapa placering',
      body: {
        type: 'object',
        required: ['traineeProfileId', 'unit', 'startDate', 'endDate'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          unit: { type: 'string', minLength: 1 },
          specialtyArea: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          planned: { type: 'boolean' },
          supervisorName: { type: 'string' },
          notes: { type: 'string' },
          subGoalIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createRotationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { traineeProfileId, unit, specialtyArea, startDate, endDate, planned, supervisorName, notes, subGoalIds } = parsed.data;
    const user = request.user!;

    if (!(await canWriteTrainee(user.id, user.role, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    // Validate dates
    if (startDate >= endDate) {
      return reply.status(400).send({ error: 'Slutdatum måste vara efter startdatum' });
    }

    // Check for overlapping rotations (only for non-planned)
    if (!planned) {
      const existingRotations = await prisma.rotation.findMany({
        where: {
          traineeProfileId,
          planned: false,
        },
      });

      for (const existing of existingRotations) {
        if (isOverlapping(startDate, endDate, existing.startDate, existing.endDate)) {
          return reply.status(400).send({
            error: `Placeringen överlappar med befintlig placering på ${existing.unit} (${existing.startDate.toISOString().split('T')[0]} - ${existing.endDate.toISOString().split('T')[0]})`,
          });
        }
      }
    }

    // Verify trainee exists and check dates within training period
    const traineeProfile = await prisma.traineeProfile.findUnique({
      where: { id: traineeProfileId },
    });

    if (!traineeProfile) {
      return reply.status(400).send({ error: 'ST/BT-profil hittades inte' });
    }

    if (startDate < traineeProfile.startDate || endDate > traineeProfile.plannedEndDate) {
      return reply.status(400).send({
        error: `Placeringen måste vara inom ST/BT-perioden (${traineeProfile.startDate.toISOString().split('T')[0]} - ${traineeProfile.plannedEndDate.toISOString().split('T')[0]})`,
      });
    }

    const rotation = await prisma.rotation.create({
      data: {
        traineeProfileId,
        unit,
        specialtyArea,
        startDate,
        endDate,
        planned: planned ?? false,
        supervisorName,
        notes,
        ...(subGoalIds && {
          rotationSubGoals: {
            create: subGoalIds.map((subGoalId) => ({ subGoalId })),
          },
        }),
      },
      include: {
        rotationSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Rotation',
      entityId: rotation.id,
      newValue: { unit, startDate: startDate.toISOString(), endDate: endDate.toISOString(), planned },
    }, request);

    return { rotation };
  });

  // Update rotation
  fastify.patch('/:id', {
    schema: {
      tags: ['Rotations'],
      summary: 'Uppdatera placering',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          unit: { type: 'string', minLength: 1 },
          specialtyArea: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          planned: { type: 'boolean' },
          supervisorName: { type: 'string' },
          notes: { type: 'string' },
          subGoalIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const parsed = updateRotationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldRotation = await prisma.rotation.findUnique({
      where: { id },
      include: { traineeProfile: true },
    });

    if (!oldRotation) {
      return reply.status(404).send({ error: 'Placering hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, oldRotation.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const { subGoalIds, ...data } = parsed.data;

    // Validate new dates if provided
    const newStartDate = data.startDate ?? oldRotation.startDate;
    const newEndDate = data.endDate ?? oldRotation.endDate;
    const newPlanned = data.planned ?? oldRotation.planned;

    if (newStartDate >= newEndDate) {
      return reply.status(400).send({ error: 'Slutdatum måste vara efter startdatum' });
    }

    // Check for overlapping rotations
    if (!newPlanned) {
      const existingRotations = await prisma.rotation.findMany({
        where: {
          traineeProfileId: oldRotation.traineeProfileId,
          planned: false,
          id: { not: id },
        },
      });

      for (const existing of existingRotations) {
        if (isOverlapping(newStartDate, newEndDate, existing.startDate, existing.endDate)) {
          return reply.status(400).send({
            error: `Placeringen överlappar med befintlig placering på ${existing.unit}`,
          });
        }
      }
    }

    // Update rotation
    const rotation = await prisma.$transaction(async (tx) => {
      // Update subgoal links if provided
      if (subGoalIds !== undefined) {
        await tx.rotationSubGoal.deleteMany({ where: { rotationId: id } });
        if (subGoalIds.length > 0) {
          await tx.rotationSubGoal.createMany({
            data: subGoalIds.map((subGoalId) => ({ rotationId: id, subGoalId })),
          });
        }
      }

      return tx.rotation.update({
        where: { id },
        data,
        include: {
          rotationSubGoals: {
            include: { subGoal: true },
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Rotation',
      entityId: id,
      oldValue: { ...oldRotation },
      newValue: data,
    }, request);

    return { rotation };
  });

  // Delete rotation
  fastify.delete('/:id', {
    schema: {
      tags: ['Rotations'],
      summary: 'Ta bort placering',
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

    const rotation = await prisma.rotation.findUnique({ where: { id } });

    if (!rotation) {
      return reply.status(404).send({ error: 'Placering hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, rotation.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    await prisma.rotation.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Rotation',
      entityId: id,
      oldValue: { unit: rotation.unit, startDate: rotation.startDate.toISOString() },
    }, request);

    return { success: true };
  });
}
