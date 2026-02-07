import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, requireRole, hashPassword } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole } from '@saga/shared';

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN']).optional(),
  clinicId: z.string().uuid().nullable().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users (admin/studierektor only)
  fastify.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'Hämta alla användare',
      querystring: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          clinicId: { type: 'string' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN, UserRole.STUDIEREKTOR),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, clinicId } = request.query as { role?: string; clinicId?: string };
    const user = request.user!;

    const where: Record<string, unknown> = {};

    if (role) where.role = role;

    // Study directors can only see users in their clinic
    if (user.role === UserRole.STUDIEREKTOR) {
      where.clinicId = user.clinicId;
    } else if (clinicId) {
      where.clinicId = clinicId;
    }

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
      orderBy: { name: 'asc' },
    });

    return { users };
  });

  // Get user by ID
  fastify.get('/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Hämta användare',
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
    const currentUser = request.user!;

    // Users can view themselves, admins can view anyone
    if (currentUser.id !== id && currentUser.role !== UserRole.ADMIN) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        clinic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'Användare hittades inte' });
    }

    return { user };
  });

  // Update user
  fastify.patch('/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Uppdatera användare',
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
          role: { type: 'string', enum: ['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN'] },
          clinicId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user!;

    // Users can update themselves (name only), admins can update anyone
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const isSelf = currentUser.id === id;

    if (!isAdmin && !isSelf) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const data = parsed.data;

    // Non-admins can only update name
    if (!isAdmin) {
      delete data.role;
      delete data.clinicId;
    }

    const oldUser = await prisma.user.findUnique({ where: { id } });
    if (!oldUser) {
      return reply.status(404).send({ error: 'Användare hittades inte' });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
      },
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldValue: { name: oldUser.name, role: oldUser.role, clinicId: oldUser.clinicId },
      newValue: data,
    }, request);

    return { user };
  });

  // Delete user (admin only)
  fastify.delete('/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Ta bort användare',
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

    if (currentUser.id === id) {
      return reply.status(400).send({ error: 'Du kan inte ta bort dig själv' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'Användare hittades inte' });
    }

    await prisma.user.delete({ where: { id } });

    await createAuditLog({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
      oldValue: { email: user.email, name: user.name },
    }, request);

    return { success: true };
  });

  // Get supervisors (handledare) for dropdown
  fastify.get('/supervisors', {
    schema: {
      tags: ['Users'],
      summary: 'Hämta handledare',
      querystring: {
        type: 'object',
        properties: {
          clinicId: { type: 'string' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.query as { clinicId?: string };

    const supervisors = await prisma.user.findMany({
      where: {
        role: { in: ['HANDLEDARE', 'STUDIEREKTOR'] },
        ...(clinicId && { clinicId }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    return { supervisors };
  });
}
