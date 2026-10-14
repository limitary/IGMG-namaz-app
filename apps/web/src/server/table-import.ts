/**
 * Import van een geplakte of als CSV opgeslagen roostertabel, bijvoorbeeld de maandtabel van
 * namazvakitleri.diyanet.gov.tr (kolommen: datum, [Hicri datum], İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı).
 *
 * Werkwijze: per regel zoeken we één ondubbelzinnige datum en precies zes tijden (UU:MM) in vaste volgorde.
 * Kolomscheiding (tab, puntkomma, komma, spaties) maakt dus niet uit. Er wordt niets geraden:
 * - "03/04/2027" (schuine strepen) wordt geweigerd, want dat kan maart of april zijn;
 * - een regel met tijden maar zonder datum, of met een ander aantal tijden, is een fout;
 * - één foute regel betekent: niets importeren.
 */
import { addMinutes, isLocalDate, type DayOffset } from '@mescid/domain';
import type { DayTimes } from './schedules';

const MONTHS: Record<string, number> = {
  // Turks
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5, haziran: 6, temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9, ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
  // Nederlands
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
  // Engels
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10,
  // Duits (overige maanden zijn gelijk aan Nederlands of Engels)
  januar: 1, februar: 2, märz: 3, maerz: 3, dezember: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Zoekt één datum in een regel. Geeft null als er geen is, of 'ambiguous' bij een niet eenduidige notatie. */
export function findDate(line: string): string | null | 'ambiguous' {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(line);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(line);
  if (dotted) return `${dotted[3]}-${pad(Number(dotted[2]))}-${pad(Number(dotted[1]))}`;
  const words = /\b(\d{1,2})\s+([A-Za-zÀ-ÿĞğİıŞşÇçÖöÜü]+)\s+(\d{4})\b/u.exec(line);
  if (words) {
    const m = MONTHS[words[2]!.toLocaleLowerCase('tr-TR')] ?? MONTHS[words[2]!.toLowerCase()];
    if (m) return `${words[3]}-${pad(m)}-${pad(Number(words[1]))}`;
  }
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(line)) return 'ambiguous';
  return null;
}

const TIME_RE = /(?<![\d:.])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d:.])/g;

export interface TableRowError {
  line: number;
  text: string;
  reason: 'no-date' | 'ambiguous-date' | 'invalid-date' | 'time-count' | 'duplicate-date';
}

export interface IqamaOffsets {
  fajr?: number | null;
  dhuhr?: number | null;
  asr?: number | null;
  maghrib?: number | null;
  isha?: number | null;
}

export interface TableParseResult {
  days: { date: string; times: DayTimes }[];
  errors: TableRowError[];
  skippedLines: number;
}

export const TABLE_ERROR_TEXT: Record<TableRowError['reason'], string> = {
  'no-date': 'tijden gevonden maar geen datum',
  'ambiguous-date': 'datum met schuine strepen is niet eenduidig (gebruik 14.10.2026 of 2026-10-14)',
  'invalid-date': 'datum bestaat niet',
  'time-count': 'niet precies zes tijden (İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı)',
  'duplicate-date': 'deze datum komt dubbel voor',
};

/**
 * Leest een tabel. Regels zonder datum én zonder tijden (kopteksten, lege regels) worden overgeslagen en geteld.
 * Kolomvolgorde van de tijden: İmsak/Fajr, Güneş/zonsopkomst, Öğle/Dhuhr, İkindi/Asr, Akşam/Maghrib, Yatsı/Isha.
 */
export function parseTimetable(text: string, iqama: IqamaOffsets = {}): TableParseResult {
  const days: TableParseResult['days'] = [];
  const errors: TableRowError[] = [];
  const seen = new Set<string>();
  let skippedLines = 0;
  const lines = text.replace(/\r\n?/g, '\n').split('\n').slice(0, 2000);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const lineNo = i + 1;
    const short = line.slice(0, 80);
    if (!line) return;
    const date = findDate(line);
    // Tijden zoeken na het weghalen van de datum, zodat "14.10.2026" niet als tijd "14.10" telt.
    const withoutDate = line
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, ' ')
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ');
    const times = [...withoutDate.matchAll(TIME_RE)].map((m) => `${pad(Number(m[1]))}:${m[2]}`);

    if (date === null) {
      if (times.length > 0) errors.push({ line: lineNo, text: short, reason: 'no-date' });
      else skippedLines++;
      return;
    }
    if (date === 'ambiguous') return void errors.push({ line: lineNo, text: short, reason: 'ambiguous-date' });
    if (!isLocalDate(date)) return void errors.push({ line: lineNo, text: short, reason: 'invalid-date' });
    if (times.length !== 6) return void errors.push({ line: lineNo, text: short, reason: 'time-count' });
    if (seen.has(date)) return void errors.push({ line: lineNo, text: short, reason: 'duplicate-date' });
    seen.add(date);

    const [fajr, sunrise, dhuhr, asr, maghrib, isha] = times as [string, string, string, string, string, string];
    const at = (time: string) => ({ time, dayOffset: 0 as DayOffset });
    const iq = (time: string, minutes: number | null | undefined, allowNextDay: boolean) => {
      if (minutes === null || minutes === undefined) return null;
      const r = addMinutes(time, minutes);
      // Alleen bij Isha mag de iqama over middernacht heen gaan. Bij andere gebeden komt de iqama dan
      // vóór de adhan te liggen, en markeert de controle dat als fout.
      if (r.dayOffset === 1 && !allowNextDay) return { time: r.time, dayOffset: 0 as DayOffset };
      return { time: r.time, dayOffset: r.dayOffset };
    };
    days.push({
      date,
      times: {
        imsak: null,
        entries: {
          fajr: { adhan: at(fajr), iqama: iq(fajr, iqama.fajr, false) },
          sunrise: { adhan: at(sunrise), iqama: null },
          dhuhr: { adhan: at(dhuhr), iqama: iq(dhuhr, iqama.dhuhr, false) },
          asr: { adhan: at(asr), iqama: iq(asr, iqama.asr, false) },
          maghrib: { adhan: at(maghrib), iqama: iq(maghrib, iqama.maghrib, false) },
          isha: { adhan: at(isha), iqama: iq(isha, iqama.isha, true) },
        },
      },
    });
  });

  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days: errors.length ? [] : days, errors, skippedLines };
}
