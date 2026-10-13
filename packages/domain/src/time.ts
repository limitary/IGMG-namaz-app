import { Temporal } from 'temporal-polyfill';

/** Lokale kloktijd zoals de moskee die publiceert, bijvoorbeeld "05:42". */
export type LocalTime = string;
/** Lokale kalenderdatum, altijd "YYYY-MM-DD". */
export type LocalDate = string;
/** 0 = op de roosterdatum zelf, 1 = na middernacht (de volgende kalenderdag). */
export type DayOffset = 0 | 1;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Strikte datumcontrole: geen raden van formaten, alleen YYYY-MM-DD en een echte kalenderdag. */
export function isLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  try {
    Temporal.PlainDate.from({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, { overflow: 'reject' });
    return true;
  } catch {
    return false;
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    Temporal.Now.instant().toZonedDateTimeISO(tz);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return Temporal.PlainDate.compare(Temporal.PlainDate.from(a), Temporal.PlainDate.from(b));
}

/** Datum in een tijdzone voor een bepaald moment. */
export function localDateAt(epochMs: number, tz: string): LocalDate {
  return Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(tz).toPlainDate().toString();
}

export function localTimeAt(epochMs: number, tz: string): LocalTime {
  const z = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(tz);
  return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
}

export function isoWeekday(date: LocalDate): number {
  return Temporal.PlainDate.from(date).dayOfWeek; // 1 = maandag, 5 = vrijdag, 7 = zondag
}

export type InstantResult =
  | { ok: true; epochMs: number }
  | { ok: false; reason: 'invalid-time' | 'invalid-date' | 'invalid-timezone' | 'nonexistent' | 'ambiguous' };

/**
 * Zet een lokale roostertijd om naar een exact moment.
 * Tijden die door de zomertijdwissel niet bestaan of dubbel voorkomen worden geweigerd,
 * niet stilletjes verschoven.
 */
export function localToInstant(date: LocalDate, time: LocalTime, dayOffset: DayOffset, tz: string): InstantResult {
  if (!isLocalDate(date)) return { ok: false, reason: 'invalid-date' };
  const t = TIME_RE.exec(time);
  if (!t) return { ok: false, reason: 'invalid-time' };
  if (!isValidTimeZone(tz)) return { ok: false, reason: 'invalid-timezone' };
  const day = Temporal.PlainDate.from(date).add({ days: dayOffset });
  const pdt = day.toPlainDateTime({ hour: Number(t[1]), minute: Number(t[2]) });
  const earlier = pdt.toZonedDateTime(tz, { disambiguation: 'earlier' });
  const later = pdt.toZonedDateTime(tz, { disambiguation: 'later' });
  if (earlier.epochMilliseconds === later.epochMilliseconds) {
    return { ok: true, epochMs: earlier.epochMilliseconds };
  }
  // Twee kandidaten: bij een dubbel uur (najaar) hebben beide dezelfde wandkloktijd;
  // bij een overgeslagen uur (voorjaar) heeft geen van beide de gevraagde wandkloktijd.
  const sameWallClock = Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), pdt) === 0;
  return { ok: false, reason: sameWallClock ? 'ambiguous' : 'nonexistent' };
}
