import 'server-only';
import { addDays, compareDates, isLocalDate, localDateAt, type PrayerDay } from '@mescid/domain';
import { getPublishedDays, getPublishedUntil, toPrayerDay } from '@/server/schedules';
import type { PublicMosque } from '@/server/mosques';

export interface PublicDayMeta {
  date: string;
  sourceKind: string;
  sourceLabel: string;
  publishedAt: string;
  versionId: string;
}

export interface PublicSchedule {
  mosque: PublicMosque;
  /** Lokale datum van "nu" in de moskeetijdzone. */
  today: string;
  nowMs: number;
  days: PrayerDay[];
  meta: PublicDayMeta[];
  validUntil: string | null;
}

/** Maximaal opvraagbare periode in één keer. */
export const MAX_RANGE_DAYS = 62;

export async function loadPublicSchedule(mosque: PublicMosque, from: string, to: string, nowMs = Date.now()): Promise<PublicSchedule> {
  const today = localDateAt(nowMs, mosque.timezone);
  const [rows, validUntil] = await Promise.all([getPublishedDays(mosque.id, from, to), getPublishedUntil(mosque.id)]);
  return {
    mosque,
    today,
    nowMs,
    days: rows.map((r) => toPrayerDay(r.date, r.times)),
    meta: rows.map((r) => ({ date: r.date, sourceKind: r.sourceKind, sourceLabel: r.sourceLabel, publishedAt: r.publishedAt.toISOString(), versionId: r.versionId })),
    validUntil,
  };
}

/** Controleert een gevraagde periode; geeft null bij ongeldige of te lange periodes. */
export function parseRange(from: string | null, to: string | null, today: string): { from: string; to: string } | null {
  const f = from ?? addDays(today, -1);
  const t = to ?? addDays(today, 1);
  if (!isLocalDate(f) || !isLocalDate(t) || compareDates(f, t) > 0) return null;
  if (compareDates(addDays(f, MAX_RANGE_DAYS - 1), t) < 0) return null;
  return { from: f, to: t };
}
