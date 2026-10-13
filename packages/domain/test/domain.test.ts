import { describe, expect, test } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  checkCoverage,
  computeDayStatus,
  isLocalDate,
  localToInstant,
  resolveDay,
  type PrayerDay,
  type TimeRef,
} from '../src';

const AMS = 'Europe/Amsterdam';
const t = (time: string, dayOffset: 0 | 1 = 0): TimeRef => ({ time, dayOffset });

/** Fictieve testtijden, geen echte roosterdata. */
function day(date: string, o: Partial<Record<string, TimeRef | null>> = {}, iqama: Partial<Record<string, TimeRef>> = {}): PrayerDay {
  const base = { fajr: t('06:00'), sunrise: t('07:30'), dhuhr: t('13:30'), asr: t('16:30'), maghrib: t('19:00'), isha: t('20:30') };
  const entries = Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, { adhan: (o[k] as TimeRef) ?? v, iqama: iqama[k] ?? null }]),
  ) as PrayerDay['entries'];
  return { date, entries, imsak: (o.imsak as TimeRef | undefined) ?? null };
}

/** Moment op een lokale wandkloktijd in Amsterdam. */
function at(date: string, time: string, tz = AMS): number {
  return Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(tz).epochMilliseconds;
}

describe('datum en tijd', () => {
  test('alleen echte kalenderdatums in YYYY-MM-DD', () => {
    expect(isLocalDate('2028-02-29')).toBe(true); // schrikkeldag
    expect(isLocalDate('2027-02-29')).toBe(false);
    expect(isLocalDate('03/04/2027')).toBe(false); // geen raden tussen maart en april
    expect(isLocalDate('2027-4-3')).toBe(false);
  });

  test('zomertijd: niet-bestaande tijd wordt geweigerd', () => {
    // 28 maart 2027: in Amsterdam springt de klok van 02:00 naar 03:00.
    expect(localToInstant('2027-03-28', '02:30', 0, AMS)).toEqual({ ok: false, reason: 'nonexistent' });
  });

  test('wintertijd: dubbel voorkomende tijd wordt geweigerd', () => {
    // 31 oktober 2027: 02:00-03:00 komt twee keer voor.
    expect(localToInstant('2027-10-31', '02:30', 0, AMS)).toEqual({ ok: false, reason: 'ambiguous' });
  });

  test('zomer- en wintertijd zonder handmatige correctie', () => {
    const winter = localToInstant('2027-01-15', '12:00', 0, AMS);
    const summer = localToInstant('2027-07-15', '12:00', 0, AMS);
    expect(winter.ok && new Date(winter.epochMs).toISOString()).toBe('2027-01-15T11:00:00.000Z');
    expect(summer.ok && new Date(summer.epochMs).toISOString()).toBe('2027-07-15T10:00:00.000Z');
  });

  test('onbekende tijdzone', () => {
    expect(localToInstant('2027-01-15', '12:00', 0, 'Europe/Nergensland')).toEqual({ ok: false, reason: 'invalid-timezone' });
  });
});

