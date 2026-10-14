import { describe, expect, test } from 'vitest';
import { resolveDay } from '@mescid/domain';
import { findDate, parseTimetable } from '../src/server/table-import';
import { toPrayerDay, diffWithPublished } from '../src/server/schedules';

// Fictieve tijden in de vorm van een gekopieerde maandtabel (kolommen: datum, Hicri datum, 6 tijden).
const PASTED = `Miladi Tarih\tHicri Tarih\tİmsak\tGüneş\tÖğle\tİkindi\tAkşam\tYatsı
14 Ekim 2026 Çarşamba\t3 Rebiülahir 1448\t06:12\t07:58\t13:27\t16:01\t18:45\t20:21
15 Ekim 2026 Perşembe\t4 Rebiülahir 1448\t06:14\t08:00\t13:27\t15:59\t18:43\t20:19
`;

describe('datum herkennen', () => {
  test('ondubbelzinnige notaties', () => {
    expect(findDate('14.10.2026 x')).toBe('2026-10-14');
    expect(findDate('2026-10-14')).toBe('2026-10-14');
    expect(findDate('14 Ekim 2026 Çarşamba')).toBe('2026-10-14');
    expect(findDate('1 Şubat 2027')).toBe('2027-02-01');
    expect(findDate('3 Ağustos 2027')).toBe('2027-08-03');
    expect(findDate('14 oktober 2026')).toBe('2026-10-14');
    expect(findDate('14 October 2026')).toBe('2026-10-14');
  });
  test('schuine strepen zijn niet eenduidig', () => {
    expect(findDate('03/04/2027 05:00')).toBe('ambiguous');
  });
  test('geen datum', () => {
    expect(findDate('İmsak Güneş Öğle')).toBeNull();
  });
});

describe('tabel inlezen', () => {
  test('gekopieerde Diyanet-maandtabel met kopregel en Hicri-kolom', () => {
    const r = parseTimetable(PASTED);
    expect(r.errors).toEqual([]);
    expect(r.skippedLines).toBe(1);
    expect(r.days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-15']);
    const e = r.days[0]!.times.entries;
    expect([e.fajr.adhan.time, e.sunrise.adhan.time, e.dhuhr.adhan.time, e.asr.adhan.time, e.maghrib.adhan.time, e.isha.adhan.time]).toEqual([
      '06:12', '07:58', '13:27', '16:01', '18:45', '20:21',
    ]);
    expect(e.dhuhr.iqama).toBeNull();
    expect(r.days[0]!.times.imsak).toBeNull();
    for (const d of r.days) expect(resolveDay(toPrayerDay(d.date, d.times), 'Europe/Amsterdam').valid).toBe(true);
  });

  test('CSV met puntkomma en tijden zonder voorloopnul', () => {
    const r = parseTimetable('datum;imsak;gunes;ogle;ikindi;aksam;yatsi\n14.10.2026;6:12;7:58;13:27;16:01;18:45;20:21');
    expect(r.errors).toEqual([]);
    expect(r.days[0]!.times.entries.fajr.adhan.time).toBe('06:12');
  });

  test('Hicri-datum met punten telt niet als tijd', () => {
    const r = parseTimetable('14.10.2026 03.04.1448 06:12 07:58 13:27 16:01 18:45 20:21');
    expect(r.errors).toEqual([]);
    expect(r.days[0]!.times.entries.fajr.adhan.time).toBe('06:12');
  });

  test('iqama-minuten worden toegepast, Isha mag over middernacht', () => {
    const r = parseTimetable('2027-06-20 03:10 05:18 13:45 18:05 22:05 23:50', { fajr: 20, dhuhr: 15, isha: 15 });
    const e = r.days[0]!.times.entries;
    expect(e.fajr.iqama).toEqual({ time: '03:30', dayOffset: 0 });
    expect(e.dhuhr.iqama).toEqual({ time: '14:00', dayOffset: 0 });
    expect(e.asr.iqama).toBeNull();
    expect(e.isha.iqama).toEqual({ time: '00:05', dayOffset: 1 });
    expect(resolveDay(toPrayerDay('2027-06-20', r.days[0]!.times), 'Europe/Amsterdam').valid).toBe(true);
  });

  test('één foute regel: niets importeren, met regelnummer', () => {
    const r = parseTimetable(`${PASTED}16 Ekim 2026 Cuma\t5 Rebiülahir 1448\t06:15\t08:01\t13:26\t15:57\t18:41`);
    expect(r.days).toEqual([]);
    expect(r.errors).toEqual([expect.objectContaining({ line: 4, reason: 'time-count' })]);
  });

  test('dubbelzinnige datum, ontbrekende datum, dubbele datum en niet-bestaande datum', () => {
    expect(parseTimetable('03/04/2027 06:12 07:58 13:27 16:01 18:45 20:21').errors[0]!.reason).toBe('ambiguous-date');
    expect(parseTimetable('06:12 07:58 13:27 16:01 18:45 20:21').errors[0]!.reason).toBe('no-date');
    expect(parseTimetable('31.02.2027 06:12 07:58 13:27 16:01 18:45 20:21').errors[0]!.reason).toBe('invalid-date');
    const dup = '14.10.2026 06:12 07:58 13:27 16:01 18:45 20:21\n14.10.2026 06:12 07:58 13:27 16:01 18:45 20:21';
    expect(parseTimetable(dup).errors[0]!.reason).toBe('duplicate-date');
  });

  test('lege invoer geeft geen dagen en geen fouten', () => {
    expect(parseTimetable('\n\n')).toEqual({ days: [], errors: [], skippedLines: 0 });
  });
});

describe('verschil met gepubliceerd rooster', () => {
  test('gewijzigde, ongewijzigde en nieuwe dagen', () => {
    const [a, b] = parseTimetable(PASTED).days;
    const changedB = structuredClone(b!);
    changedB.times.entries.fajr.adhan.time = '06:20';
    const diff = diffWithPublished([a!, changedB, { date: '2026-10-16', times: a!.times }], [a!, b!]);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.newDates).toEqual(['2026-10-16']);
    expect(diff.changed['2026-10-15']).toEqual([{ field: 'fajr.adhan', before: '06:14', after: '06:20' }]);
  });
});
