import { z } from 'zod';
import {
  addDays,
  checkCoverage,
  compareDates,
  DAY_EVENTS,
  isLocalDate,
  resolveDay,
  type Issue,
  type PrayerDay,
} from '@mescid/domain';
import type { PoolClient } from 'pg';
import { query, tx, type Db } from './db';
import { audit } from './audit';
import { canOnMosque, ForbiddenError, NotFoundError, type Actor } from './authz';
import { ConflictError, getAdminMosque, type AdminMosque } from './mosques';

/** Maximale lengte van één handmatig concept in de beheerinterface. */
export const MAX_DRAFT_DAYS = 62;

const timeRef = z.object({ time: z.string().max(5), dayOffset: z.union([z.literal(0), z.literal(1)]) });
const entry = z.object({ adhan: timeRef, iqama: timeRef.nullable().optional() });
export const dayTimesSchema = z.object({
  imsak: timeRef.nullable().optional(),
  entries: z.object(Object.fromEntries(DAY_EVENTS.map((k) => [k, entry])) as Record<(typeof DAY_EVENTS)[number], typeof entry>),
});
export type DayTimes = z.infer<typeof dayTimesSchema>;

export function emptyDayTimes(): DayTimes {
  return {
    imsak: null,
    entries: Object.fromEntries(DAY_EVENTS.map((k) => [k, { adhan: { time: '', dayOffset: 0 }, iqama: null }])) as DayTimes['entries'],
  };
}

export function toPrayerDay(date: string, times: DayTimes): PrayerDay {
  return { date, imsak: times.imsak ?? null, entries: times.entries as PrayerDay['entries'] };
}

export type VersionStatus = 'draft' | 'published' | 'superseded' | 'discarded';

export interface ScheduleVersion {
  id: string;
  mosqueId: string;
  status: VersionStatus;
  fromDate: string;
  toDate: string;
  note: string;
  sourceKind: 'manual' | 'diyanet' | 'csv';
  sourceLabel: string;
  sourceReference: string;
  createdAt: Date;
  createdBy: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  version: number;
}

const VERSION_SELECT = `SELECT v.id, v.mosque_id, v.status, v.from_date, v.to_date, v.note, v.created_at, v.published_at, v.version,
    s.kind AS source_kind, s.label AS source_label, s.reference AS source_reference,
    cu.email AS created_by, pu.email AS published_by
  FROM schedule_versions v
  JOIN prayer_sources s ON s.id = v.source_id
  LEFT JOIN users cu ON cu.id = v.created_by
  LEFT JOIN users pu ON pu.id = v.published_by`;

function toVersion(r: Record<string, unknown>): ScheduleVersion {
  return {
    id: r.id as string,
    mosqueId: r.mosque_id as string,
    status: r.status as VersionStatus,
    fromDate: r.from_date as string,
    toDate: r.to_date as string,
    note: r.note as string,
    sourceKind: r.source_kind as ScheduleVersion['sourceKind'],
    sourceLabel: r.source_label as string,
    sourceReference: r.source_reference as string,
    createdAt: r.created_at as Date,
    createdBy: (r.created_by as string | null) ?? null,
    publishedAt: (r.published_at as Date | null) ?? null,
    publishedBy: (r.published_by as string | null) ?? null,
    version: r.version as number,
  };
}

// ---------- Validatie ----------

export interface VersionValidation {
  /** Mag gepubliceerd worden: geen fouten, alle dagen aanwezig. */
  publishable: boolean;
  dayIssues: Record<string, Issue[]>;
  missing: string[];
  duplicates: string[];
  errorCount: number;
  warningCount: number;
}