describe('roosterdag controleren', () => {
  test('een normale dag is geldig', () => {
    const r = resolveDay(day('2027-01-15', {}, { dhuhr: t('13:45') }), AMS);
    expect(r.valid).toBe(true);
    expect(r.events.map((e) => `${e.key}:${e.kind}`)).toEqual([
      'fajr:adhan', 'sunrise:adhan', 'dhuhr:adhan', 'dhuhr:iqama', 'asr:adhan', 'maghrib:adhan', 'isha:adhan',
    ]);
  });

  test('verkeerde volgorde is een fout, wordt niet stil gerepareerd', () => {
    const r = resolveDay(day('2027-01-15', { isha: t('18:00') }), AMS);
    expect(r.valid).toBe(false);
    expect(r.issues).toContainEqual({ code: 'order', field: 'isha.adhan', severity: 'error' });
  });

  test('iqama vóór adhan is een fout', () => {
    const r = resolveDay(day('2027-01-15', {}, { asr: t('16:00') }), AMS);
    expect(r.issues).toContainEqual({ code: 'iqama-before-adhan', field: 'asr.iqama', severity: 'error' });
  });

  test('iqama voor zonsopkomst bestaat niet', () => {
    const r = resolveDay(day('2027-01-15', {}, { sunrise: t('07:40') }), AMS);
    expect(r.valid).toBe(false);
  });

  test('alleen Isha mag na middernacht vallen', () => {
    expect(resolveDay(day('2027-06-20', { isha: t('00:20', 1) }), AMS).valid).toBe(true);
    expect(resolveDay(day('2027-06-20', { maghrib: t('00:10', 1) }), AMS).valid).toBe(false);
  });

  test('ongeldige tijdnotatie', () => {
    expect(resolveDay(day('2027-01-15', { fajr: t('6:00') }), AMS).valid).toBe(false);
    expect(resolveDay(day('2027-01-15', { fajr: t('24:00') }), AMS).valid).toBe(false);
  });

  test('imsak is los en mag niet na Fajr liggen', () => {
    expect(resolveDay(day('2027-01-15', { imsak: t('05:50') }), AMS).valid).toBe(true);
    expect(resolveDay(day('2027-01-15', { imsak: t('06:10') }), AMS).valid).toBe(false);
  });

  test('tijd in het overgeslagen zomertijd-uur wordt een fout', () => {
    const r = resolveDay(day('2027-03-28', { fajr: t('02:30') }), AMS);
    expect(r.issues).toContainEqual({ code: 'nonexistent-time', field: 'fajr.adhan', severity: 'error' });
  });
});

describe('volgend gebed en volgende iqama', () => {
  const days = [
    day('2027-01-14'),
    day('2027-01-15', {}, { fajr: t('06:30'), dhuhr: t('13:45'), isha: t('20:45') }),
    day('2027-01-16'),
  ];

  test('klok vóór het eerste gebed', () => {
    const s = computeDayStatus(days, AMS, at('2027-01-15', '03:00'));
    expect(s.status).toBe('ok');
    expect(s.nextPrayer?.key).toBe('fajr');
    expect(s.nextPrayer?.scheduleDate).toBe('2027-01-15');
    expect(s.currentPrayer?.key).toBe('isha'); // Isha van gisteren loopt nog
  });

  test('precies op het adhan-moment is het volgende gebed het volgende', () => {
    const s = computeDayStatus(days, AMS, at('2027-01-15', '13:30'));
    expect(s.currentPrayer?.key).toBe('dhuhr');
    expect(s.nextPrayer?.key).toBe('asr');
    // Tussen adhan en iqama: de volgende iqama is die van Dhuhr, niet die van Asr.
    expect(s.nextIqama?.key).toBe('dhuhr');
  });

  test('precies op het iqama-moment is die iqama voorbij', () => {
    const s = computeDayStatus(days, AMS, at('2027-01-15', '13:45'));
    expect(s.nextIqama?.key).toBe('isha');
  });

  test('zonsopkomst is een gebeurtenis maar geen gebed', () => {
    const s = computeDayStatus(days, AMS, at('2027-01-15', '07:00'));
    expect(s.nextEvent?.key).toBe('sunrise');
    expect(s.nextPrayer?.key).toBe('dhuhr');
    const after = computeDayStatus(days, AMS, at('2027-01-15', '08:00'));
    expect(after.currentPrayer).toBeNull();
  });

  test('na de laatste Isha: Fajr van morgen', () => {
    const s = computeDayStatus(days, AMS, at('2027-01-15', '22:00'));
    expect(s.nextPrayer?.key).toBe('fajr');
    expect(s.nextPrayer?.scheduleDate).toBe('2027-01-16');
  });

  test('ontbrekende dag van morgen: geen verzonnen tijden', () => {
    const s = computeDayStatus(days.slice(0, 2), AMS, at('2027-01-15', '22:00'));
    expect(s.status).toBe('schedule-ended');
    expect(s.nextPrayer).toBeNull();
  });

  test('geen rooster voor vandaag', () => {
    const s = computeDayStatus(days, AMS, at('2027-01-20', '12:00'));
    expect(s.status).toBe('no-schedule-today');
    expect(s.nextPrayer).toBeNull();
  });

  test('ontbrekend nieuw jaar: geen hergebruik van het oude jaarrooster', () => {
    const s = computeDayStatus([day('2027-12-31'), day('2027-01-01')], AMS, at('2027-12-31', '23:00'));
    expect(s.status).toBe('schedule-ended');
  });

  test('ongeldige dag telt als ontbrekend', () => {
    const s = computeDayStatus([day('2027-01-15', { isha: t('18:00') })], AMS, at('2027-01-15', '12:00'));
    expect(s.status).toBe('no-schedule-today');
  });
});

