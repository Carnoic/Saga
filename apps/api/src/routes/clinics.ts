import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, requireRole } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole } from '@saga/shared';

const createClinicSchema = z.object({
  name: z.string().min(2, 'Namn måste vara minst 2 tecken'),
  organization: z.string().optional(),
});

const updateClinicSchema = z.object({
  name: z.string().min(2).optional(),
  organization: z.string().optional(),
});

export async function clinicRoutes(fastify: FastifyInstance) {
  // Get all clinics
  fastify.get('/', {
    schema: {
      tags: ['Clinics'],
      summary: 'Hämta alla kliniker',
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const clinics = await prisma.clinic.findMany({
      include: {
        _count: {
          select: {
            users: true,
            traineeProfiles: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { clinics };
  });

  // Get single clinic
  fastify.get('/:id', {
    schema: {
      tags: ['Clinics'],
      summary: 'Hämta klinik',
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

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            traineeProfiles: true,
          },
        },
      },
    });

    if (!clinic) {
      return reply.status(404).send({ error: 'Klinik hittades inte' });
    }

    return { clinic };
  });

  // Create clinic (admin only)
  fastify.post('/', {
    schema: {
      tags: ['Clinics'],
      summary: 'Skapa klinik',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2 },
          organization: { type: 'string' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createClinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { name, organization } = parsed.data;
    const user = request.user!;

    const clinic = await prisma.clinic.create({
      data: { name, organization },
    });

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Clinic',
      entityId: clinic.id,
      newValue: { name, organization },
    }, request);

    return { clinic };
  });

  // Update clinic (admin only)
  fastify.patch('/:id', {
    schema: {
      tags: ['Clinics'],
      summary: 'Uppdatera klinik',
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
          name: { type: 'string', minLength: 2 },
          organization: { type: 'string' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const parsed = updateClinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldClinic = await prisma.clinic.findUnique({ where: { id } });
    if (!oldClinic) {
      return reply.status(404).send({ error: 'Klinik hittades inte' });
    }

    const clinic = await prisma.clinic.update({
      where: { id },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Clinic',
      entityId: id,
      oldValue: { name: oldClinic.name, organization: oldClinic.organization },
      newValue: parsed.data,
    }, request);

    return { clinic };
  });

  // Delete clinic (admin only)
  fastify.delete('/:id', {
    schema: {
      tags: ['Clinics'],
      summary: 'Ta bort klinik',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, traineeProfiles: true },
        },
      },
    });

    if (!clinic) {
      return reply.status(404).send({ error: 'Klinik hittades inte' });
    }

    if (clinic._count.users > 0 || clinic._count.traineeProfiles > 0) {
      return reply.status(400).send({
        error: 'Kliniken har användare eller ST/BT-profiler och kan inte tas bort',
      });
    }

    await prisma.clinic.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Clinic',
      entityId: id,
      oldValue: { name: clinic.name },
    }, request);

    return { success: true };
  });
}
