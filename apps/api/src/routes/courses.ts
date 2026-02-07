import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee, canWriteTrainee } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';

const createCourseSchema = z.object({
  traineeProfileId: z.string().uuid(),
  title: z.string().min(1, 'Titel krävs'),
  provider: z.string().optional(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  hours: z.number().int().positive().optional(),
  notes: z.string().optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  provider: z.string().optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  hours: z.number().int().positive().optional(),
  notes: z.string().optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

export async function courseRoutes(fastify: FastifyInstance) {
  // Get courses for a trainee
  fastify.get('/', {
    schema: {
      tags: ['Courses'],
      summary: 'Hämta kurser',
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

    const courses = await prisma.course.findMany({
      where: { traineeProfileId },
      include: {
        courseSubGoals: {
          include: { subGoal: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return { courses };
  });

  // Get single course
  fastify.get('/:id', {
    schema: {
      tags: ['Courses'],
      summary: 'Hämta kurs',
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

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        courseSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    if (!course) {
      return reply.status(404).send({ error: 'Kurs hittades inte' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, course.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    return { course };
  });

  // Create course
  fastify.post('/', {
    schema: {
      tags: ['Courses'],
      summary: 'Skapa kurs',
      body: {
        type: 'object',
        required: ['traineeProfileId', 'title', 'startDate'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 1 },
          provider: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          hours: { type: 'integer', minimum: 1 },
          notes: { type: 'string' },
          subGoalIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createCourseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { traineeProfileId, title, provider, startDate, endDate, hours, notes, subGoalIds } = parsed.data;
    const user = request.user!;

    if (!(await canWriteTrainee(user.id, user.role, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const course = await prisma.course.create({
      data: {
        traineeProfileId,
        title,
        provider,
        startDate,
        endDate,
        hours,
        notes,
        ...(subGoalIds && {
          courseSubGoals: {
            create: subGoalIds.map((subGoalId) => ({ subGoalId })),
          },
        }),
      },
      include: {
        courseSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Course',
      entityId: course.id,
      newValue: { title, startDate: startDate.toISOString() },
    }, request);

    return { course };
  });

  // Update course
  fastify.patch('/:id', {
    schema: {
      tags: ['Courses'],
      summary: 'Uppdatera kurs',
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

    const parsed = updateCourseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldCourse = await prisma.course.findUnique({ where: { id } });
    if (!oldCourse) {
      return reply.status(404).send({ error: 'Kurs hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, oldCourse.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const { subGoalIds, ...data } = parsed.data;

    const course = await prisma.$transaction(async (tx) => {
      if (subGoalIds !== undefined) {
        await tx.courseSubGoal.deleteMany({ where: { courseId: id } });
        if (subGoalIds.length > 0) {
          await tx.courseSubGoal.createMany({
            data: subGoalIds.map((subGoalId) => ({ courseId: id, subGoalId })),
          });
        }
      }

      return tx.course.update({
        where: { id },
        data,
        include: {
          courseSubGoals: {
            include: { subGoal: true },
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Course',
      entityId: id,
      oldValue: { title: oldCourse.title },
      newValue: data,
    }, request);

    return { course };
  });

  // Delete course
  fastify.delete('/:id', {
    schema: {
      tags: ['Courses'],
      summary: 'Ta bort kurs',
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

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return reply.status(404).send({ error: 'Kurs hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, course.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    await prisma.course.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Course',
      entityId: id,
      oldValue: { title: course.title },
    }, request);

    return { success: true };
  });
}
