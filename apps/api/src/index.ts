import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';

import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { traineeRoutes } from './routes/trainees.js';
import { rotationRoutes } from './routes/rotations.js';
import { courseRoutes } from './routes/courses.js';
import { assessmentRoutes } from './routes/assessments.js';
import { supervisionRoutes } from './routes/supervision.js';
import { certificateRoutes } from './routes/certificates.js';
import { subGoalRoutes } from './routes/subgoals.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { exportRoutes } from './routes/export.js';
import { clinicRoutes } from './routes/clinics.js';
import { notificationRoutes } from './routes/notifications.js';
import { startNotificationScheduler } from './lib/notification-service.js';
import { startEmailScheduler } from './lib/email-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const FRONTEND_PATH = join(__dirname, '..', '..', '..', 'web', 'dist');

// Ensure storage directory exists
if (!existsSync(STORAGE_PATH)) {
  mkdirSync(STORAGE_PATH, { recursive: true });
}

const fastify = Fastify({
  logger: IS_PRODUCTION
    ? { level: 'info' }
    : {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
});

async function buildApp() {
  // CORS - in production, same origin so less restrictive
  const corsOrigins = IS_PRODUCTION
    ? true // Allow same origin in production
    : ['http://localhost:5173', 'http://localhost:3000'];

  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  // Cookies
  await fastify.register(cookie, {
    secret: process.env.SESSION_SECRET || 'saga-session-secret-change-in-production',
    hook: 'onRequest',
  });

  // Multipart (file uploads)
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Static files for storage
  await fastify.register(fastifyStatic, {
    root: join(__dirname, '..', '..', STORAGE_PATH),
    prefix: '/storage/',
    decorateReply: false,
  });

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'SAGA API',
        description: 'ST/BT Planerings- och Dokumentationssystem API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Auth', description: 'Autentisering' },
        { name: 'Users', description: 'Användare' },
        { name: 'Trainees', description: 'ST/BT-läkare' },
        { name: 'Rotations', description: 'Placeringar' },
        { name: 'Courses', description: 'Kurser' },
        { name: 'Assessments', description: 'Bedömningar' },
        { name: 'Supervision', description: 'Handledarsamtal' },
        { name: 'Certificates', description: 'Intyg' },
        { name: 'SubGoals', description: 'Delmål' },
        { name: 'Dashboard', description: 'Översikt' },
        { name: 'Export', description: 'Export' },
        { name: 'Notifications', description: 'Notifikationer' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(userRoutes, { prefix: '/api/users' });
  await fastify.register(traineeRoutes, { prefix: '/api/trainees' });
  await fastify.register(rotationRoutes, { prefix: '/api/rotations' });
  await fastify.register(courseRoutes, { prefix: '/api/courses' });
  await fastify.register(assessmentRoutes, { prefix: '/api/assessments' });
  await fastify.register(supervisionRoutes, { prefix: '/api/supervision' });
  await fastify.register(certificateRoutes, { prefix: '/api/certificates' });
  await fastify.register(subGoalRoutes, { prefix: '/api/subgoals' });
  await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await fastify.register(exportRoutes, { prefix: '/api/export' });
  await fastify.register(clinicRoutes, { prefix: '/api/clinics' });
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' });

  // Serve frontend static files in production
  if (IS_PRODUCTION && existsSync(FRONTEND_PATH)) {
    await fastify.register(fastifyStatic, {
      root: FRONTEND_PATH,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback - serve index.html for all non-API routes
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/storage/') || request.url.startsWith('/docs')) {
        reply.status(404).send({ error: 'Not found' });
      } else {
        const indexPath = join(FRONTEND_PATH, 'index.html');
        if (existsSync(indexPath)) {
          const html = readFileSync(indexPath, 'utf-8');
          reply.type('text/html').send(html);
        } else {
          reply.status(404).send({ error: 'Frontend not found' });
        }
      }
    });
  }

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏥 SAGA API Server                                      ║
║   ST/BT Planerings- och Dokumentationssystem              ║
║                                                           ║
║   Server:  http://${HOST}:${PORT}                         ║
║   Docs:    http://localhost:${PORT}/docs                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Start notification scheduler (every 60 minutes)
    startNotificationScheduler(60);

    // Start email scheduler (every 5 minutes)
    startEmailScheduler(5);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
