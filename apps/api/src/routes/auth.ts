import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  getSessionUser,
  authenticate,
} from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole } from '@saga/shared';

const loginSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  password: z.string().min(6, 'Lösenord måste vara minst 6 tecken'),
});

const registerSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  password: z.string().min(6, 'Lösenord måste vara minst 6 tecken'),
  name: z.string().min(2, 'Namn måste vara minst 2 tecken'),
  role: z.enum(['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN']).optional(),
  clinicId: z.string().uuid().optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Logga in',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
                clinicId: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(user.password, password))) {
      return reply.status(401).send({ error: 'Felaktigt användarnamn eller lösenord' });
    }

    const token = await createSession(user.id);
    setSessionCookie(reply, token);

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Session',
      entityId: user.id,
    }, request);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
      },
    };
  });

  // Register (for development/admin purposes)
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Registrera ny användare',
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 2 },
          role: { type: 'string', enum: ['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN'] },
          clinicId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { email, password, name, role, clinicId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'E-postadressen är redan registrerad' });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'ST_BT',
        clinicId,
      },
    });

    const token = await createSession(user.id);
    setSessionCookie(reply, token);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
      },
    };
  });

  // Logout
  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logga ut',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getSessionToken(request);
    if (token) {
      await deleteSession(token);
    }
    clearSessionCookie(reply);
    return { success: true };
  });

  // Get current user
  fastify.get('/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Hämta inloggad användare',
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    // Get trainee profile if ST/BT
    let traineeProfile = null;
    if (user.role === UserRole.ST_BT) {
      traineeProfile = await prisma.traineeProfile.findUnique({
        where: { userId: user.id },
        include: {
          clinic: true,
          supervisor: { select: { id: true, name: true, email: true } },
        },
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
      },
      traineeProfile,
    };
  });

  // Change password
  fastify.post('/change-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Byt lösenord',
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
    });

    if (!user || !(await verifyPassword(user.password, currentPassword))) {
      return reply.status(401).send({ error: 'Felaktigt nuvarande lösenord' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { passwordChanged: true },
    }, request);

    return { success: true };
  });
}
