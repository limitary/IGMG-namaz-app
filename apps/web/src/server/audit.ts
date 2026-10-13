import type { Db } from './db';

export interface AuditInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  mosqueId?: string | null;
  details?: Record<string, unknown>;
}

/** Schrijft een auditregel binnen dezelfde transactie als de wijziging zelf. */
export async function audit(db: Db, a: AuditInput): Promise<void> {
  await db.query(
    `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, organization_id, mosque_id, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [a.actorUserId, a.action, a.entityType, a.entityId ?? null, a.organizationId ?? null, a.mosqueId ?? null, JSON.stringify(a.details ?? {})],
  );
}
