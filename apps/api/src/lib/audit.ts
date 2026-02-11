import { FastifyRequest } from 'fastify';
import { prisma } from './db.js';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SIGN' | 'VOID';

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(
  entry: AuditLogEntry,
  request?: FastifyRequest
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
        ipAddress: entry.ipAddress || request?.ip,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break main operations
  }
}

export async function getAuditLogs(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<unknown[]> {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  });
}
