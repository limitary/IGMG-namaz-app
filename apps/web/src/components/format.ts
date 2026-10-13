import type { Messages } from '@/i18n/messages';

/** "over 1 u 05 min" — altijd naar boven afgerond op hele minuten, nooit negatief. */
export function formatCountdown(ms: number, t: Messages): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  if (totalMin < 1) return `${t.in} <1 ${t.minutesShort}`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${t.in} ${h} ${t.hoursShort} ${String(m).padStart(2, '0')} ${t.minutesShort}` : `${t.in} ${m} ${t.minutesShort}`;
}

export function formatDate(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

export function formatDateShort(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}
