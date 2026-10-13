import { addDays } from '@mescid/domain';
import type { DayTimes } from '../src/server/schedules';

/**
 * FICTIEVE demotijden. Dit is geen gebedstijdberekening en mag nooit als echte tijd getoond worden.
 * Een eenvoudige golf over het jaar zorgt alleen voor realistisch ogende, oplopende tijden.
 */
export function demoDay(date: string): DayTimes {
  const d = new Date(`${date}T12:00:00Z`);
  const doy = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
  const s = Math.sin(((doy - 80) / 365) * 2 * Math.PI); // -1 winter, +1 zomer
  const hm = (minutes: number) => {
    const m = Math.round(minutes);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const fajr = 5 * 60 - s * 120;
  const sunrise = 7 * 60 + 15 - s * 95;
  const dhuhr = 13 * 60 + 35;
  const asr = 16 * 60 + 5 + s * 110;
  const maghrib = 19 * 60 + 20 + s * 140;
  const isha = Math.min(maghrib + 90 + s * 30, 23 * 60 + 50);
  const t = (m: number) => ({ time: hm(m), dayOffset: 0 as const });
  return {
    imsak: null,
    entries: {
      fajr: { adhan: t(fajr), iqama: t(fajr + 20) },
      sunrise: { adhan: t(sunrise), iqama: null },
      dhuhr: { adhan: t(dhuhr), iqama: t(dhuhr + 15) },
      asr: { adhan: t(asr), iqama: t(asr + 10) },
      maghrib: { adhan: t(maghrib), iqama: t(maghrib + 5) },
      isha: { adhan: t(isha), iqama: t(isha + 5 > 23 * 60 + 59 ? isha : isha + 5) },
    },
  };
}

export function demoRange(from: string, days: number): { date: string; times: DayTimes }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, times: demoDay(date) };
  });
}
