/**
 * Koppeling met de Diyanet Awqat Salah API (https://awqatsalah.diyanet.gov.tr).
 *
 * Belangrijk:
 * - Deze API vereist een eigen account bij Diyanet (e-mail + wachtwoord). Zonder account staat de koppeling uit.
 * - De velden hieronder zijn afgeleid uit openbare clientcode (pydiyanet) en NIET geverifieerd tegen de echte API
 *   vanuit deze ontwikkelomgeving. De parser is daarom streng: onbekende vormen worden geweigerd, niet geraden.
 * - Bezoekers raken Diyanet nooit rechtstreeks: tijden worden als CONCEPT geïmporteerd en pas na menselijke
 *   controle gepubliceerd.
 * - Diyanet noemt de eerste tijd "İmsak"; in de API heet dit veld "fajr". We nemen het over als Fajr en vullen
 *   geen aparte Imsak in. Laat een inhoudelijk verantwoordelijke dit bevestigen.
 */
import { isLocalDate, isLocalTime } from '@mescid/domain';
import type { DayTimes } from './schedules';

export const DIYANET_BASE_URL = 'https://awqatsalah.diyanet.gov.tr';

export interface DiyanetDayRaw {
  fajr?: unknown;
  sunrise?: unknown;
  dhuhr?: unknown;
  asr?: unknown;
  maghrib?: unknown;
  isha?: unknown;
  gregorianDateShortIso8601?: unknown;
  gregorianDateShort?: unknown;
}

export interface ParsedDiyanetDay {
  date: string;
  times: DayTimes;
}

export class DiyanetParseError extends Error {}

/** Accepteert alleen ondubbelzinnige datums: "YYYY-MM-DD" (eventueel met tijddeel) of Turks "DD.MM.YYYY". */
export function parseDiyanetDate(value: unknown): string {
  if (typeof value !== 'string') throw new DiyanetParseError('Datum ontbreekt');
  const iso = /^(\d{4}-\d{2}-\d{2})(T.*)?$/.exec(value.trim());
  if (iso && isLocalDate(iso[1]!)) return iso[1]!;
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (tr) {
    const d = `${tr[3]}-${tr[2]}-${tr[1]}`;
    if (isLocalDate(d)) return d;
  }
  throw new DiyanetParseError(`Onbekend datumformaat: ${value.slice(0, 40)}`);
}

function parseTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isLocalTime(value.trim())) throw new DiyanetParseError(`Ongeldige tijd voor ${field}`);
  return value.trim();
}

/**
 * Zet één Diyanet-dag om naar ons formaat. Een Isha die (in de zomer, hoge breedtegraad) vóór Maghrib lijkt te liggen,
 * wordt NIET automatisch naar na middernacht verschoven: de validatie markeert die dag dan als fout ter controle.
 */
export function parseDiyanetDay(raw: DiyanetDayRaw): ParsedDiyanetDay {
  const date = parseDiyanetDate(raw.gregorianDateShortIso8601 ?? raw.gregorianDateShort);
  const ref = (v: unknown, f: string) => ({ adhan: { time: parseTime(v, f), dayOffset: 0 as const }, iqama: null });
  return {
    date,
    times: {
      imsak: null,
      entries: {
        fajr: ref(raw.fajr, 'fajr'),
        sunrise: ref(raw.sunrise, 'sunrise'),
        dhuhr: ref(raw.dhuhr, 'dhuhr'),
        asr: ref(raw.asr, 'asr'),
        maghrib: ref(raw.maghrib, 'maghrib'),
        isha: ref(raw.isha, 'isha'),
      },
    },
  };
}

/** Verwerkt een volledig API-antwoord ({ success, data: [...] }). Eén foute dag laat de hele import mislukken. */
export function parseDiyanetResponse(body: unknown): ParsedDiyanetDay[] {
  const b = body as { success?: unknown; data?: unknown };
  if (!b || b.success !== true || !Array.isArray(b.data)) throw new DiyanetParseError('Onverwacht antwoord van Diyanet');
  const days = b.data.map((d, i) => {
    try {
      return parseDiyanetDay(d as DiyanetDayRaw);
    } catch (err) {
      throw new DiyanetParseError(`Dag ${i + 1}: ${(err as Error).message}`);
    }
  });
  const seen = new Set<string>();
  for (const d of days) {
    if (seen.has(d.date)) throw new DiyanetParseError(`Dubbele datum ${d.date}`);
    seen.add(d.date);
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export type DiyanetPeriod = 'Daily' | 'Weekly' | 'Monthly';

/** Haalt tijden op met eigen Diyanet-inloggegevens. Gooit een duidelijke fout als die ontbreken. */
export async function fetchDiyanet(cityId: number, period: DiyanetPeriod, creds: { email?: string; password?: string }, fetchImpl: typeof fetch = fetch): Promise<ParsedDiyanetDay[]> {
  if (!creds.email || !creds.password) {
    throw new Error('Diyanet-koppeling staat uit: DIYANET_EMAIL en DIYANET_PASSWORD ontbreken. Vraag een account aan bij Diyanet.');
  }
  if (!Number.isInteger(cityId) || cityId <= 0) throw new Error('Ongeldige Diyanet-plaats-ID');
  const login = await fetchImpl(`${DIYANET_BASE_URL}/Auth/Login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!login.ok) throw new Error(`Diyanet-login mislukt (HTTP ${login.status})`);
  const loginBody = (await login.json()) as { success?: boolean; data?: { accessToken?: string } };
  const token = loginBody.data?.accessToken;
  if (!loginBody.success || !token) throw new Error('Diyanet-login mislukt');
  const res = await fetchImpl(`${DIYANET_BASE_URL}/api/PrayerTime/${period}/${cityId}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Diyanet-tijden ophalen mislukt (HTTP ${res.status})`);
  return parseDiyanetResponse(await res.json());
}
