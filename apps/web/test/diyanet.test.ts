import { describe, expect, test, vi } from 'vitest';
import { resolveDay } from '@mescid/domain';
import { fetchDiyanet, parseDiyanetDate, parseDiyanetResponse, DiyanetParseError } from '../src/server/diyanet';
import { toPrayerDay } from '../src/server/schedules';
import { demoDay } from '../scripts/demo-data';

const day = (o: Record<string, unknown> = {}) => ({
  fajr: '06:12', sunrise: '07:58', dhuhr: '13:27', asr: '16:01', maghrib: '18:45', isha: '20:21',
  gregorianDateShortIso8601: '2027-10-14', ...o,
});

describe('Diyanet-parser', () => {
  test('ondubbelzinnige datums', () => {
    expect(parseDiyanetDate('2027-10-14')).toBe('2027-10-14');
    expect(parseDiyanetDate('2027-10-14T00:00:00')).toBe('2027-10-14');
    expect(parseDiyanetDate('14.10.2027')).toBe('2027-10-14');
  });

  test('dubbelzinnige of foute datums worden geweigerd', () => {
    expect(() => parseDiyanetDate('03/04/2027')).toThrow(DiyanetParseError);
    expect(() => parseDiyanetDate('31.02.2027')).toThrow(DiyanetParseError);
    expect(() => parseDiyanetDate(undefined)).toThrow(DiyanetParseError);
  });

  test('geldig antwoord wordt omgezet; fajr wordt Fajr, geen afgeleide Imsak', () => {
    const [d] = parseDiyanetResponse({ success: true, data: [day()] });
    expect(d!.date).toBe('2027-10-14');
    expect(d!.times.imsak).toBeNull();
    expect(d!.times.entries.fajr.adhan).toEqual({ time: '06:12', dayOffset: 0 });
    expect(resolveDay(toPrayerDay(d!.date, d!.times), 'Europe/Amsterdam').valid).toBe(true);
  });

  test('één foute dag laat de hele import mislukken', () => {
    expect(() => parseDiyanetResponse({ success: true, data: [day(), day({ gregorianDateShortIso8601: '2027-10-15', isha: '8:21' })] })).toThrow(/Dag 2/);
  });

  test('dubbele datum wordt geweigerd', () => {
    expect(() => parseDiyanetResponse({ success: true, data: [day(), day()] })).toThrow(/Dubbele datum/);
  });

  test('onverwacht antwoord wordt geweigerd', () => {
    expect(() => parseDiyanetResponse({ success: false })).toThrow(DiyanetParseError);
    expect(() => parseDiyanetResponse('<html>')).toThrow(DiyanetParseError);
  });

  test('Isha na middernacht wordt niet stil verschoven maar door de controle gemarkeerd', () => {
    const [d] = parseDiyanetResponse({ success: true, data: [day({ maghrib: '22:05', isha: '00:10' })] });
    expect(resolveDay(toPrayerDay(d!.date, d!.times), 'Europe/Amsterdam').valid).toBe(false);
  });
});

describe('Diyanet-koppeling', () => {
  test('staat uit zonder inloggegevens', async () => {
    await expect(fetchDiyanet(1, 'Monthly', {})).rejects.toThrow(/staat uit/);
  });

  test('logt in en haalt tijden op (nagebootste server)', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/Auth/Login')) {
        expect(JSON.parse(String(init?.body))).toEqual({ email: 'a@b.invalid', password: 'x' });
        return new Response(JSON.stringify({ success: true, data: { accessToken: 'tok', refreshToken: 'r' } }));
      }
      expect(u).toBe('https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Monthly/13980');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
      return new Response(JSON.stringify({ success: true, data: [day()] }));
    });
    const days = await fetchDiyanet(13980, 'Monthly', { email: 'a@b.invalid', password: 'x' }, fetchMock as unknown as typeof fetch);
    expect(days).toHaveLength(1);
  });

  test('mislukte login geeft een duidelijke fout', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
    await expect(fetchDiyanet(1, 'Daily', { email: 'a', password: 'b' }, fetchMock as unknown as typeof fetch)).rejects.toThrow(/HTTP 401/);
  });
});

describe('demodata', () => {
  test('fictieve demotijden zijn het hele jaar geldig (ook rond zomer-/wintertijd)', () => {
    for (let i = 0; i < 366 * 2; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const r = resolveDay(toPrayerDay(date, demoDay(date)), 'Europe/Amsterdam');
      expect(r.valid, `${date}: ${JSON.stringify(r.issues)}`).toBe(true);
    }
  });
});
