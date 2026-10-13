import { z } from 'zod';
import { isValidTimeZone } from '@mescid/domain';
import { getPool, query, tx } from './db';
import { audit } from './audit';
import { canCreateMosqueIn, canOnMosque, ForbiddenError, mosqueScopeSql, NotFoundError, type Actor, type Permission } from './authz';

export interface PublicMosque {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  postalCode: string;
  timezone: string;
  isDemo: boolean;
}

export interface AdminMosque extends PublicMosque {
  organizationId: string;
  organizationName: string;
  regionId: string | null;
  visibility: 'hidden' | 'public' | 'archived';
  version: number;
}

const PUBLIC_COLS = `m.id, m.slug, m.name, m.city, m.address, m.postal_code, m.timezone, m.is_demo`;

type Row = Record<string, unknown>;
function toPublic(r: Row): PublicMosque {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    city: r.city as string,
    address: r.address as string,
    postalCode: r.postal_code as string,
    timezone: r.timezone as string,
    isDemo: r.is_demo as boolean,
  };
}
function toAdmin(r: Row): AdminMosque {
  return {
    ...toPublic(r),
    organizationId: r.organization_id as string,
    organizationName: r.organization_name as string,
    regionId: (r.region_id as string | null) ?? null,
    visibility: r.visibility as AdminMosque['visibility'],
    version: r.version as number,
  };
}

// ---------- Publiek: alleen zichtbare moskeeën, alleen publieke velden ----------