export function validateDays(days: { date: string; times: DayTimes }[], tz: string, from: string, to: string): VersionValidation {
  const dayIssues: Record<string, Issue[]> = {};
  let errorCount = 0;
  let warningCount = 0;
  for (const d of days) {
    const r = resolveDay(toPrayerDay(d.date, d.times), tz);
    if (r.issues.length) dayIssues[d.date] = r.issues;
    for (const i of r.issues) i.severity === 'error' ? errorCount++ : warningCount++;
  }
  const cov = checkCoverage(days.map((d) => d.date), from, to);
  const outside = days.filter((d) => compareDates(d.date, from) < 0 || compareDates(d.date, to) > 0);
  errorCount += cov.missing.length + cov.duplicates.length + cov.invalid.length + outside.length;
  return { publishable: errorCount === 0 && days.length > 0, dayIssues, missing: cov.missing, duplicates: cov.duplicates, errorCount, warningCount };
}

// ---------- Vergelijken ----------

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface VersionDiff {
  /** Datums die nu nog geen gepubliceerd rooster hebben. */
  newDates: string[];
  /** Per datum de gewijzigde velden. */
  changed: Record<string, FieldChange[]>;
  unchangedCount: number;
}

function fmtRef(r: { time: string; dayOffset: number } | null | undefined): string {
  if (!r || !r.time) return '—';
  return r.dayOffset === 1 ? `${r.time} (+1)` : r.time;
}

export function diffWithPublished(draft: { date: string; times: DayTimes }[], published: { date: string; times: DayTimes }[]): VersionDiff {
  const pub = new Map(published.map((p) => [p.date, p.times]));
  const out: VersionDiff = { newDates: [], changed: {}, unchangedCount: 0 };
  for (const d of draft) {
    const before = pub.get(d.date);
    if (!before) {
      out.newDates.push(d.date);
      continue;
    }
    const changes: FieldChange[] = [];
    const cmp = (field: string, a: Parameters<typeof fmtRef>[0], b: Parameters<typeof fmtRef>[0]) => {
      const x = fmtRef(a);
      const y = fmtRef(b);
      if (x !== y) changes.push({ field, before: x, after: y });
    };
    cmp('imsak', before.imsak, d.times.imsak);
    for (const k of DAY_EVENTS) {
      cmp(`${k}.adhan`, before.entries[k]?.adhan, d.times.entries[k]?.adhan);
      cmp(`${k}.iqama`, before.entries[k]?.iqama, d.times.entries[k]?.iqama);
    }
    if (changes.length) out.changed[d.date] = changes;
    else out.unchangedCount++;
  }
  return out;
}

// ---------- Beheer ----------

async function loadVersionForActor(actor: Actor, versionId: string): Promise<{ v: ScheduleVersion; mosque: AdminMosque }> {
  if (!z.string().uuid().safeParse(versionId).success) throw new NotFoundError();
  const rows = await query(`${VERSION_SELECT} WHERE v.id = $1`, [versionId]);
  if (!rows[0]) throw new NotFoundError();
  const v = toVersion(rows[0]);
  const mosque = await getAdminMosque(actor, v.mosqueId, 'admin.view');
  if (!canOnMosque(actor, 'schedule.edit', mosque) && !canOnMosque(actor, 'schedule.publish', mosque)) throw new NotFoundError();
  return { v, mosque };
}

export async function getVersionWithDays(actor: Actor, versionId: string) {
  const { v, mosque } = await loadVersionForActor(actor, versionId);
  const days = await query<{ date: string; times: DayTimes }>('SELECT date, times FROM prayer_days WHERE version_id = $1 ORDER BY date', [v.id]);
  const validation = validateDays(days, mosque.timezone, v.fromDate, v.toDate);
  // Vergelijking met wat bezoekers nu zien, zodat een beheerder vóór publicatie ziet wat er verandert.
  const diff = v.status === 'draft' ? diffWithPublished(days, await getPublishedDays(v.mosqueId, v.fromDate, v.toDate)) : null;
  return {
    version: v,
    mosque,
    days,
    validation,
    diff,
    canEdit: v.status === 'draft' && canOnMosque(actor, 'schedule.edit', mosque),
    canPublish: v.status === 'draft' && canOnMosque(actor, 'schedule.publish', mosque),
  };
}

