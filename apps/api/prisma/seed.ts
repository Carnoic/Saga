import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Norrlands universitetssjukhus',
      organization: 'Region Västerbotten',
    },
  });
  console.log('✅ Clinic created:', clinic.name);

  const clinic2 = await prisma.clinic.create({
    data: {
      name: 'Skellefteå lasarett',
      organization: 'Region Västerbotten',
    },
  });

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@saga.se',
      password: adminPassword,
      name: 'System Admin',
      role: 'ADMIN',
      clinicId: clinic.id,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create study director
  const srPassword = await hashPassword('studierektor123');
  const studierektor = await prisma.user.create({
    data: {
      email: 'studierektor@saga.se',
      password: srPassword,
      name: 'Maria Andersson',
      role: 'STUDIEREKTOR',
      clinicId: clinic.id,
    },
  });
  console.log('✅ Study director created:', studierektor.email);

  // Create supervisors
  const hlPassword = await hashPassword('handledare123');
  const handledare1 = await prisma.user.create({
    data: {
      email: 'handledare1@saga.se',
      password: hlPassword,
      name: 'Erik Johansson',
      role: 'HANDLEDARE',
      clinicId: clinic.id,
    },
  });

  const handledare2 = await prisma.user.create({
    data: {
      email: 'handledare2@saga.se',
      password: hlPassword,
      name: 'Anna Svensson',
      role: 'HANDLEDARE',
      clinicId: clinic.id,
    },
  });
  console.log('✅ Supervisors created');

  // Create goal specification with subgoals
  const goalSpec = await prisma.goalSpec.create({
    data: {
      name: 'ST Allmänmedicin',
      version: '2021',
      specialty: 'Allmänmedicin',
      source: 'Socialstyrelsen',
    },
  });

  // Create 30 subgoals
  const subGoalData = [
    // Medicinsk kompetens (10)
    { code: 'c1', title: 'Akuta och potentiellt livshotande tillstånd', category: 'MEDICINSK_KOMPETENS', sortOrder: 1 },
    { code: 'c2', title: 'Vanliga och viktiga sjukdomar och symtom', category: 'MEDICINSK_KOMPETENS', sortOrder: 2 },
    { code: 'c3', title: 'Kroniska sjukdomar och multimorbiditet', category: 'MEDICINSK_KOMPETENS', sortOrder: 3 },
    { code: 'c4', title: 'Psykisk ohälsa', category: 'MEDICINSK_KOMPETENS', sortOrder: 4 },
    { code: 'c5', title: 'Barn och ungdomars hälsa', category: 'MEDICINSK_KOMPETENS', sortOrder: 5 },
    { code: 'c6', title: 'Äldres hälsa', category: 'MEDICINSK_KOMPETENS', sortOrder: 6 },
    { code: 'c7', title: 'Kvinnors hälsa', category: 'MEDICINSK_KOMPETENS', sortOrder: 7 },
    { code: 'c8', title: 'Läkemedelsbehandling', category: 'MEDICINSK_KOMPETENS', sortOrder: 8 },
    { code: 'c9', title: 'Palliativ vård', category: 'MEDICINSK_KOMPETENS', sortOrder: 9 },
    { code: 'c10', title: 'Preventivt arbete och hälsofrämjande', category: 'MEDICINSK_KOMPETENS', sortOrder: 10 },
    // Kommunikation (6)
    { code: 'b1', title: 'Patientcentrerad konsultation', category: 'KOMMUNIKATION', sortOrder: 11 },
    { code: 'b2', title: 'Information och delat beslutsfattande', category: 'KOMMUNIKATION', sortOrder: 12 },
    { code: 'b3', title: 'Svåra besked', category: 'KOMMUNIKATION', sortOrder: 13 },
    { code: 'b4', title: 'Interkulturell kommunikation', category: 'KOMMUNIKATION', sortOrder: 14 },
    { code: 'b5', title: 'Kommunikation med närstående', category: 'KOMMUNIKATION', sortOrder: 15 },
    { code: 'b6', title: 'Dokumentation', category: 'KOMMUNIKATION', sortOrder: 16 },
    // Ledarskap (5)
    { code: 'a1', title: 'Teamarbete', category: 'LEDARSKAP', sortOrder: 17 },
    { code: 'a2', title: 'Handledning', category: 'LEDARSKAP', sortOrder: 18 },
    { code: 'a3', title: 'Prioritering och resurshushållning', category: 'LEDARSKAP', sortOrder: 19 },
    { code: 'a4', title: 'Patientsäkerhet', category: 'LEDARSKAP', sortOrder: 20 },
    { code: 'a5', title: 'Organisation och administration', category: 'LEDARSKAP', sortOrder: 21 },
    // Vetenskap (5)
    { code: 'd1', title: 'Evidensbaserad medicin', category: 'VETENSKAP', sortOrder: 22 },
    { code: 'd2', title: 'Kritisk granskning', category: 'VETENSKAP', sortOrder: 23 },
    { code: 'd3', title: 'Kvalitetsarbete', category: 'VETENSKAP', sortOrder: 24 },
    { code: 'd4', title: 'Forskningsmetodik', category: 'VETENSKAP', sortOrder: 25 },
    { code: 'd5', title: 'Undervisning', category: 'VETENSKAP', sortOrder: 26 },
    // Professionalism (4)
    { code: 'e1', title: 'Etik och värdegrund', category: 'PROFESSIONALISM', sortOrder: 27 },
    { code: 'e2', title: 'Lagar och förordningar', category: 'PROFESSIONALISM', sortOrder: 28 },
    { code: 'e3', title: 'Egen utveckling', category: 'PROFESSIONALISM', sortOrder: 29 },
    { code: 'e4', title: 'Hållbar läkarroll', category: 'PROFESSIONALISM', sortOrder: 30 },
  ];

  const subGoals = await Promise.all(
    subGoalData.map((sg) =>
      prisma.subGoal.create({
        data: {
          ...sg,
          goalSpecId: goalSpec.id,
          description: `Delmål ${sg.code}: ${sg.title}`,
        },
      })
    )
  );
  console.log('✅ Goal specification with 30 subgoals created');

  // Create trainee 1
  const trainee1Password = await hashPassword('trainee123');
  const trainee1User = await prisma.user.create({
    data: {
      email: 'stlakare1@saga.se',
      password: trainee1Password,
      name: 'Johan Lindqvist',
      role: 'ST_BT',
      clinicId: clinic.id,
    },
  });

  const trainee1Profile = await prisma.traineeProfile.create({
    data: {
      userId: trainee1User.id,
      trackType: 'ST',
      specialty: 'Allmänmedicin',
      clinicId: clinic.id,
      startDate: new Date('2023-03-01'),
      plannedEndDate: new Date('2028-02-28'),
      supervisorId: handledare1.id,
    },
  });

  // Initialize subgoal progress for trainee 1
  await prisma.traineeSubGoalProgress.createMany({
    data: subGoals.map((sg, index) => ({
      traineeProfileId: trainee1Profile.id,
      subGoalId: sg.id,
      status: index < 5 ? 'UPPNADD' : index < 12 ? 'PAGAENDE' : 'EJ_PABORJAD',
    })),
  });

  // Create trainee 2
  const trainee2User = await prisma.user.create({
    data: {
      email: 'btlakare1@saga.se',
      password: trainee1Password,
      name: 'Lisa Karlsson',
      role: 'ST_BT',
      clinicId: clinic.id,
    },
  });

  const trainee2Profile = await prisma.traineeProfile.create({
    data: {
      userId: trainee2User.id,
      trackType: 'BT',
      clinicId: clinic.id,
      startDate: new Date('2024-01-15'),
      plannedEndDate: new Date('2025-07-14'),
      supervisorId: handledare2.id,
    },
  });

  // Initialize subgoal progress for trainee 2
  await prisma.traineeSubGoalProgress.createMany({
    data: subGoals.map((sg, index) => ({
      traineeProfileId: trainee2Profile.id,
      subGoalId: sg.id,
      status: index < 2 ? 'UPPNADD' : index < 6 ? 'PAGAENDE' : 'EJ_PABORJAD',
    })),
  });

  console.log('✅ Trainees created with subgoal progress');

  // Create rotations for trainee 1 (8 rotations)
  const rotations = [
    { unit: 'Medicinkliniken', specialtyArea: 'Internmedicin', startDate: '2023-03-01', endDate: '2023-08-31', planned: false },
    { unit: 'Akutmottagningen', specialtyArea: 'Akutsjukvård', startDate: '2023-09-01', endDate: '2024-02-29', planned: false },
    { unit: 'Vårdcentralen Ålidhem', specialtyArea: 'Allmänmedicin', startDate: '2024-03-01', endDate: '2024-08-31', planned: false },
    { unit: 'Psykiatriska kliniken', specialtyArea: 'Psykiatri', startDate: '2024-09-01', endDate: '2025-02-28', planned: false },
    { unit: 'Barnkliniken', specialtyArea: 'Pediatrik', startDate: '2025-03-01', endDate: '2025-08-31', planned: true },
    { unit: 'Geriatriska kliniken', specialtyArea: 'Geriatrik', startDate: '2025-09-01', endDate: '2026-02-28', planned: true },
    { unit: 'Kvinnokliniken', specialtyArea: 'Gynekologi', startDate: '2026-03-01', endDate: '2026-08-31', planned: true },
    { unit: 'Vårdcentralen Ersboda', specialtyArea: 'Allmänmedicin', startDate: '2026-09-01', endDate: '2027-08-31', planned: true },
  ];

  for (const r of rotations) {
    await prisma.rotation.create({
      data: {
        traineeProfileId: trainee1Profile.id,
        unit: r.unit,
        specialtyArea: r.specialtyArea,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        planned: r.planned,
        supervisorName: r.planned ? undefined : 'Dr. Överläkare',
      },
    });
  }
  console.log('✅ 8 rotations created for trainee 1');

  // Create assessments (10)
  const assessmentTypes = ['DOPS', 'MINI_CEX', 'CBD', 'ANNAT'];
  for (let i = 0; i < 10; i++) {
    const isSigned = i < 6;
    await prisma.assessment.create({
      data: {
        traineeProfileId: trainee1Profile.id,
        type: assessmentTypes[i % 4],
        date: new Date(2023, 3 + i, 15),
        context: `Bedömning ${i + 1}: Patientfall på ${rotations[Math.floor(i / 3)].unit}`,
        assessorId: isSigned ? handledare1.id : undefined,
        rating: 3 + (i % 3),
        narrativeFeedback: `God prestation. ${i % 2 === 0 ? 'Kan förbättra kommunikationen.' : 'Visar god medicinsk kunskap.'}`,
        signedAt: isSigned ? new Date(2023, 3 + i, 20) : undefined,
      },
    });
  }
  console.log('✅ 10 assessments created');

  // Create supervision meetings
  const meetingDates = ['2023-04-15', '2023-07-20', '2023-10-15', '2024-01-20', '2024-04-15'];
  for (let i = 0; i < meetingDates.length; i++) {
    await prisma.supervisionMeeting.create({
      data: {
        traineeProfileId: trainee1Profile.id,
        date: new Date(meetingDates[i]),
        notes: `Handledarsamtal ${i + 1}: Diskuterade progression och kommande delmål.`,
        agreedActions: 'Fortsätta med nuvarande plan. Fokusera på kommunikationsmål.',
        supervisorId: handledare1.id,
        signedAt: i < 4 ? new Date(meetingDates[i]) : undefined,
      },
    });
  }
  console.log('✅ Supervision meetings created');

  // Create courses
  const courses = [
    { title: 'ATLS - Advanced Trauma Life Support', provider: 'Svensk Kirurgisk Förening', hours: 24 },
    { title: 'AKO - Akut kardiologi', provider: 'Svenska Läkarsällskapet', hours: 16 },
    { title: 'Ledarskap i vården', provider: 'Umeå universitet', hours: 40 },
    { title: 'Patientcentrerad konsultation', provider: 'SFAM', hours: 8 },
  ];

  for (let i = 0; i < courses.length; i++) {
    await prisma.course.create({
      data: {
        traineeProfileId: trainee1Profile.id,
        title: courses[i].title,
        provider: courses[i].provider,
        startDate: new Date(2023, 4 + i * 2, 10),
        endDate: new Date(2023, 4 + i * 2, 12),
        hours: courses[i].hours,
      },
    });
  }
  console.log('✅ Courses created');

  // Create certificates (10)
  const certTypes = ['TJANSTGORNINGSINTYG', 'KURSINTYG', 'KOMPETENSBEVIS', 'HANDLEDARINTYG', 'OVRIGT'];
  for (let i = 0; i < 10; i++) {
    await prisma.certificate.create({
      data: {
        traineeProfileId: trainee1Profile.id,
        type: certTypes[i % 5],
        title: `Intyg ${i + 1}`,
        issuer: i % 2 === 0 ? 'Norrlands universitetssjukhus' : 'Umeå universitet',
        issueDate: new Date(2023, 3 + i, 1),
        filePath: `placeholder_${i + 1}.pdf`,
        fileName: `intyg_${i + 1}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 50000 + i * 10000,
        ocrText: `OCR-text för intyg ${i + 1}. Datum: ${new Date(2023, 3 + i, 1).toLocaleDateString('sv-SE')}`,
        ocrProcessedAt: new Date(),
      },
    });
  }
  console.log('✅ 10 certificates created');

  // Add some data for trainee 2 as well
  await prisma.rotation.create({
    data: {
      traineeProfileId: trainee2Profile.id,
      unit: 'Medicinkliniken',
      specialtyArea: 'Internmedicin',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-07-14'),
      planned: false,
    },
  });

  await prisma.assessment.create({
    data: {
      traineeProfileId: trainee2Profile.id,
      type: 'MINI_CEX',
      date: new Date('2024-03-01'),
      context: 'Första bedömningen på medicinkliniken',
      assessorId: handledare2.id,
      rating: 4,
      narrativeFeedback: 'Bra start på BT-tjänstgöringen.',
    },
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Database seeding completed!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Test accounts:');
  console.log('');
  console.log('  Admin:');
  console.log('    Email:    admin@saga.se');
  console.log('    Password: admin123');
  console.log('');
  console.log('  Studierektor:');
  console.log('    Email:    studierektor@saga.se');
  console.log('    Password: studierektor123');
  console.log('');
  console.log('  Handledare:');
  console.log('    Email:    handledare1@saga.se');
  console.log('    Email:    handledare2@saga.se');
  console.log('    Password: handledare123');
  console.log('');
  console.log('  ST-läkare:');
  console.log('    Email:    stlakare1@saga.se');
  console.log('    Password: trainee123');
  console.log('');
  console.log('  BT-läkare:');
  console.log('    Email:    btlakare1@saga.se');
  console.log('    Password: trainee123');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
