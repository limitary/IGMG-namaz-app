import type { Db } from './db';
import type { SessionUser } from './auth/session';

export type Role = 'platform_admin' | 'org_admin' | 'region_admin' | 'mosque_admin' | 'editor' | 'publisher';
export type ScopeType = 'platform' | 'organization' | 'region' | 'mosque';

export interface Assignment {
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
}

export interface Actor {
  user: SessionUser;
  assignments: Assignment[];
}

/**
 * Autorisatiematrix. Elke serveractie vraagt één van deze rechten op voor een concrete moskee
 * of organisatie. Verborgen knoppen in de interface zijn nooit de beveiliging.
 */
export type Permission =
  | 'mosque.create'
  | 'mosque.edit'
  | 'schedule.edit'
  | 'schedule.publish'
  | 'audit.view'
  | 'admin.view';

const MATRIX: Record<Permission, Role[]> = {
  'mosque.create': ['platform_admin', 'org_admin', 'region_admin'],
  'mosque.edit': ['platform_admin', 'org_admin', 'region_admin', 'mosque_admin'],
  'schedule.edit': ['platform_admin', 'org_admin', 'region_admin', 'mosque_admin', 'editor'],
  'schedule.publish': ['platform_admin', 'org_admin', 'region_admin', 'mosque_admin', 'publisher'],
  'audit.view': ['platform_admin', 'org_admin', 'region_admin', 'mosque_admin'],
  'admin.view': ['platform_admin', 'org_admin', 'region_admin', 'mosque_admin', 'editor', 'publisher'],
};

export function roleAllows(role: Role, perm: Permission): boolean {
  return MATRIX[perm].includes(role);
}

export interface MosqueScope {
  id: string;
  organizationId: string;
  regionId: string | null;
}

export async function loadAssignments(db: Db, userId: string): Promise<Assignment[]> {
  const { rows } = await db.query('SELECT role, scope_type, scope_id FROM role_assignments WHERE user_id = $1', [userId]);
  return (rows as { role: Role; scope_type: ScopeType; scope_id: string | null }[]).map((r) => ({
    role: r.role,
    scopeType: r.scope_type,
    scopeId: r.scope_id,
  }));
}

/** Mag deze gebruiker `perm` uitvoeren op deze moskee? */
export function canOnMosque(actor: Actor, perm: Permission, m: MosqueScope): boolean {
  return actor.assignments.some((a) => {
    if (!roleAllows(a.role, perm)) return false;
    switch (a.scopeType) {
      case 'platform':
        return true;
      case 'organization':
        return a.scopeId === m.organizationId;
      case 'region':
        return m.regionId !== null && a.scopeId === m.regionId;
      case 'mosque':
        return a.scopeId === m.id;
    }
  });
}

/** Mag deze gebruiker binnen een organisatie (en optioneel een regio) een nieuwe moskee aanmaken? */
export function canCreateMosqueIn(actor: Actor, organizationId: string, regionId: string | null): boolean {
  return actor.assignments.some((a) => {
    if (!roleAllows(a.role, 'mosque.create')) return false;
    if (a.scopeType === 'platform') return true;
    if (a.scopeType === 'organization') return a.scopeId === organizationId;
    if (a.scopeType === 'region') return regionId !== null && a.scopeId === regionId;
    return false;
  });
}

/**
 * SQL-voorwaarde voor lijsten: welke moskeeën (alias `m`) mag deze gebruiker zien voor `perm`.
 * Parameters worden achter `params` aangevuld; de voorwaarde is altijd veilig geparametriseerd.
 */
export function mosqueScopeSql(actor: Actor, perm: Permission, params: unknown[]): string {
  const allowed = actor.assignments.filter((a) => roleAllows(a.role, perm));
  if (allowed.some((a) => a.scopeType === 'platform')) return 'TRUE';
  const ids = (t: ScopeType) => allowed.filter((a) => a.scopeType === t).map((a) => a.scopeId as string);
  params.push(ids('organization'), ids('region'), ids('mosque'));
  const n = params.length;
  return `(m.organization_id = ANY($${n - 2}::uuid[]) OR m.region_id = ANY($${n - 1}::uuid[]) OR m.id = ANY($${n}::uuid[]))`;
}

export class ForbiddenError extends Error {
  constructor() {
    super('Geen toegang');
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('Niet gevonden');
  }
}
