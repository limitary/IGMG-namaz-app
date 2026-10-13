import { localToInstant, isLocalDate, isLocalTime, type DayOffset, type LocalDate, type LocalTime } from './time';

/**
 * Stabiele interne sleutels. Weergavelabels komen uit de vertalingen.
 * Shuruq (zonsopkomst) is een gebeurtenis, geen van de vijf verplichte gebeden.
 */
export const DAY_EVENTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type DayEventKey = (typeof DAY_EVENTS)[number];
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYERS)[number];

export function isPrayer(key: DayEventKey): key is PrayerKey {
  return key !== 'sunrise';
}

export interface TimeRef {
  time: LocalTime;
  dayOffset: DayOffset;
}

export interface DayEntry {
  adhan: TimeRef;
  /** Vast iqama-tijdstip. Ontbreekt = de moskee publiceert voor dit gebed geen iqama. */
  iqama?: TimeRef | null;
}

/** Eén gepubliceerde roosterdag van één moskee. */
export interface PrayerDay {
  date: LocalDate;
  /** Imsak is een afzonderlijk roostergegeven en wordt nooit afgeleid uit Fajr. */
  imsak?: TimeRef | null;
  entries: Record<DayEventKey, DayEntry>;
}

export type IssueCode =
  | 'invalid-date'
  | 'invalid-time'
  | 'invalid-timezone'
  | 'nonexistent-time'
  | 'ambiguous-time'
  | 'offset-not-allowed'
  | 'iqama-not-allowed'
  | 'order'
  | 'iqama-before-adhan'
  | 'iqama-after-next-prayer'
  | 'imsak-after-fajr';

export interface Issue {
  code: IssueCode;
  /** Welk veld, bijvoorbeeld "isha.iqama" of "imsak". */
  field: string;
  severity: 'error' | 'warning';
}

export type EventKind = 'imsak' | 'adhan' | 'iqama';

export interface ResolvedEvent {
  /** Roosterdatum waartoe deze gebeurtenis hoort (kan afwijken van de kalenderdag). */
  scheduleDate: LocalDate;
  key: DayEventKey | 'imsak';
  kind: EventKind;
  time: LocalTime;
  dayOffset: DayOffset;
  epochMs: number;
}

/** Alleen Isha (en de bijbehorende iqama) mag na middernacht vallen. */
function offsetAllowed(key: DayEventKey | 'imsak'): boolean {
  return key === 'isha';
}

function resolveRef(
  date: LocalDate,
  ref: TimeRef,
  tz: string,
  field: string,
  key: DayEventKey | 'imsak',
  issues: Issue[],
): number | null {
  if (!isLocalTime(ref.time)) {
    issues.push({ code: 'invalid-time', field, severity: 'error' });
    return null;
  }
  if (ref.dayOffset !== 0 && ref.dayOffset !== 1) {
    issues.push({ code: 'invalid-time', field, severity: 'error' });
    return null;
  }
  if (ref.dayOffset === 1 && !offsetAllowed(key)) {
    issues.push({ code: 'offset-not-allowed', field, severity: 'error' });
    return null;
  }
  const r = localToInstant(date, ref.time, ref.dayOffset, tz);
  if (r.ok) return r.epochMs;
  const code: IssueCode =
    r.reason === 'nonexistent'
      ? 'nonexistent-time'
      : r.reason === 'ambiguous'
        ? 'ambiguous-time'
        : r.reason === 'invalid-timezone'
          ? 'invalid-timezone'
          : r.reason === 'invalid-date'
            ? 'invalid-date'
            : 'invalid-time';
  issues.push({ code, field, severity: 'error' });
  return null;
}

export interface ResolvedDay {
  date: LocalDate;
  events: ResolvedEvent[];
  issues: Issue[];
  /** Waar als er geen enkele fout (warning mag) in de dag zit. */
  valid: boolean;
}

/**
 * Controleert een roosterdag en zet alle tijden om naar exacte momenten.
 * Een dag met fouten levert `valid: false` op en mag niet gepubliceerd of getoond worden.
 */
export function resolveDay(day: PrayerDay, tz: string): ResolvedDay {
  const issues: Issue[] = [];
  const events: ResolvedEvent[] = [];
  if (!isLocalDate(day.date)) {
    return { date: day.date, events, issues: [{ code: 'invalid-date', field: 'date', severity: 'error' }], valid: false };
  }

  const adhanMs: Partial<Record<DayEventKey, number>> = {};
  for (const key of DAY_EVENTS) {
    const entry = day.entries[key];
    if (!entry) {
      issues.push({ code: 'invalid-time', field: `${key}.adhan`, severity: 'error' });
      continue;
    }
    const ms = resolveRef(day.date, entry.adhan, tz, `${key}.adhan`, key, issues);
    if (ms !== null) {
      adhanMs[key] = ms;
      events.push({ scheduleDate: day.date, key, kind: 'adhan', time: entry.adhan.time, dayOffset: entry.adhan.dayOffset, epochMs: ms });
    }
  }

  // Volgorde van de dag moet strikt oplopend zijn.
  for (let i = 1; i < DAY_EVENTS.length; i++) {
    const prev = adhanMs[DAY_EVENTS[i - 1]!];
    const cur = adhanMs[DAY_EVENTS[i]!];
    if (prev !== undefined && cur !== undefined && cur <= prev) {
      issues.push({ code: 'order', field: `${DAY_EVENTS[i]}.adhan`, severity: 'error' });
    }
  }

  for (let i = 0; i < DAY_EVENTS.length; i++) {
    const key = DAY_EVENTS[i]!;
    const iq = day.entries[key]?.iqama;
    if (!iq) continue;
    const field = `${key}.iqama`;
    if (!isPrayer(key)) {
      issues.push({ code: 'iqama-not-allowed', field, severity: 'error' });
      continue;
    }
    const ms = resolveRef(day.date, iq, tz, field, key, issues);
    if (ms === null) continue;
    const adhan = adhanMs[key];
    if (adhan !== undefined && ms < adhan) {
      issues.push({ code: 'iqama-before-adhan', field, severity: 'error' });
      continue;
    }
    const nextKey = DAY_EVENTS[i + 1];
    const nextAdhan = nextKey ? adhanMs[nextKey] : undefined;
    if (nextAdhan !== undefined && ms >= nextAdhan) {
      issues.push({ code: 'iqama-after-next-prayer', field, severity: 'warning' });
    }
    events.push({ scheduleDate: day.date, key, kind: 'iqama', time: iq.time, dayOffset: iq.dayOffset, epochMs: ms });
  }

  if (day.imsak) {
    const ms = resolveRef(day.date, day.imsak, tz, 'imsak', 'imsak', issues);
    if (ms !== null) {
      const fajr = adhanMs.fajr;
      if (fajr !== undefined && ms > fajr) issues.push({ code: 'imsak-after-fajr', field: 'imsak', severity: 'error' });
      events.push({ scheduleDate: day.date, key: 'imsak', kind: 'imsak', time: day.imsak.time, dayOffset: day.imsak.dayOffset, epochMs: ms });
    }
  }

  events.sort((a, b) => a.epochMs - b.epochMs || kindOrder(a.kind) - kindOrder(b.kind));
  return { date: day.date, events, issues, valid: !issues.some((i) => i.severity === 'error') };
}

/** Vaste prioriteit bij gelijke tijdstippen: imsak, dan adhan, dan iqama. */
function kindOrder(kind: EventKind): number {
  return kind === 'imsak' ? 0 : kind === 'adhan' ? 1 : 2;
}
