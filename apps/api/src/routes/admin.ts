import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireRole, hashPassword } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole } from '@saga/shared';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN']),
  clinicId: z.string().uuid().optional(),
});

const createClinicSchema = z.object({
  name: z.string().min(2),
  organization: z.string().optional(),
});

export async function adminRoutes(fastify: FastifyInstance) {
  // Get all users (admin only, no clinic filter)
  fastify.get('/users', {
    schema: {
      tags: ['Admin'],
      summary: 'Hämta alla användare (admin)',
      querystring: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          clinicId: { type: 'string' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest) => {
    const { role, clinicId } = request.query as { role?: string; clinicId?: string };

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (clinicId) where.clinicId = clinicId;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        clinic: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { users };
  });

  // Create any user (admin only)
  fastify.post('/users', {
    schema: {
      tags: ['Admin'],
      summary: 'Skapa användare (admin)',
      body: {
        type: 'object',
        required: ['email', 'password', 'name', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 2 },
          role: { type: 'string', enum: ['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN'] },
          clinicId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUser = request.user!;

    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { email, password, name, role, clinicId } = parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({ error: 'E-postadressen är redan registrerad' });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        clinicId: clinicId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        clinic: { select: { name: true } },
      },
    });

    // If creating ST_BT, also create trainee profile
    if (role === 'ST_BT' && clinicId) {
      await prisma.traineeProfile.create({
        data: {
          userId: user.id,
          trackType: 'ST',
          clinicId,
          startDate: new Date(),
          plannedEndDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await createAuditLog({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { email, name, role, clinicId },
    }, request);

    return { user };
  });

  // Get all clinics
  fastify.get('/clinics', {
    schema: {
      tags: ['Admin'],
      summary: 'Hämta alla kliniker',
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async () => {
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

  // Create clinic
  fastify.post('/clinics', {
    schema: {
      tags: ['Admin'],
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
    const currentUser = request.user!;

    const parsed = createClinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { name, organization } = parsed.data;

    // Check if clinic name already exists
    const existingClinic = await prisma.clinic.findFirst({ where: { name } });
    if (existingClinic) {
      return reply.status(409).send({ error: 'En klinik med detta namn finns redan' });
    }

    const clinic = await prisma.clinic.create({
      data: {
        name,
        organization: organization || null,
      },
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'Clinic',
      entityId: clinic.id,
      newValue: { name, organization },
    }, request);

    return { clinic };
  });

  // Delete clinic
  fastify.delete('/clinics/:id', {
    schema: {
      tags: ['Admin'],
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
    const currentUser = request.user!;

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!clinic) {
      return reply.status(404).send({ error: 'Klinik hittades inte' });
    }

    if (clinic._count.users > 0) {
      return reply.status(400).send({
        error: 'Kan inte ta bort klinik med användare. Flytta användarna först.'
      });
    }

    await prisma.clinic.delete({ where: { id } });

    await createAuditLog({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'Clinic',
      entityId: id,
      oldValue: { name: clinic.name },
    }, request);

    return { success: true };
  });
}
