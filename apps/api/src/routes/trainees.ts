import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, requireRole, canAccessTrainee, hashPassword } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole, TrackType } from '@saga/shared';

const createTraineeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  trackType: z.enum(['ST', 'BT']),
  specialty: z.string().optional(),
  clinicId: z.string().uuid(),
  startDate: z.string().transform((s) => new Date(s)),
  plannedEndDate: z.string().transform((s) => new Date(s)),
  supervisorId: z.string().uuid().optional(),
});

const updateTraineeSchema = z.object({
  trackType: z.enum(['ST', 'BT']).optional(),
  specialty: z.string().optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  plannedEndDate: z.string().transform((s) => new Date(s)).optional(),
  supervisorId: z.string().uuid().nullable().optional(),
});

export async function traineeRoutes(fastify: FastifyInstance) {
  // Get all trainees (for study director view)
  fastify.get('/', {
    schema: {
      tags: ['Trainees'],
      summary: 'Hämta alla ST/BT-läkare',
      querystring: {
        type: 'object',
        properties: {
          clinicId: { type: 'string' },
          trackType: { type: 'string', enum: ['ST', 'BT'] },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN, UserRole.STUDIEREKTOR, UserRole.HANDLEDARE),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, trackType } = request.query as { clinicId?: string; trackType?: string };
    const user = request.user!;

    const where: Record<string, unknown> = {};

    // Filter by role access
    if (user.role === UserRole.STUDIEREKTOR) {
      where.clinicId = user.clinicId;
    } else if (user.role === UserRole.HANDLEDARE) {
      where.supervisorId = user.id;
    } else if (clinicId) {
      where.clinicId = clinicId;
    }

    if (trackType) where.trackType = trackType;

    const trainees = await prisma.traineeProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        clinic: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
        _count: {
          select: {
            rotations: true,
            assessments: true,
            certificates: true,
            subGoalProgress: { where: { status: 'UPPNADD' } },
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return { trainees };
  });

  // Get single trainee profile
  fastify.get('/:id', {
    schema: {
      tags: ['Trainees'],
      summary: 'Hämta ST/BT-läkarprofil',
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

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, id))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const profile = await prisma.traineeProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        clinic: true,
        supervisor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!profile) {
      return reply.status(404).send({ error: 'Profil hittades inte' });
    }

    return { profile };
  });

  // Create trainee (creates user + profile)
  fastify.post('/', {
    schema: {
      tags: ['Trainees'],
      summary: 'Skapa ny ST/BT-läkare',
      body: {
        type: 'object',
        required: ['email', 'password', 'name', 'trackType', 'clinicId', 'startDate', 'plannedEndDate'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 2 },
          trackType: { type: 'string', enum: ['ST', 'BT'] },
          specialty: { type: 'string' },
          clinicId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date' },
          plannedEndDate: { type: 'string', format: 'date' },
          supervisorId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: requireRole(UserRole.ADMIN, UserRole.STUDIEREKTOR),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createTraineeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { email, password, name, trackType, specialty, clinicId, startDate, plannedEndDate, supervisorId } = parsed.data;
    const currentUser = request.user!;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({ error: 'E-postadressen är redan registrerad' });
    }

    // Verify clinic exists
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      return reply.status(400).send({ error: 'Kliniken hittades inte' });
    }

    // Create user and profile in transaction
    const hashedPassword = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ST_BT',
          clinicId,
        },
      });

      const profile = await tx.traineeProfile.create({
        data: {
          userId: user.id,
          trackType,
          specialty,
          clinicId,
          startDate,
          plannedEndDate,
          supervisorId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          clinic: true,
          supervisor: { select: { id: true, name: true } },
        },
      });

      // Initialize subgoal progress with default goal spec
      const defaultGoalSpec = await tx.goalSpec.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (defaultGoalSpec) {
        const subGoals = await tx.subGoal.findMany({
          where: { goalSpecId: defaultGoalSpec.id },
        });

        await tx.traineeSubGoalProgress.createMany({
          data: subGoals.map((sg) => ({
            traineeProfileId: profile.id,
            subGoalId: sg.id,
            status: 'EJ_PABORJAD',
          })),
        });
      }

      return profile;
    });

    await createAuditLog({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'TraineeProfile',
      entityId: result.id,
      newValue: { email, name, trackType, clinicId },
    }, request);

    return { profile: result };
  });

  // Update trainee profile
  fastify.patch('/:id', {
    schema: {
      tags: ['Trainees'],
      summary: 'Uppdatera ST/BT-läkarprofil',
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
          trackType: { type: 'string', enum: ['ST', 'BT'] },
          specialty: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          plannedEndDate: { type: 'string', format: 'date' },
          supervisorId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    // Only admin/studierektor can update profiles
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.STUDIEREKTOR) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const parsed = updateTraineeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldProfile = await prisma.traineeProfile.findUnique({ where: { id } });
    if (!oldProfile) {
      return reply.status(404).send({ error: 'Profil hittades inte' });
    }

    const profile = await prisma.traineeProfile.update({
      where: { id },
      data: parsed.data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        clinic: true,
        supervisor: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'TraineeProfile',
      entityId: id,
      oldValue: { ...oldProfile },
      newValue: parsed.data,
    }, request);

    return { profile };
  });

  // Get trainee by user ID (for logged-in user)
  fastify.get('/my-profile', {
    schema: {
      tags: ['Trainees'],
      summary: 'Hämta egen profil',
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const profile = await prisma.traineeProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        clinic: true,
        supervisor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!profile) {
      return reply.status(404).send({ error: 'Ingen ST/BT-profil hittades' });
    }

    return { profile };
  });
}
