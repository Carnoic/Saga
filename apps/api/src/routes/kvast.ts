import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate } from '../lib/auth.js';
import { UserRole } from '@saga/shared';

const competencyRatingEnum = z.enum(['INGA_PROBLEM', 'BOR_ADRESSERAS', 'EJ_OBSERVERAT']);

const createKvastSchema = z.object({
  traineeProfileId: z.string().uuid(),
  respondentType: z.enum([
    'SPECIALISTSJUKSKOTERSKA',
    'UNDERSKOTERSKA',
    'LAKARE_ANNAN_SPECIALITET',
    'LAKARE_EGEN_SPECIALITET',
    'ADMINISTRATIV_PERSONAL',
    'ANNAN_SJUKSKOTERSKA',
  ]),
  positiveFeedback: z.string().optional(),
  improvementFeedback: z.string().optional(),
  competencies: z.object({
    kommunikationPatienter: competencyRatingEnum,
    kommunikationMedarbetare: competencyRatingEnum,
    samarbetsformaga: competencyRatingEnum,
    ledarskap: competencyRatingEnum,
    etik: competencyRatingEnum,
    klinisktResonemang: competencyRatingEnum,
    organisationsformaga: competencyRatingEnum,
    pedagogik: competencyRatingEnum,
    mangfaldJamstallhet: competencyRatingEnum,
    vardhygien: competencyRatingEnum,
    patientsakerhet: competencyRatingEnum,
  }),
  addressComments: z.string().optional(),
  otherComments: z.string().optional(),
});

async function canViewKvastResults(
  userId: string,
  userRole: UserRole,
  userClinicId: string | null | undefined,
  traineeProfileId: string
): Promise<boolean> {
  if (userRole === UserRole.ADMIN) return true;

  const trainee = await prisma.traineeProfile.findUnique({
    where: { id: traineeProfileId },
    select: { userId: true, clinicId: true, supervisorId: true },
  });

  if (!trainee) return false;

  // Trainee can view their own results
  if (trainee.userId === userId) return true;

  // Supervisor can view their assigned trainees
  if (userRole === UserRole.HANDLEDARE && trainee.supervisorId === userId) return true;

  // Study director can view trainees at their clinic
  if (userRole === UserRole.STUDIEREKTOR && trainee.clinicId === userClinicId) return true;

  return false;
}

export async function kvastRoutes(fastify: FastifyInstance) {
  // Get available trainees for evaluation (for Utvärderingsgrupp and Admin)
  fastify.get('/trainees', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const where: Record<string, unknown> = {};

    // Limit to own clinic for non-admins
    if (user.role !== UserRole.ADMIN && user.clinicId) {
      where.clinicId = user.clinicId;
    }

    const trainees = await prisma.traineeProfile.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        clinic: { select: { name: true } },
      },
      orderBy: [{ clinic: { name: 'asc' } }, { user: { name: 'asc' } }],
    });

    return { trainees };
  });

  // Get KVAST responses for a trainee
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId } = request.query as { traineeProfileId?: string };
    const user = request.user!;

    if (!traineeProfileId) {
      return reply.status(400).send({ error: 'traineeProfileId krävs' });
    }

    if (!(await canViewKvastResults(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const responses = await prisma.kvast360Response.findMany({
      where: { traineeProfileId },
      orderBy: { submittedAt: 'desc' },
    });

    // Parse competencies JSON for each response
    const parsed = responses.map((r) => ({
      ...r,
      competencies: JSON.parse(r.competencies),
    }));

    return { responses: parsed };
  });

  // Submit a KVAST evaluation
  fastify.post('/', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    let body: z.infer<typeof createKvastSchema>;
    try {
      body = createKvastSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'Ogiltig data', details: err.errors });
    }

    // Verify trainee exists
    const trainee = await prisma.traineeProfile.findUnique({
      where: { id: body.traineeProfileId },
      select: { id: true, clinicId: true },
    });

    if (!trainee) {
      return reply.status(404).send({ error: 'ST/BT-läkare hittades inte' });
    }

    // Non-admin users can only evaluate trainees at their clinic
    if (
      user.role !== UserRole.ADMIN &&
      user.clinicId &&
      trainee.clinicId !== user.clinicId
    ) {
      return reply.status(403).send({ error: 'Behörighet saknas – fel klinik' });
    }

    const response = await prisma.kvast360Response.create({
      data: {
        traineeProfileId: body.traineeProfileId,
        submittedById: user.id,
        respondentType: body.respondentType,
        positiveFeedback: body.positiveFeedback || null,
        improvementFeedback: body.improvementFeedback || null,
        competencies: JSON.stringify(body.competencies),
        addressComments: body.addressComments || null,
        otherComments: body.otherComments || null,
      },
    });

    return reply.status(201).send({
      response: {
        ...response,
        competencies: body.competencies,
      },
    });
  });
}