export async function listVersions(actor: Actor, mosqueId: string): Promise<ScheduleVersion[]> {
  await getAdminMosque(actor, mosqueId, 'admin.view');
  const rows = await query(`${VERSION_SELECT} WHERE v.mosque_id = $1 AND v.status <> 'discarded' ORDER BY v.created_at DESC LIMIT 100`, [mosqueId]);
  return rows.map(toVersion);
}

async function findOrCreateSource(db: Db, mosqueId: string, kind: 'manual' | 'diyanet' | 'csv', label: string, reference: string): Promise<string> {
  const existing = await db.query('SELECT id FROM prayer_sources WHERE mosque_id = $1 AND kind = $2 AND label = $3 AND reference = $4', [mosqueId, kind, label, reference]);
  if (existing.rows[0]) return existing.rows[0].id as string;
  const { rows } = await db.query('INSERT INTO prayer_sources (mosque_id, kind, label, reference) VALUES ($1,$2,$3,$4) RETURNING id', [mosqueId, kind, label, reference]);
  return rows[0].id as string;
}

export const draftInputSchema = z
  .object({
    fromDate: z.string().refine(isLocalDate, 'date'),
    toDate: z.string().refine(isLocalDate, 'date'),
    sourceLabel: z.string().trim().min(2).max(200),
    note: z.string().trim().max(1000).default(''),
  })
  .refine((d) => compareDates(d.fromDate, d.toDate) <= 0, { message: 'range', path: ['toDate'] })
  .refine((d) => compareDates(addDays(d.fromDate, MAX_DRAFT_DAYS - 1), d.toDate) >= 0, { message: 'too-long', path: ['toDate'] });

