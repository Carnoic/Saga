import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { authenticate, canAccessTrainee } from '../lib/auth.js';
import { createAuditLog } from '../lib/audit.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import archiver from 'archiver';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { formatDateSv, SUBGOAL_CATEGORY_LABELS, ASSESSMENT_TYPE_LABELS, CERTIFICATE_TYPE_LABELS } from '@saga/shared';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

async function generateSummaryPDF(data: {
  profile: any;
  rotations: any[];
  courses: any[];
  assessments: any[];
  supervisionMeetings: any[];
  certificates: any[];
  subGoalProgress: any[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595, 842]); // A4
  let y = 800;
  const margin = 50;
  const lineHeight = 14;

  const addText = (text: string, size = 10, bold = false) => {
    if (y < 50) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  };

  const addSection = (title: string) => {
    y -= 10;
    addText(title, 14, true);
    y -= 5;
  };

  // Header
  addText('SAMMANSTALLNING FOR SPECIALISTANSOKAN', 16, true);
  y -= 10;
  addText(`Genererad: ${formatDateSv(new Date())}`, 10);
  y -= 20;

  // Personal information
  addSection('PERSONUPPGIFTER');
  addText(`Namn: ${data.profile.user.name}`);
  addText(`E-post: ${data.profile.user.email}`);
  addText(`Utbildningstyp: ${data.profile.trackType}`);
  if (data.profile.specialty) {
    addText(`Specialitet: ${data.profile.specialty}`);
  }
  addText(`Klinik: ${data.profile.clinic?.name || '-'}`);
  addText(`Startdatum: ${formatDateSv(data.profile.startDate)}`);
  addText(`Planerat slutdatum: ${formatDateSv(data.profile.plannedEndDate)}`);
  if (data.profile.supervisor) {
    addText(`Handledare: ${data.profile.supervisor.name}`);
  }

  // Progress summary
  const completed = data.subGoalProgress.filter((p: any) => p.status === 'UPPNADD').length;
  const total = data.subGoalProgress.length;
  addSection('DELMALSPROGRESSION');
  addText(`Uppnadda delmal: ${completed} av ${total} (${Math.round((completed / total) * 100)}%)`);

  // By category
  const byCategory: Record<string, { total: number; completed: number }> = {};
  for (const p of data.subGoalProgress) {
    const cat = p.subGoal?.category || 'OVRIGT';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, completed: 0 };
    byCategory[cat].total++;
    if (p.status === 'UPPNADD') byCategory[cat].completed++;
  }

  for (const [cat, stats] of Object.entries(byCategory)) {
    const label = SUBGOAL_CATEGORY_LABELS[cat as keyof typeof SUBGOAL_CATEGORY_LABELS] || cat;
    addText(`  ${label}: ${stats.completed}/${stats.total}`);
  }

  // Rotations
  addSection('PLACERINGAR');
  if (data.rotations.length === 0) {
    addText('Inga placeringar registrerade');
  } else {
    for (const r of data.rotations) {
      const dates = `${formatDateSv(r.startDate)} - ${formatDateSv(r.endDate)}`;
      const status = r.planned ? '(Planerad)' : '';
      addText(`${r.unit} ${status}`);
      addText(`  Period: ${dates}`);
      if (r.specialtyArea) addText(`  Omrade: ${r.specialtyArea}`);
      if (r.supervisorName) addText(`  Handledare: ${r.supervisorName}`);
    }
  }

  // Courses
  addSection('KURSER');
  if (data.courses.length === 0) {
    addText('Inga kurser registrerade');
  } else {
    for (const c of data.courses) {
      addText(`${c.title}`);
      addText(`  Datum: ${formatDateSv(c.startDate)}${c.endDate ? ' - ' + formatDateSv(c.endDate) : ''}`);
      if (c.provider) addText(`  Arrangor: ${c.provider}`);
      if (c.hours) addText(`  Omfattning: ${c.hours} timmar`);
    }
  }

  // Assessments
  addSection('BEDOMNINGAR');
  if (data.assessments.length === 0) {
    addText('Inga bedomningar registrerade');
  } else {
    for (const a of data.assessments) {
      const typeLabel = ASSESSMENT_TYPE_LABELS[a.type as keyof typeof ASSESSMENT_TYPE_LABELS] || a.type;
      const signed = a.signedAt ? ' (Signerad)' : ' (Ej signerad)';
      addText(`${typeLabel} - ${formatDateSv(a.date)}${signed}`);
      if (a.context) addText(`  Kontext: ${a.context}`);
      if (a.rating) addText(`  Betyg: ${a.rating}/5`);
      if (a.assessor) addText(`  Bedomare: ${a.assessor.name}`);
    }
  }

  // Supervision meetings
  addSection('HANDLEDARSAMTAL');
  if (data.supervisionMeetings.length === 0) {
    addText('Inga handledarsamtal registrerade');
  } else {
    for (const m of data.supervisionMeetings) {
      const signed = m.signedAt ? ' (Signerat)' : ' (Ej signerat)';
      addText(`${formatDateSv(m.date)}${signed}`);
      if (m.supervisor) addText(`  Handledare: ${m.supervisor.name}`);
      if (m.agreedActions) addText(`  Overenskomna atgarder: ${m.agreedActions.substring(0, 100)}...`);
    }
  }

  // Certificates
  addSection('INTYG');
  if (data.certificates.length === 0) {
    addText('Inga intyg uppladdade');
  } else {
    for (const c of data.certificates) {
      const typeLabel = CERTIFICATE_TYPE_LABELS[c.type as keyof typeof CERTIFICATE_TYPE_LABELS] || c.type;
      addText(`${typeLabel}: ${c.title || c.fileName}`);
      if (c.issuer) addText(`  Utfardare: ${c.issuer}`);
      if (c.issueDate) addText(`  Utfardandedatum: ${formatDateSv(c.issueDate)}`);
      addText(`  Fil: ${c.fileName}`);
    }
  }

  // Completed subgoals list
  addSection('UPPNADDA DELMAL');
  const completedGoals = data.subGoalProgress.filter((p: any) => p.status === 'UPPNADD');
  if (completedGoals.length === 0) {
    addText('Inga delmal markerade som uppnadda');
  } else {
    for (const p of completedGoals) {
      addText(`${p.subGoal?.code || '-'}: ${p.subGoal?.title || '-'}`);
      if (p.signedBy) {
        addText(`  Signerat av: ${p.signedBy.name} (${p.signedAt ? formatDateSv(p.signedAt) : '-'})`);
      }
    }
  }

  // Footer
  page.drawText('Detta dokument ar genererat fran SAGA - ST/BT Planerings- och Dokumentationssystem', {
    x: margin,
    y: 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdfDoc.save();
}

export async function exportRoutes(fastify: FastifyInstance) {
  // Generate export package
  fastify.get('/package/:traineeProfileId', {
    schema: {
      tags: ['Export'],
      summary: 'Generera exportpaket (PDF + bilagor)',
      params: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId } = request.params as { traineeProfileId: string };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behorighet saknas' });
    }

    // Fetch all data
    const [profile, rotations, courses, assessments, supervisionMeetings, certificates, subGoalProgress] = await Promise.all([
      prisma.traineeProfile.findUnique({
        where: { id: traineeProfileId },
        include: {
          user: { select: { name: true, email: true } },
          clinic: true,
          supervisor: { select: { name: true } },
        },
      }),
      prisma.rotation.findMany({
        where: { traineeProfileId },
        orderBy: { startDate: 'asc' },
      }),
      prisma.course.findMany({
        where: { traineeProfileId },
        orderBy: { startDate: 'asc' },
      }),
      prisma.assessment.findMany({
        where: { traineeProfileId },
        include: { assessor: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.supervisionMeeting.findMany({
        where: { traineeProfileId },
        include: { supervisor: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.certificate.findMany({
        where: { traineeProfileId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.traineeSubGoalProgress.findMany({
        where: { traineeProfileId },
        include: {
          subGoal: true,
          signedBy: { select: { name: true } },
        },
        orderBy: { subGoal: { sortOrder: 'asc' } },
      }),
    ]);

    if (!profile) {
      return reply.status(404).send({ error: 'Profil hittades inte' });
    }

    // Generate PDF
    const pdfBytes = await generateSummaryPDF({
      profile,
      rotations,
      courses,
      assessments,
      supervisionMeetings,
      certificates,
      subGoalProgress,
    });

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Set response headers
    const fileName = `export_${profile.user.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);

    // Pipe archive to response
    reply.send(archive);

    // Add PDF to archive
    archive.append(Buffer.from(pdfBytes), { name: 'sammanstallning.pdf' });

    // Add certificate files to archive
    for (const cert of certificates) {
      const filePath = join(STORAGE_PATH, cert.filePath);
      if (existsSync(filePath)) {
        archive.append(createReadStream(filePath), { name: `intyg/${cert.fileName}` });
      }
    }

    // Finalize archive
    await archive.finalize();

    // Log export
    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Export',
      entityId: traineeProfileId,
      newValue: { type: 'package', traineeProfileId },
    }, request);
  });

  // Generate PDF only
  fastify.get('/pdf/:traineeProfileId', {
    schema: {
      tags: ['Export'],
      summary: 'Generera PDF-sammanstallning',
      params: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId } = request.params as { traineeProfileId: string };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behorighet saknas' });
    }

    // Fetch all data
    const [profile, rotations, courses, assessments, supervisionMeetings, certificates, subGoalProgress] = await Promise.all([
      prisma.traineeProfile.findUnique({
        where: { id: traineeProfileId },
        include: {
          user: { select: { name: true, email: true } },
          clinic: true,
          supervisor: { select: { name: true } },
        },
      }),
      prisma.rotation.findMany({ where: { traineeProfileId }, orderBy: { startDate: 'asc' } }),
      prisma.course.findMany({ where: { traineeProfileId }, orderBy: { startDate: 'asc' } }),
      prisma.assessment.findMany({
        where: { traineeProfileId },
        include: { assessor: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.supervisionMeeting.findMany({
        where: { traineeProfileId },
        include: { supervisor: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.certificate.findMany({ where: { traineeProfileId }, orderBy: { createdAt: 'asc' } }),
      prisma.traineeSubGoalProgress.findMany({
        where: { traineeProfileId },
        include: { subGoal: true, signedBy: { select: { name: true } } },
        orderBy: { subGoal: { sortOrder: 'asc' } },
      }),
    ]);

    if (!profile) {
      return reply.status(404).send({ error: 'Profil hittades inte' });
    }

    const pdfBytes = await generateSummaryPDF({
      profile,
      rotations,
      courses,
      assessments,
      supervisionMeetings,
      certificates,
      subGoalProgress,
    });

    const fileName = `sammanstallning_${profile.user.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.send(Buffer.from(pdfBytes));

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Export',
      entityId: traineeProfileId,
      newValue: { type: 'pdf', traineeProfileId },
    }, request);
  });

  // Get JSON export (for data portability)
  fastify.get('/json/:traineeProfileId', {
    schema: {
      tags: ['Export'],
      summary: 'Exportera data som JSON',
      params: {
        type: 'object',
        required: ['traineeProfileId'],
        properties: {
          traineeProfileId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { traineeProfileId } = request.params as { traineeProfileId: string };
    const user = request.user!;

    if (!(await canAccessTrainee(user.id, user.role, user.clinicId, traineeProfileId))) {
      return reply.status(403).send({ error: 'Behorighet saknas' });
    }

    const data = await prisma.traineeProfile.findUnique({
      where: { id: traineeProfileId },
      include: {
        user: { select: { name: true, email: true } },
        clinic: true,
        supervisor: { select: { name: true, email: true } },
        rotations: { orderBy: { startDate: 'asc' } },
        courses: { orderBy: { startDate: 'asc' } },
        assessments: {
          include: { assessor: { select: { name: true } } },
          orderBy: { date: 'asc' },
        },
        supervisionMeetings: {
          include: { supervisor: { select: { name: true } } },
          orderBy: { date: 'asc' },
        },
        certificates: { orderBy: { createdAt: 'asc' } },
        subGoalProgress: {
          include: { subGoal: true, signedBy: { select: { name: true } } },
          orderBy: { subGoal: { sortOrder: 'asc' } },
        },
      },
    });

    if (!data) {
      return reply.status(404).send({ error: 'Profil hittades inte' });
    }

    return {
      exportedAt: new Date().toISOString(),
      data,
    };
  });
}