export async function searchPublicMosques(q: string): Promise<PublicMosque[]> {
  const term = q.trim().slice(0, 100);
  const params: unknown[] = [];
  let where = `m.visibility = 'public'`;
  if (term) {
    // Escape LIKE-tekens zodat invoer als letterlijke tekst wordt gezocht.
    params.push(`%${term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where += ` AND (lower(m.name) LIKE $1 OR lower(m.city) LIKE $1 OR m.postal_code ILIKE $1)`;
  }
  const rows = await query(`SELECT ${PUBLIC_COLS} FROM mosques m WHERE ${where} ORDER BY m.city, m.name LIMIT 50`, params);
  return rows.map(toPublic);
}

export async function getPublicMosqueBySlug(slug: string): Promise<PublicMosque | null> {
  const rows = await query(`SELECT ${PUBLIC_COLS} FROM mosques m WHERE m.slug = $1 AND m.visibility = 'public'`, [slug]);
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function getPublicMosqueById(id: string): Promise<PublicMosque | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const rows = await query(`SELECT ${PUBLIC_COLS} FROM mosques m WHERE m.id = $1 AND m.visibility = 'public'`, [id]);
  return rows[0] ? toPublic(rows[0]) : null;
}

// ---------- Beheer ----------

const ADMIN_SELECT = `SELECT ${PUBLIC_COLS}, m.organization_id, m.region_id, m.visibility, m.version, o.name AS organization_name
  FROM mosques m JOIN organizations o ON o.id = m.organization_id`;

export async function listAdminMosques(actor: Actor): Promise<AdminMosque[]> {
  const params: unknown[] = [];
  const scope = mosqueScopeSql(actor, 'admin.view', params);
  const rows = await query(`${ADMIN_SELECT} WHERE ${scope} AND m.visibility <> 'archived' ORDER BY o.name, m.city, m.name`, params);
  return rows.map(toAdmin);
}

/**
 * Haalt een moskee op voor beheer. Geen toegang en niet bestaand geven bewust dezelfde fout,
 * zodat iemand via een gewijzigd ID niet kan ontdekken welke moskeeën bestaan.
 */
export async function getAdminMosque(actor: Actor, id: string, perm: Permission = 'admin.view'): Promise<AdminMosque> {
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError();
  const rows = await query(`${ADMIN_SELECT} WHERE m.id = $1`, [id]);
  const m = rows[0] ? toAdmin(rows[0]) : null;
  if (!m || !canOnMosque(actor, perm, m)) throw new NotFoundError();
  return m;
}

export async function listCreatableOrganizations(actor: Actor): Promise<{ id: string; name: string }[]> {
  const rows = await query<{ id: string; name: string }>('SELECT id, name FROM organizations ORDER BY name');
  return rows.filter((o) => canCreateMosqueIn(actor, o.id, null));
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug');

export const mosqueInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema,
  city: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).default(''),
  postalCode: z.string().trim().max(20).default(''),
  timezone: z.string().trim().refine(isValidTimeZone, 'timezone'),
  visibility: z.enum(['hidden', 'public']),
});
export type MosqueInput = z.infer<typeof mosqueInputSchema>;

export class ConflictError extends Error {
  constructor(public readonly code: 'stale' | 'slug-taken') {
    super(code);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

export async function createMosque(actor: Actor, organizationId: string, input: MosqueInput): Promise<string> {
  if (!z.string().uuid().safeParse(organizationId).success) throw new ForbiddenError();
  if (!canCreateMosqueIn(actor, organizationId, null)) throw new ForbiddenError();
  try {
    return await tx(async (db) => {
      const org = await db.query('SELECT is_demo FROM organizations WHERE id = $1', [organizationId]);
      if (!org.rows[0]) throw new ForbiddenError();
      const { rows } = await db.query(
        `INSERT INTO mosques (organization_id, slug, name, city, address, postal_code, timezone, visibility, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [organizationId, input.slug, input.name, input.city, input.address, input.postalCode, input.timezone, input.visibility, org.rows[0].is_demo],
      );
      const id = rows[0].id as string;
      await audit(db, { actorUserId: actor.user.id, action: 'mosque.create', entityType: 'mosque', entityId: id, organizationId, mosqueId: id, details: { ...input } });
      return id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('slug-taken');
    throw err;
  }
}

export async function updateMosque(actor: Actor, id: string, expectedVersion: number, input: MosqueInput): Promise<void> {
  const current = await getAdminMosque(actor, id, 'mosque.edit');
  try {
    await tx(async (db) => {
      // Optimistische vergrendeling: alleen bijwerken als niemand anders tussendoor heeft opgeslagen.
      const res = await db.query(
        `UPDATE mosques SET slug=$3, name=$4, city=$5, address=$6, postal_code=$7, timezone=$8, visibility=$9,
           version = version + 1, updated_at = now()
         WHERE id = $1 AND version = $2`,
        [id, expectedVersion, input.slug, input.name, input.city, input.address, input.postalCode, input.timezone, input.visibility],
      );
      if (res.rowCount !== 1) throw new ConflictError('stale');
      await audit(db, {
        actorUserId: actor.user.id,
        action: 'mosque.update',
        entityType: 'mosque',
        entityId: id,
        organizationId: current.organizationId,
        mosqueId: id,
        details: { before: { slug: current.slug, name: current.name, city: current.city, timezone: current.timezone, visibility: current.visibility }, after: input },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('slug-taken');
    throw err;
  }
}

export async function listAuditEvents(actor: Actor, limit = 200) {
  const params: unknown[] = [];
  const scope = mosqueScopeSql(actor, 'audit.view', params);
  const orgIds = actor.assignments.filter((a) => a.role === 'org_admin').map((a) => a.scopeId);
  const isPlatform = actor.assignments.some((a) => a.role === 'platform_admin');
  params.push(orgIds, limit);
  const n = params.length;
  return getPool()
    .query(
      `SELECT e.id, e.at, e.action, e.entity_type, e.entity_id, e.details, u.email AS actor_email, m.name AS mosque_name
       FROM audit_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       LEFT JOIN mosques m ON m.id = e.mosque_id
       WHERE ${isPlatform ? 'TRUE OR ' : ''}((e.mosque_id IS NOT NULL AND ${scope}) OR e.organization_id = ANY($${n - 1}::uuid[]))
       ORDER BY e.at DESC, e.id DESC LIMIT $${n}`,
      params,
    )
    .then((r) => r.rows as { id: string; at: Date; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; actor_email: string | null; mosque_name: string | null }[]);
}