/** Maakt een leeg handmatig concept. Bestaande gepubliceerde tijden worden als startwaarde overgenomen waar beschikbaar. */
export async function createManualDraft(actor: Actor, mosqueId: string, input: z.infer<typeof draftInputSchema>): Promise<string> {
  const mosque = await getAdminMosque(actor, mosqueId, 'admin.view');
  if (!canOnMosque(actor, 'schedule.edit', mosque)) throw new ForbiddenError();
  const published = await getPublishedDays(mosqueId, input.fromDate, input.toDate);
  const byDate = new Map(published.map((d) => [d.date, d.times]));
  return tx(async (db) => {
    const sourceId = await findOrCreateSource(db, mosqueId, 'manual', input.sourceLabel, '');
    const { rows } = await db.query(
      `INSERT INTO schedule_versions (mosque_id, source_id, from_date, to_date, note, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [mosqueId, sourceId, input.fromDate, input.toDate, input.note, actor.user.id],
    );
    const id = rows[0].id as string;
    for (let d = input.fromDate; compareDates(d, input.toDate) <= 0; d = addDays(d, 1)) {
      await db.query('INSERT INTO prayer_days (version_id, date, times) VALUES ($1,$2,$3)', [id, d, JSON.stringify(byDate.get(d) ?? emptyDayTimes())]);
    }
    await audit(db, { actorUserId: actor.user.id, action: 'schedule.draft.create', entityType: 'schedule_version', entityId: id, organizationId: mosque.organizationId, mosqueId, details: { ...input, prefilledDays: byDate.size } });
    return id;
  });
}

/** Maakt een concept vanuit een externe bron (Diyanet, later CSV). Publiceert nooit automatisch. */
export async function createImportedDraft(
  db: PoolClient,
  args: { mosqueId: string; kind: 'diyanet' | 'csv'; label: string; reference: string; days: { date: string; times: DayTimes }[]; actorUserId: string | null; note?: string },
): Promise<string> {
  if (args.days.length === 0) throw new Error('Geen dagen om te importeren.');
  const dates = args.days.map((d) => d.date).sort();
  const mosque = await db.query('SELECT organization_id FROM mosques WHERE id = $1', [args.mosqueId]);
  if (!mosque.rows[0]) throw new NotFoundError();
  const sourceId = await findOrCreateSource(db, args.mosqueId, args.kind, args.label, args.reference);
  const { rows } = await db.query(
    `INSERT INTO schedule_versions (mosque_id, source_id, from_date, to_date, note, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [args.mosqueId, sourceId, dates[0], dates[dates.length - 1], args.note ?? '', args.actorUserId],
  );
  const id = rows[0].id as string;
  for (const d of args.days) {
    await db.query('INSERT INTO prayer_days (version_id, date, times) VALUES ($1,$2,$3)', [id, d.date, JSON.stringify(dayTimesSchema.parse(d.times))]);
  }
  await audit(db, { actorUserId: args.actorUserId, action: `schedule.import.${args.kind}`, entityType: 'schedule_version', entityId: id, organizationId: mosque.rows[0].organization_id, mosqueId: args.mosqueId, details: { reference: args.reference, days: args.days.length } });
  return id;
}

/** Beheerinterface: maakt een concept uit een geplakte of geüploade tabel. Publiceert nooit. */
export async function createDraftFromTable(
  actor: Actor,
  mosqueId: string,
  args: { label: string; reference: string; days: { date: string; times: DayTimes }[]; note: string },
): Promise<string> {
  const mosque = await getAdminMosque(actor, mosqueId, 'admin.view');
  if (!canOnMosque(actor, 'schedule.edit', mosque)) throw new ForbiddenError();
  if (args.days.length > 400) throw new Error('Te veel dagen in één import (maximaal 400).');
  return tx((db) => createImportedDraft(db, { mosqueId, kind: 'csv', label: args.label, reference: args.reference, days: args.days, actorUserId: actor.user.id, note: args.note }));
}

export async function saveDraftDays(actor: Actor, versionId: string, expectedVersion: number, days: { date: string; times: DayTimes }[]): Promise<void> {
  const { v, mosque } = await loadVersionForActor(actor, versionId);
  if (!canOnMosque(actor, 'schedule.edit', mosque)) throw new ForbiddenError();
  if (v.status !== 'draft') throw new ConflictError('stale');
  await tx(async (db) => {
    const res = await db.query(`UPDATE schedule_versions SET version = version + 1 WHERE id = $1 AND version = $2 AND status = 'draft'`, [versionId, expectedVersion]);
    if (res.rowCount !== 1) throw new ConflictError('stale');
    for (const d of days) {
      const times = dayTimesSchema.parse(d.times);
      // Alleen bestaande dagen binnen dit concept bijwerken; nooit stilletjes rijen toevoegen.
      const r = await db.query('UPDATE prayer_days SET times = $3 WHERE version_id = $1 AND date = $2', [versionId, d.date, JSON.stringify(times)]);
      if (r.rowCount !== 1) throw new Error(`Onbekende datum in concept: ${d.date}`);
    }
    await audit(db, { actorUserId: actor.user.id, action: 'schedule.draft.save', entityType: 'schedule_version', entityId: versionId, organizationId: mosque.organizationId, mosqueId: mosque.id, details: { days: days.length } });
  });
}

export class ValidationFailedError extends Error {
  constructor(public readonly validation: VersionValidation) {
    super('Rooster bevat fouten');
  }
}

/**
 * Publiceert een concept in één transactie: bezoekers zien de oude of de nieuwe versie, nooit een mengsel.
 * De server controleert alles opnieuw; een concept met fouten of ontbrekende dagen wordt geweigerd.
 */
export async function publishVersion(actor: Actor, versionId: string, expectedVersion: number): Promise<void> {
  const { mosque } = await loadVersionForActor(actor, versionId);
  if (!canOnMosque(actor, 'schedule.publish', mosque)) throw new ForbiddenError();
  await tx(async (db) => {
    const locked = await db.query(`SELECT status, version, from_date, to_date FROM schedule_versions WHERE id = $1 FOR UPDATE`, [versionId]);
    const row = locked.rows[0];
    if (!row || row.status !== 'draft' || row.version !== expectedVersion) throw new ConflictError('stale');
    const days = (await db.query('SELECT date, times FROM prayer_days WHERE version_id = $1 ORDER BY date', [versionId])).rows as { date: string; times: DayTimes }[];
    const validation = validateDays(days, mosque.timezone, row.from_date, row.to_date);
    if (!validation.publishable) throw new ValidationFailedError(validation);
    await db.query(
      `UPDATE schedule_versions SET status = 'published', published_at = now(), published_by = $2, publish_seq = nextval('publish_seq'), version = version + 1 WHERE id = $1`,
      [versionId, actor.user.id],
    );
    // Oudere versies die volledig door deze versie worden overschreven, markeren als vervangen.
    const superseded = await db.query(
      `UPDATE schedule_versions SET status = 'superseded' WHERE mosque_id = $1 AND status = 'published' AND id <> $2
         AND from_date >= $3 AND to_date <= $4 RETURNING id`,
      [mosque.id, versionId, row.from_date, row.to_date],
    );
    await audit(db, {
      actorUserId: actor.user.id,
      action: 'schedule.publish',
      entityType: 'schedule_version',
      entityId: versionId,
      organizationId: mosque.organizationId,
      mosqueId: mosque.id,
      details: { from: row.from_date, to: row.to_date, superseded: superseded.rows.map((r) => r.id), warnings: validation.warningCount },
    });
  });
}

export async function discardDraft(actor: Actor, versionId: string, expectedVersion: number): Promise<void> {
  const { mosque } = await loadVersionForActor(actor, versionId);
  if (!canOnMosque(actor, 'schedule.edit', mosque) && !canOnMosque(actor, 'schedule.publish', mosque)) throw new ForbiddenError();
  await tx(async (db) => {
    const res = await db.query(`UPDATE schedule_versions SET status = 'discarded', version = version + 1 WHERE id = $1 AND status = 'draft' AND version = $2`, [versionId, expectedVersion]);
    if (res.rowCount !== 1) throw new ConflictError('stale');
    await audit(db, { actorUserId: actor.user.id, action: 'schedule.draft.discard', entityType: 'schedule_version', entityId: versionId, organizationId: mosque.organizationId, mosqueId: mosque.id });
  });
}

// ---------- Publiek ----------

export interface PublishedDay {
  date: string;
  times: DayTimes;
  versionId: string;
  publishedAt: Date;
  sourceKind: string;
  sourceLabel: string;
}

/**
 * Gepubliceerde tijden per datum. Bij overlap wint de laatst gepubliceerde versie.
 * Concepten zijn hier nooit zichtbaar.
 */
export async function getPublishedDays(mosqueId: string, from: string, to: string): Promise<PublishedDay[]> {
  const rows = await query(
    `SELECT DISTINCT ON (d.date) d.date, d.times, v.id AS version_id, v.published_at, s.kind, s.label
     FROM prayer_days d
     JOIN schedule_versions v ON v.id = d.version_id
     JOIN prayer_sources s ON s.id = v.source_id
     WHERE v.mosque_id = $1 AND v.status IN ('published', 'superseded') AND d.date BETWEEN $2 AND $3
     ORDER BY d.date, v.publish_seq DESC`,
    [mosqueId, from, to],
  );
  return rows.map((r) => ({
    date: r.date as string,
    times: r.times as DayTimes,
    versionId: r.version_id as string,
    publishedAt: r.published_at as Date,
    sourceKind: r.kind as string,
    sourceLabel: r.label as string,
  }));
}

/** Laatste gepubliceerde datum, voor de melding "rooster geldig t/m". */
export async function getPublishedUntil(mosqueId: string): Promise<string | null> {
  const rows = await query<{ max: string | null }>(
    `SELECT max(d.date)::text AS max FROM prayer_days d JOIN schedule_versions v ON v.id = d.version_id
     WHERE v.mosque_id = $1 AND v.status IN ('published', 'superseded')`,
    [mosqueId],
  );
  return rows[0]?.max ?? null;
}
