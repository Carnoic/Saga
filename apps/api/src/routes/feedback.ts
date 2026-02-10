import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { authenticate, requireRole } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { UserRole } from '@saga/shared';

interface FeedbackInput {
  overallRating: number;
  educationalValue: number;
  supervisionQuality: number;
  workEnvironment: number;
  positives?: string;
  improvements?: string;
  otherComments?: string;
  anonymous?: boolean;
}

export async function feedbackRoutes(fastify: FastifyInstance) {
  // Submit feedback for a rotation (ST/BT only)
  fastify.post<{ Params: { rotationId: string }; Body: FeedbackInput }>(
    '/rotation/:rotationId',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user!.id;
      const { rotationId } = request.params;
      const data = request.body;

      // Verify the rotation exists and belongs to the user
      const rotation = await prisma.rotation.findUnique({
        where: { id: rotationId },
        include: {
          traineeProfile: true,
          feedback: true,
        },
      });

      if (!rotation) {
        return reply.status(404).send({ error: 'Placering hittades inte' });
      }

      if (rotation.traineeProfile.userId !== userId) {
        return reply.status(403).send({ error: 'Du kan bara lämna feedback för dina egna placeringar' });
      }

      // Check if feedback already exists
      if (rotation.feedback) {
        return reply.status(400).send({ error: 'Feedback har redan lämnats för denna placering' });
      }

      // Check if rotation has ended
      if (new Date(rotation.endDate) > new Date()) {
        return reply.status(400).send({ error: 'Du kan bara lämna feedback för avslutade placeringar' });
      }

      // Validate ratings (1-5)
      const ratings = [data.overallRating, data.educationalValue, data.supervisionQuality, data.workEnvironment];
      for (const rating of ratings) {
        if (rating < 1 || rating > 5) {
          return reply.status(400).send({ error: 'Betyg måste vara mellan 1 och 5' });
        }
      }

      const feedback = await prisma.rotationFeedback.create({
        data: {
          rotationId,
          traineeProfileId: rotation.traineeProfileId,
          overallRating: data.overallRating,
          educationalValue: data.educationalValue,
          supervisionQuality: data.supervisionQuality,
          workEnvironment: data.workEnvironment,
          positives: data.positives,
          improvements: data.improvements,
          otherComments: data.otherComments,
          anonymous: data.anonymous ?? false,
        },
      });

      await createAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'RotationFeedback',
        entityId: feedback.id,
        newValue: feedback as unknown as Record<string, unknown>,
      }, request);

      return feedback;
    }
  );

  // Get feedback for a specific rotation (owner or studierektor)
  fastify.get<{ Params: { rotationId: string } }>(
    '/rotation/:rotationId',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user!.id;
      const userRole = request.user!.role;
      const { rotationId } = request.params;

      const rotation = await prisma.rotation.findUnique({
        where: { id: rotationId },
        include: {
          traineeProfile: {
            include: { user: true },
          },
          feedback: true,
        },
      });

      if (!rotation) {
        return reply.status(404).send({ error: 'Placering hittades inte' });
      }

      if (!rotation.feedback) {
        return reply.status(404).send({ error: 'Ingen feedback har lämnats för denna placering' });
      }

      // Check access
      const isOwner = rotation.traineeProfile.userId === userId;
      const isStudierektor = userRole === 'STUDIEREKTOR' || userRole === 'ADMIN';

      if (!isOwner && !isStudierektor) {
        return reply.status(403).send({ error: 'Åtkomst nekad' });
      }

      // If anonymous and viewer is studierektor (not owner), hide trainee info
      if (rotation.feedback.anonymous && !isOwner) {
        return {
          ...rotation.feedback,
          traineeProfile: undefined,
          rotation: {
            unit: rotation.unit,
            startDate: rotation.startDate,
            endDate: rotation.endDate,
          },
        };
      }

      return {
        ...rotation.feedback,
        rotation: {
          unit: rotation.unit,
          startDate: rotation.startDate,
          endDate: rotation.endDate,
          traineeName: rotation.traineeProfile.user.name,
        },
      };
    }
  );

  // Get all feedback for a unit (studierektor only)
  fastify.get<{ Querystring: { unit?: string; from?: string; to?: string } }>(
    '/unit',
    { preHandler: requireRole(UserRole.STUDIEREKTOR, UserRole.ADMIN) },
    async (request) => {
      const { unit, from, to } = request.query;

      const whereClause: any = {};

      if (unit) {
        whereClause.rotation = { unit };
      }

      if (from || to) {
        whereClause.submittedAt = {};
        if (from) whereClause.submittedAt.gte = new Date(from);
        if (to) whereClause.submittedAt.lte = new Date(to);
      }

      const feedbacks = await prisma.rotationFeedback.findMany({
        where: whereClause,
        include: {
          rotation: {
            select: {
              unit: true,
              startDate: true,
              endDate: true,
            },
          },
          traineeProfile: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      // Anonymize where needed
      return feedbacks.map((fb) => ({
        id: fb.id,
        rotationId: fb.rotationId,
        unit: fb.rotation.unit,
        startDate: fb.rotation.startDate,
        endDate: fb.rotation.endDate,
        traineeName: fb.anonymous ? 'Anonym' : fb.traineeProfile.user.name,
        overallRating: fb.overallRating,
        educationalValue: fb.educationalValue,
        supervisionQuality: fb.supervisionQuality,
        workEnvironment: fb.workEnvironment,
        positives: fb.positives,
        improvements: fb.improvements,
        otherComments: fb.otherComments,
        anonymous: fb.anonymous,
        submittedAt: fb.submittedAt,
      }));
    }
  );

  // Get feedback statistics per unit (studierektor only)
  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    '/statistics',
    { preHandler: requireRole(UserRole.STUDIEREKTOR, UserRole.ADMIN) },
    async (request) => {
      const { from, to } = request.query;

      const whereClause: any = {};
      if (from || to) {
        whereClause.submittedAt = {};
        if (from) whereClause.submittedAt.gte = new Date(from);
        if (to) whereClause.submittedAt.lte = new Date(to);
      }

      const feedbacks = await prisma.rotationFeedback.findMany({
        where: whereClause,
        include: {
          rotation: {
            select: { unit: true },
          },
        },
      });

      // Group by unit and calculate averages
      const unitStats = new Map<string, {
        count: number;
        overallRating: number;
        educationalValue: number;
        supervisionQuality: number;
        workEnvironment: number;
      }>();

      for (const fb of feedbacks) {
        const unit = fb.rotation.unit;
        const existing = unitStats.get(unit) || {
          count: 0,
          overallRating: 0,
          educationalValue: 0,
          supervisionQuality: 0,
          workEnvironment: 0,
        };

        existing.count++;
        existing.overallRating += fb.overallRating;
        existing.educationalValue += fb.educationalValue;
        existing.supervisionQuality += fb.supervisionQuality;
        existing.workEnvironment += fb.workEnvironment;

        unitStats.set(unit, existing);
      }

      // Calculate averages
      const statistics = Array.from(unitStats.entries()).map(([unit, stats]) => ({
        unit,
        responseCount: stats.count,
        averageOverall: Math.round((stats.overallRating / stats.count) * 10) / 10,
        averageEducational: Math.round((stats.educationalValue / stats.count) * 10) / 10,
        averageSupervision: Math.round((stats.supervisionQuality / stats.count) * 10) / 10,
        averageEnvironment: Math.round((stats.workEnvironment / stats.count) * 10) / 10,
      }));

      return {
        totalResponses: feedbacks.length,
        byUnit: statistics.sort((a, b) => b.responseCount - a.responseCount),
      };
    }
  );

  // Check if user has pending feedback to submit
  fastify.get(
    '/pending',
    { preHandler: authenticate },
    async (request) => {
      const userId = request.user!.id;

      // Get trainee profile
      const traineeProfile = await prisma.traineeProfile.findUnique({
        where: { userId },
      });

      if (!traineeProfile) {
        return { pendingFeedback: [] };
      }

      // Find completed rotations without feedback
      const rotationsWithoutFeedback = await prisma.rotation.findMany({
        where: {
          traineeProfileId: traineeProfile.id,
          endDate: { lt: new Date() }, // Ended
          feedback: null, // No feedback yet
        },
        orderBy: { endDate: 'desc' },
      });

      return {
        pendingFeedback: rotationsWithoutFeedback.map((r) => ({
          id: r.id,
          unit: r.unit,
          startDate: r.startDate,
          endDate: r.endDate,
        })),
      };
    }
  );
}
