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
  role: z.enum(['ST_BT', 'HANDLEDARE', 'STUDIEREKTOR', 'ADMIN', 'UTVARDERINGSGRUPP']),
  clinicId: z.string().uuid().optional(),
});

const createClinicSchema = z.object({
  name: z.string().min(2),
  organization: z.string().optional(),
});

const createTemplateSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().min(1),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const createQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['RATING', 'TEXT', 'MULTIPLE_CHOICE']),
  options: z.string().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  questionType: z.enum(['RATING', 'TEXT', 'MULTIPLE_CHOICE']).optional(),
  options: z.string().nullable().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
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

  // ============================================
  // FEEDBACK TEMPLATES
  // ============================================

  // List templates for a clinic
  fastify.get('/feedback-templates', {
    schema: {
      tags: ['Admin'],
      summary: 'Lista feedback-mallar för en klinik',
      querystring: {
        type: 'object',
        required: ['clinicId'],
        properties: {
          clinicId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest) => {
    const { clinicId } = request.query as { clinicId: string };

    const templates = await prisma.feedbackTemplate.findMany({
      where: { clinicId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { templates };
  });

  // Create template
  fastify.post('/feedback-templates', {
    schema: {
      tags: ['Admin'],
      summary: 'Skapa feedback-mall',
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUser = request.user!;
    const parsed = createTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { clinicId, name } = parsed.data;

    const template = await prisma.feedbackTemplate.create({
      data: { clinicId, name },
      include: { questions: true },
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'FeedbackTemplate',
      entityId: template.id,
      newValue: { clinicId, name },
    }, request);

    return { template };
  });

  // Update template
  fastify.patch('/feedback-templates/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Uppdatera feedback-mall',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user!;

    const parsed = updateTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const existing = await prisma.feedbackTemplate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Mall hittades inte' });
    }

    const template = await prisma.feedbackTemplate.update({
      where: { id },
      data: parsed.data,
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'UPDATE',
      entityType: 'FeedbackTemplate',
      entityId: id,
      oldValue: { name: existing.name, isActive: existing.isActive },
      newValue: parsed.data,
    }, request);

    return { template };
  });

  // Delete template (cascades questions + answers)
  fastify.delete('/feedback-templates/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Ta bort feedback-mall',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user!;

    const existing = await prisma.feedbackTemplate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Mall hittades inte' });
    }

    await prisma.feedbackTemplate.delete({ where: { id } });

    await createAuditLog({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'FeedbackTemplate',
      entityId: id,
      oldValue: { name: existing.name, clinicId: existing.clinicId },
    }, request);

    return { success: true };
  });

  // ============================================
  // FEEDBACK QUESTIONS
  // ============================================

  // Add question to template
  fastify.post('/feedback-templates/:templateId/questions', {
    schema: {
      tags: ['Admin'],
      summary: 'Lägg till fråga i feedback-mall',
      params: {
        type: 'object',
        required: ['templateId'],
        properties: { templateId: { type: 'string', format: 'uuid' } },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { templateId } = request.params as { templateId: string };
    const currentUser = request.user!;

    const parsed = createQuestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const template = await prisma.feedbackTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return reply.status(404).send({ error: 'Mall hittades inte' });
    }

    const { questionText, questionType, options, required, sortOrder } = parsed.data;

    // If no sortOrder provided, put it last
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxSort = await prisma.feedbackQuestion.aggregate({
        where: { templateId },
        _max: { sortOrder: true },
      });
      finalSortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const question = await prisma.feedbackQuestion.create({
      data: {
        templateId,
        questionText,
        questionType,
        options: options || null,
        required: required ?? false,
        sortOrder: finalSortOrder,
      },
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'FeedbackQuestion',
      entityId: question.id,
      newValue: { templateId, questionText, questionType },
    }, request);

    return { question };
  });

  // Update question
  fastify.patch('/feedback-questions/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Uppdatera feedback-fråga',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user!;

    const parsed = updateQuestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const existing = await prisma.feedbackQuestion.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Fråga hittades inte' });
    }

    const question = await prisma.feedbackQuestion.update({
      where: { id },
      data: parsed.data,
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'UPDATE',
      entityType: 'FeedbackQuestion',
      entityId: id,
      oldValue: { questionText: existing.questionText, questionType: existing.questionType },
      newValue: parsed.data,
    }, request);

    return { question };
  });

  // Delete question
  fastify.delete('/feedback-questions/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Ta bort feedback-fråga',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
    preHandler: requireRole(UserRole.ADMIN),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user!;

    const existing = await prisma.feedbackQuestion.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Fråga hittades inte' });
    }

    await prisma.feedbackQuestion.delete({ where: { id } });

    await createAuditLog({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'FeedbackQuestion',
      entityId: id,
      oldValue: { questionText: existing.questionText, templateId: existing.templateId },
    }, request);

    return { success: true };
  });
}
