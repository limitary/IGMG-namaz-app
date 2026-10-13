import { resolveDay, type PrayerDay, type ResolvedDay, type ResolvedEvent } from './day';
import { addDays, localDateAt, type LocalDate } from './time';

export type ScheduleStatus =
  /** Er is een geldig rooster voor vandaag en een volgende gebeurtenis bekend. */
  | 'ok'
  /** Geen (geldig) rooster voor de huidige datum. */
  | 'no-schedule-today'
  /** Alle gebeurtenissen van vandaag zijn voorbij en morgen ontbreekt. */
  | 'schedule-ended'
  /** Tijdzone van de moskee is ongeldig. */
  | 'invalid-timezone';

export interface MosqueDayStatus {
  status: ScheduleStatus;
  /** Lokale kalenderdatum van "nu" in de tijdzone van de moskee. */
  localDate: LocalDate;
  /** De roosterdag voor de lokale datum, als die bestaat en geldig is. */
  today: ResolvedDay | null;
  /** Eerstvolgende gebeurtenis van welke soort dan ook (adhan, zonsopkomst, iqama, imsak). */
  nextEvent: ResolvedEvent | null;
  /** Eerstvolgende adhan van één van de vijf gebeden (zonsopkomst telt niet mee). */
  nextPrayer: ResolvedEvent | null;
  /** Eerstvolgende iqama. Tussen adhan en iqama is dit de iqama van het lopende gebed. */
  nextIqama: ResolvedEvent | null;
  /** Laatst begonnen gebed (adhan voorbij), bijvoorbeeld voor "nu: Dhuhr". */
  currentPrayer: ResolvedEvent | null;
}

/**
 * Berekent de toestand voor één moskee op moment `nowMs`.
 * Puur en deterministisch: de klok wordt meegegeven, zodat app, TV en tests dezelfde uitkomst geven.
 * Er wordt nooit een tijd verzonnen of van een andere dag gekopieerd: ontbrekende dagen leveren een status op.
 */
export function computeDayStatus(days: PrayerDay[], tz: string, nowMs: number): MosqueDayStatus {
  let localDate: LocalDate;
  try {
    localDate = localDateAt(nowMs, tz);
  } catch {
    return { status: 'invalid-timezone', localDate: '', today: null, nextEvent: null, nextPrayer: null, nextIqama: null, currentPrayer: null };
  }

  const byDate = new Map<LocalDate, ResolvedDay>();
  for (const d of days) {
    const r = resolveDay(d, tz);
    if (r.valid) byDate.set(d.date, r);
  }

  const yesterday = byDate.get(addDays(localDate, -1)) ?? null;
  const today = byDate.get(localDate) ?? null;
  const tomorrow = byDate.get(addDays(localDate, 1)) ?? null;

  const empty = { localDate, today, nextEvent: null, nextPrayer: null, nextIqama: null, currentPrayer: null };
  if (!today) return { status: 'no-schedule-today', ...empty };

  // Gisteren telt alleen mee voor gebeurtenissen die na middernacht vallen (Isha met dagverschuiving).
  const all: ResolvedEvent[] = [
    ...(yesterday?.events ?? []),
    ...today.events,
    ...(tomorrow?.events ?? []),
  ].sort((a, b) => a.epochMs - b.epochMs);

  const future = all.filter((e) => e.epochMs > nowMs);
  const nextEvent = future[0] ?? null;
  const nextPrayer = future.find((e) => e.kind === 'adhan' && e.key !== 'sunrise') ?? null;
  const nextIqama = future.find((e) => e.kind === 'iqama') ?? null;
  // Na zonsopkomst is er geen lopend gebed meer tot Dhuhr.
  const pastAdhans = all.filter((e) => e.epochMs <= nowMs && e.kind === 'adhan');
  const last = pastAdhans[pastAdhans.length - 1];
  const currentPrayer = last && last.key !== 'sunrise' ? last : null;

  if (!nextPrayer) {
    return { status: 'schedule-ended', localDate, today, nextEvent, nextPrayer: null, nextIqama, currentPrayer };
  }
  return { status: 'ok', localDate, today, nextEvent, nextPrayer, nextIqama, currentPrayer };
}
