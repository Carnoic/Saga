import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './db.js';
import { UserRole } from '@saga/shared';

const SESSION_COOKIE_NAME = 'saga_session';
const SESSION_EXPIRY_HOURS = 24 * 7; // 7 days

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId?: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as UserRole,
    clinicId: session.user.clinicId,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

export function getSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE_NAME];
}

// Authentication middleware
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = getSessionToken(request);

  if (!token) {
    reply.status(401).send({ error: 'Ej inloggad' });
    return;
  }

  const user = await getSessionUser(token);

  if (!user) {
    clearSessionCookie(reply);
    reply.status(401).send({ error: 'Session utgången' });
    return;
  }

  request.user = user;
}

// Role-based access control
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);

    if (reply.sent) return;

    if (!request.user || !roles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Behörighet saknas' });
      return;
    }
  };
}

// Check if user can access trainee data
export async function canAccessTrainee(
  userId: string,
  userRole: UserRole,
  userClinicId: string | null | undefined,
  traineeProfileId: string
): Promise<boolean> {
  // Admin can access all
  if (userRole === UserRole.ADMIN) return true;

  const traineeProfile = await prisma.traineeProfile.findUnique({
    where: { id: traineeProfileId },
    select: { userId: true, clinicId: true, supervisorId: true },
  });

  if (!traineeProfile) return false;

  // Trainee can access own data
  if (traineeProfile.userId === userId) return true;

  // Supervisor can access assigned trainees
  if (userRole === UserRole.HANDLEDARE && traineeProfile.supervisorId === userId) return true;

  // Study director can access all trainees in their clinic
  if (userRole === UserRole.STUDIEREKTOR && traineeProfile.clinicId === userClinicId) return true;

  return false;
}

// Check write permission
export async function canWriteTrainee(
  userId: string,
  userRole: UserRole,
  userClinicId: string | null | undefined,
  traineeProfileId: string
): Promise<boolean> {
  // Admin can write all
  if (userRole === UserRole.ADMIN) return true;

  const traineeProfile = await prisma.traineeProfile.findUnique({
    where: { id: traineeProfileId },
    select: { userId: true, clinicId: true, supervisorId: true },
  });

  if (!traineeProfile) return false;

  // Trainee can write own data
  if (traineeProfile.userId === userId) return true;

  // Supervisor can write for assigned trainees (for signing etc)
  if (userRole === UserRole.HANDLEDARE && traineeProfile.supervisorId === userId) return true;

  // Study director can write for trainees in their clinic
  if (userRole === UserRole.STUDIEREKTOR && traineeProfile.clinicId === userClinicId) return true;

  return false;
}