describe('Isha na middernacht', () => {
  // Hoge zomer: Isha en iqama vallen na middernacht maar horen bij de roosterdatum 20 juni.
  const days = [
    day('2027-06-20', { fajr: t('03:10'), sunrise: t('05:18'), dhuhr: t('13:45'), asr: t('18:05'), maghrib: t('22:05'), isha: t('00:15', 1) }, { isha: t('00:30', 1) }),
    day('2027-06-21', { fajr: t('03:12'), sunrise: t('05:18'), dhuhr: t('13:45'), asr: t('18:05'), maghrib: t('22:06'), isha: t('00:16', 1) }),
  ];

  test('om 00:05 is de volgende Isha nog die van 20 juni', () => {
    const s = computeDayStatus(days, AMS, at('2027-06-21', '00:05'));
    expect(s.status).toBe('ok');
    expect(s.localDate).toBe('2027-06-21');
    expect(s.nextPrayer?.key).toBe('isha');
    expect(s.nextPrayer?.scheduleDate).toBe('2027-06-20');
    expect(s.nextPrayer!.epochMs).toBeGreaterThan(at('2027-06-21', '00:05'));
  });

  test('tussen Isha en iqama na middernacht wijst de iqama-countdown naar 00:30', () => {
    const s = computeDayStatus(days, AMS, at('2027-06-21', '00:20'));
    expect(s.nextIqama?.key).toBe('isha');
    expect(s.nextIqama?.time).toBe('00:30');
    expect(s.nextPrayer?.key).toBe('fajr');
    expect(s.nextPrayer?.scheduleDate).toBe('2027-06-21');
  });

  test('geen negatieve of terugspringende countdown', () => {
    for (const time of ['23:59', '00:00', '00:14', '00:15', '00:16', '00:31', '03:09']) {
      const date = time.startsWith('23') ? '2027-06-20' : '2027-06-21';
      const now = at(date, time);
      const s = computeDayStatus(days, AMS, now);
      expect(s.nextPrayer!.epochMs).toBeGreaterThan(now);
    }
  });
});

describe('gebruiker en moskee in verschillende tijdzones', () => {
  test('de moskeetijdzone bepaalt de dag, niet de tijdzone van het apparaat', () => {
    const days = [day('2027-01-15'), day('2027-01-16')];
    // 23:30 UTC op de 15e is al 00:30 op de 16e in Amsterdam.
    const now = Date.UTC(2027, 0, 15, 23, 30);
    const s = computeDayStatus(days, AMS, now);
    expect(s.localDate).toBe('2027-01-16');
    expect(s.nextPrayer?.scheduleDate).toBe('2027-01-16');
  });

  test('ongeldige tijdzone geeft een status, geen crash', () => {
    expect(computeDayStatus([day('2027-01-15')], 'Nergens/Stad', Date.now()).status).toBe('invalid-timezone');
  });
});

describe('roosterdekking', () => {
  test('dubbele, ontbrekende en ongeldige datums', () => {
    const r = checkCoverage(['2028-02-27', '2028-02-27', '2028-03-01', '2028-02-30'], '2028-02-27', '2028-03-01');
    expect(r.duplicates).toEqual(['2028-02-27']);
    expect(r.missing).toEqual(['2028-02-28', '2028-02-29']);
    expect(r.invalid).toEqual(['2028-02-30']);
  });
});
