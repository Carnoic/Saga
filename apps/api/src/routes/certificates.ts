import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee, canWriteTrainee } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import Tesseract from 'tesseract.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

const updateCertificateSchema = z.object({
  type: z.enum(['TJANSTGORNINGSINTYG', 'KURSINTYG', 'KOMPETENSBEVIS', 'HANDLEDARINTYG', 'OVRIGT']).optional(),
  title: z.string().optional(),
  issueDate: z.string().transform((s) => new Date(s)).optional(),
  issuer: z.string().optional(),
  ocrText: z.string().optional(),
  parsedFields: z.record(z.unknown()).optional(),
  subGoalIds: z.array(z.string().uuid()).optional(),
});

async function performOCR(filePath: string): Promise<string> {
  try {
    const result = await Tesseract.recognize(filePath, 'swe+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // Progress logging if needed
        }
      },
    });
    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    return '';
  }
}

export async function certificateRoutes(fastify: FastifyInstance) {
  // Get certificates for a trainee
  fastify.get('/', {
    schema: {
      tags: ['Certificates'],
      summary: 'Hämta intyg',
      querystring: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
          type: { type: 'string' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId, type } = request.query as {
      traineeProfileId: string;
      type?: string;
    };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const where: Record<string, unknown> = { traineeProfileId };
    if (type) where.type = type;

    const certificates = await prisma.certificate.findMany({
      where,
      include: {
        certificateSubGoals: {
          include: { subGoal: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { certificates };
  });

  // Get single certificate
  fastify.get('/:id', {
    schema: {
      tags: ['Certificates'],
      summary: 'Hämta intyg',
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

    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        certificateSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    if (!certificate) {
      return reply.status(404).send({ error: 'Intyg hittades inte' });
    }

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, certificate.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    return { certificate };
  });

  // Upload certificate
  fastify.post('/upload', {
    schema: {
      tags: ['Certificates'],
      summary: 'Ladda upp intyg',
      consumes: ['multipart/form-data'],
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Ingen fil uppladdad' });
    }

    // Get form fields
    const fields = data.fields as Record<string, { value: string }>;
    const traineeProfileId = fields.traineeProfileId?.value;
    const type = fields.type?.value || 'OVRIGT';
    const title = fields.title?.value;
    const issuer = fields.issuer?.value;
    const issueDateStr = fields.issueDate?.value;
    const subGoalIdsStr = fields.subGoalIds?.value;

    if (!traineeProfileId) {
      return reply.status(400).send({ error: 'traineeProfileId krävs' });
    }

    if (!(await canWriteTrainee(user.id, user.role, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedMimeTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Otillåten filtyp. Tillåtna: JPEG, PNG, GIF, PDF' });
    }

    // Create storage directory if needed
    const traineeDir = join(STORAGE_PATH, traineeProfileId);
    if (!existsSync(traineeDir)) {
      await mkdir(traineeDir, { recursive: true });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const ext = extname(data.filename) || (data.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const fileName = `${fileId}${ext}`;
    const filePath = join(traineeDir, fileName);
    const relativePath = join(traineeProfileId, fileName);

    // Save file
    const fileBuffer = await data.toBuffer();
    await writeFile(filePath, fileBuffer);

    // Perform OCR (for images)
    let ocrText = '';
    if (data.mimetype.startsWith('image/')) {
      ocrText = await performOCR(filePath);
    }

    // Parse subGoalIds
    let subGoalIds: string[] = [];
    if (subGoalIdsStr) {
      try {
        subGoalIds = JSON.parse(subGoalIdsStr);
      } catch {
        // Ignore parse errors
      }
    }

    // Create certificate record
    const certificate = await prisma.certificate.create({
      data: {
        traineeProfileId,
        type,
        title,
        issuer,
        issueDate: issueDateStr ? new Date(issueDateStr) : undefined,
        filePath: relativePath,
        fileName: data.filename,
        mimeType: data.mimetype,
        fileSize: fileBuffer.length,
        ocrText: ocrText || undefined,
        ocrProcessedAt: ocrText ? new Date() : undefined,
        ...(subGoalIds.length > 0 && {
          certificateSubGoals: {
            create: subGoalIds.map((subGoalId) => ({ subGoalId })),
          },
        }),
      },
      include: {
        certificateSubGoals: {
          include: { subGoal: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Certificate',
      entityId: certificate.id,
      newValue: { type, fileName: data.filename },
    }, request);

    return { certificate };
  });

  // Update certificate metadata
  fastify.patch('/:id', {
    schema: {
      tags: ['Certificates'],
      summary: 'Uppdatera intygsmetadata',
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

    const parsed = updateCertificateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const oldCertificate = await prisma.certificate.findUnique({ where: { id } });
    if (!oldCertificate) {
      return reply.status(404).send({ error: 'Intyg hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, oldCertificate.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    const { subGoalIds, parsedFields, ...data } = parsed.data;

    const certificate = await prisma.$transaction(async (tx) => {
      if (subGoalIds !== undefined) {
        await tx.certificateSubGoal.deleteMany({ where: { certificateId: id } });
        if (subGoalIds.length > 0) {
          await tx.certificateSubGoal.createMany({
            data: subGoalIds.map((subGoalId) => ({ certificateId: id, subGoalId })),
          });
        }
      }

      return tx.certificate.update({
        where: { id },
        data: {
          ...data,
          ...(parsedFields && { parsedFields: JSON.stringify(parsedFields) }),
        },
        include: {
          certificateSubGoals: {
            include: { subGoal: true },
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Certificate',
      entityId: id,
      oldValue: { type: oldCertificate.type },
      newValue: data,
    }, request);

    return { certificate };
  });

  // Re-run OCR
  fastify.post('/:id/ocr', {
    schema: {
      tags: ['Certificates'],
      summary: 'Kör OCR igen',
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

    const certificate = await prisma.certificate.findUnique({ where: { id } });

    if (!certificate) {
      return reply.status(404).send({ error: 'Intyg hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, certificate.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    if (!certificate.mimeType.startsWith('image/')) {
      return reply.status(400).send({ error: 'OCR kan endast köras på bilder' });
    }

    const filePath = join(STORAGE_PATH, certificate.filePath);
    const ocrText = await performOCR(filePath);

    const updated = await prisma.certificate.update({
      where: { id },
      data: {
        ocrText,
        ocrProcessedAt: new Date(),
      },
    });

    return { certificate: updated, ocrText };
  });

  // Delete certificate
  fastify.delete('/:id', {
    schema: {
      tags: ['Certificates'],
      summary: 'Ta bort intyg',
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

    const certificate = await prisma.certificate.findUnique({ where: { id } });
    if (!certificate) {
      return reply.status(404).send({ error: 'Intyg hittades inte' });
    }

    if (!(await canWriteTrainee(user.id, user.role, certificate.traineeProfileId))) {
      return reply.status(403).send({ error: 'Behörighet saknas' });
    }

    // Delete file
    try {
      const filePath = join(STORAGE_PATH, certificate.filePath);
      await unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }

    await prisma.certificate.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Certificate',
      entityId: id,
      oldValue: { type: certificate.type, fileName: certificate.fileName },
    }, request);

    return { success: true };
  });
}
