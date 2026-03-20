import { createAuditLog, getAuditLogs } from "./db";
import type { AuditEntityType, AuditLog } from "./types";

export async function recordAuditEvent(input: {
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  summary: string;
  actor?: string;
  details?: string[];
  metadata?: Record<string, unknown>;
}): Promise<AuditLog | null> {
  try {
    return await createAuditLog({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      actor: input.actor ?? "Admin",
      details: input.details,
      metadata: input.metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Audit event failed", error);
    }
    return null;
  }
}

export async function getAuditLogsForEntities(
  entities: Array<{ entityType: AuditEntityType; entityId: string }>,
  limit = 10
): Promise<AuditLog[]> {
  if (entities.length === 0) return [];

  const entityTypes = [...new Set(entities.map((entity) => entity.entityType))];
  const entityIds = [...new Set(entities.map((entity) => entity.entityId))];
  const exactKeys = new Set(
    entities.map((entity) => `${entity.entityType}:${entity.entityId}`)
  );

  const logs = await getAuditLogs({
    entityTypes,
    entityIds,
    limit: Math.max(limit * 4, 20),
  });

  return logs
    .filter((log) => exactKeys.has(`${log.entityType}:${log.entityId}`))
    .slice(0, limit);
}
