import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee, canWriteTrainee } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole } from '@saga/shared';

const createSupervisionSchema = z.object({
  traineeProfileId: z.string().uuid(),
  date: z.string().transform((s) => new Date(s)),
  notes: z.string().optional(),
  agreedActions: z.string().optional(),
  supervisorId: z.string().uuid().optional(),
});

const updateSupervisionSchema = z.object({
  date: z.string().transform((s) => new Date(s)).optional(),
  notes: z.string().optional(),
  agreedActions: z.string().optional(),
});

export async function supervisionRoutes(fastify: FastifyInstance) {
  // Get supervision meetings for a trainee
  fastify.get('/', {
    schema: {
      tags: ['Supervision'],
      summary: 'Hämta handledarsamtal',
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

    const meetings = await prisma.supervisionMeeting.findMany({
      where: { traineeProfileId },
      include: {
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    return { meetings };
  });

  // Get single supervision meeting
  fastify.get('/:id', {
    schema: {
      tags: ['Supervision'],
      summary: 'Hämta handledarsamtal',
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

    const meeting = await prisma.supervisionMeeting.findUnique({
      where: { id },
      include: {
        supervisor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!meeting) {
      return reply.status(404).send({ error: 'Handledarsamtal hittades inte' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, meeting.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    return { meeting };
  });

  // Create supervision meeting
  fastify.post('/', {
    schema: {
      tags: ['Supervision'],
      summary: 'Skapa handledarsamtal',
      body: {
        type: 'object',
        required: ['traineeProfileId', 'date'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
          notes: { type: 'string' },
          agreedActions: { type: 'string' },
          supervisorId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createSupervisionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { traineeProfileId, date, notes, agreedActions, supervisorId } = parsed.data;
    const user = request.user!;

    if (!(await canWriteTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    // If user is supervisor, set them as supervisor
    const finalSupervisorId = supervisorId || (
      (user.role === UserRole.HANDLEDARE || user.role === UserRole.STUDIEREKTOR) ? user.id : undefined
    );

    const meeting = await prisma.supervisionMeeting.create({
      data: {
        traineeProfileId,
        date,
        notes,
        agreedActions,
        supervisorId: finalSupervisorId,
      },
      include: {
        supervisor: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'SupervisionMeeting',
      entityId: meeting.id,
      newValue: { date: date.toISOString() },
    }, request);

    return { meeting };
  });

  // Update supervision meeting (only if not signed)
  fastify.patch('/:id', {
    schema: {
      tags: ['Supervision'],
      summary: 'Uppdatera handledarsamtal',
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

    const parsed = updateSupervisionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldMeeting = await prisma.supervisionMeeting.findUnique({ where: { id } });
    if (!oldMeeting) {
      return reply.status(404).send({ error: 'Handledarsamtal hittades inte' });
    }

    if (oldMeeting.signedAt) {
      return reply.status(400).send({ error: 'Signerade handledarsamtal kan inte redigeras' });
    }

    if (!(await canWriteTrainee(user.id, user.role, user.clinicId, oldMeeting.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const meeting = await prisma.supervisionMeeting.update({
      where: { id },
      data: parsed.data,
      include: {
        supervisor: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'SupervisionMeeting',
      entityId: id,
      oldValue: { date: oldMeeting.date.toISOString() },
      newValue: parsed.data,
    }, request);

    return { meeting };
  });

  // Sign supervision meeting
  fastify.post('/:id/sign', {
    schema: {
      tags: ['Supervision'],
      summary: 'Signera handledarsamtal',
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

    const meeting = await prisma.supervisionMeeting.findUnique({ where: { id } });

    if (!meeting) {
      return reply.status(404).send({ error: 'Handledarsamtal hittades inte' });
    }

    if (meeting.signedAt) {
      return reply.status(400).send({ error: 'Handledarsamtalet är redan signerat' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, meeting.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const updatedMeeting = await prisma.supervisionMeeting.update({
      where: { id },
      data: {
        signedAt: new Date(),
        supervisorId: user.id,
      },
      include: {
        supervisor: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'SIGN',
      entityType: 'SupervisionMeeting',
      entityId: id,
      newValue: { signedAt: updatedMeeting.signedAt?.toISOString(), signedBy: user.name },
    }, request);

    return { meeting: updatedMeeting };
  });

  // Delete supervision meeting (only if not signed)
  fastify.delete('/:id', {
    schema: {
      tags: ['Supervision'],
      summary: 'Ta bort handledarsamtal',
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

    const meeting = await prisma.supervisionMeeting.findUnique({ where: { id } });
    if (!meeting) {
      return reply.status(404).send({ error: 'Handledarsamtal hittades inte' });
    }

    if (meeting.signedAt) {
      return reply.status(400).send({ error: 'Signerade handledarsamtal kan inte tas bort' });
    }

    if (!(await canWriteTrainee(user.id, user.role, user.clinicId, meeting.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    await prisma.supervisionMeeting.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'SupervisionMeeting',
      entityId: id,
    }, request);

    return { success: true };
  });
}
