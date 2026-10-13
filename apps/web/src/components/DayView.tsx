'use client';
import { useEffect, useState } from 'react';
import { computeDayStatus, DAY_EVENTS, type PrayerDay, type ResolvedEvent } from '@mescid/domain';
import type { Messages } from '@/i18n/messages';
import { formatCountdown } from './format';

interface Props {
  days: PrayerDay[];
  timezone: string;
  /** Datum die in de tabel getoond wordt. */
  selectedDate: string;
  /** Servertijd bij het renderen, zodat de eerste weergave overeenkomt met de server. */
  initialNowMs: number;
  t: Messages;
  showTable?: boolean;
}

/**
 * Toont de dag en de eerstvolgende gebeurtenissen. De toestand wordt elke seconde opnieuw
 * berekend uit de echte klok (geen aflopende timer), zodat slaapstand of een klokcorrectie geen
 * verouderde countdown oplevert.
 */
export function DayView({ days, timezone, selectedDate, initialNowMs, t, showTable = true }: Props) {
  const [now, setNow] = useState(initialNowMs);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const status = computeDayStatus(days, timezone, now);
  const isToday = status.localDate === selectedDate;
  const day = days.find((d) => d.date === selectedDate) ?? null;
  const name = (e: ResolvedEvent) => t.prayers[e.key];
  const isNext = (key: string) => isToday && status.nextPrayer?.scheduleDate === selectedDate && status.nextPrayer.key === key;

  return (
    <>
      {isToday && status.status === 'ok' && status.nextPrayer && (
        <section className="next" aria-live="polite" aria-label={t.next}>
          <div className="box" data-testid="next-prayer">
            <div className="label">{t.nextPrayer}</div>
            <div className="big">
              {name(status.nextPrayer)} <span className="num">{status.nextPrayer.time}</span>
            </div>
            <div className="num">{formatCountdown(status.nextPrayer.epochMs - now, t)}</div>
          </div>
          <div className="box alt" data-testid="next-iqama">
            <div className="label">{t.nextIqama}</div>
            {status.nextIqama ? (
              <>
                <div className="big">
                  {name(status.nextIqama)} <span className="num">{status.nextIqama.time}</span>
                </div>
                <div className="num">{formatCountdown(status.nextIqama.epochMs - now, t)}</div>
              </>
            ) : (
              <div className="big">—</div>
            )}
          </div>
        </section>
      )}
      {isToday && status.status !== 'ok' && (
        <p className="banner warn" role="status" data-testid="schedule-status">
          {t.status[status.status]}
        </p>
      )}

      {showTable &&
        (day ? (
          <table className="times" data-testid="day-table">
            <caption className="muted small" style={{ textAlign: 'left', captionSide: 'bottom', paddingTop: 8 }}>
              {t.iqamaHelp}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only" />
                </th>
                <th scope="col">{t.adhan}</th>
                <th scope="col">{t.iqama}</th>
              </tr>
            </thead>
            <tbody>
              {day.imsak && (
                <tr className="event">
                  <th scope="row">{t.prayers.imsak}</th>
                  <td className="t">{day.imsak.time}</td>
                  <td className="iq" />
                </tr>
              )}
              {DAY_EVENTS.map((key) => {
                const e = day.entries[key];
                return (
                  <tr key={key} className={`${key === 'sunrise' ? 'event' : ''} ${isNext(key) ? 'is-next' : ''}`} data-prayer={key}>
                    <th scope="row">
                      {t.prayers[key]}
                      {isNext(key) && <span className="sr-only"> ({t.next})</span>}
                    </th>
                    <td className="t">
                      {e.adhan.time}
                      {e.adhan.dayOffset === 1 && <div className="small muted">{t.afterMidnight}</div>}
                    </td>
                    <td className="iq">
                      {e.iqama ? e.iqama.time : key === 'sunrise' ? '' : '—'}
                      {e.iqama?.dayOffset === 1 && <div className="small">{t.afterMidnight}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="banner warn" role="status" data-testid="no-data">
            {t.status.noDataForDate}
          </p>
        ))}
    </>
  );
}
