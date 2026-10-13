import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, compareDates, isLocalDate, localDateAt } from '@mescid/domain';
import { getMessages } from '@/i18n/server';
import { getPublicMosqueBySlug } from '@/server/mosques';
import { loadPublicSchedule } from '@/lib/public-data';
import { DayView } from '@/components/DayView';
import { FavoriteButton } from '@/components/FavoriteButton';
import { formatDate, formatDateShort } from '@/components/format';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ datum?: string | string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = await getPublicMosqueBySlug((await params).slug);
  return { title: m?.name ?? 'Moskee' };
}

export default async function MosquePage({ params, searchParams }: Params) {
  const { locale, t } = await getMessages();
  const mosque = await getPublicMosqueBySlug((await params).slug);
  if (!mosque) notFound();

  const nowMs = Date.now();
  const today = localDateAt(nowMs, mosque.timezone);
  const raw = (await searchParams).datum;
  const asked = Array.isArray(raw) ? raw[0] : raw;
  // Alleen geldige datums binnen ruim een jaar; anders gewoon vandaag.
  const selected =
    asked && isLocalDate(asked) && compareDates(asked, addDays(today, -370)) >= 0 && compareDates(asked, addDays(today, 400)) <= 0 ? asked : today;

  const from = compareDates(selected, today) < 0 ? addDays(selected, -1) : addDays(today, -1);
  const to = compareDates(addDays(selected, 7), addDays(today, 1)) > 0 ? addDays(selected, 7) : addDays(today, 1);
  const data = await loadPublicSchedule(mosque, from, to, nowMs);
  const meta = data.meta.find((d) => d.date === selected);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(selected, i));
  const dayByDate = new Map(data.days.map((d) => [d.date, d]));
  const href = (d: string) => (d === today ? `/m/${mosque.slug}` : `/m/${mosque.slug}?datum=${d}`);

  return (
    <div className="container">
      {mosque.isDemo && (
        <p className="banner warn" role="note" data-testid="demo-banner">
          <strong>{t.demo}:</strong> {t.demoBanner}
        </p>
      )}
      <div className="row spread">
        <h1 data-testid="mosque-name">{mosque.name}</h1>
        <FavoriteButton mosque={{ id: mosque.id, slug: mosque.slug, name: mosque.name }} t={t} />
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {[mosque.address, mosque.postalCode, mosque.city].filter(Boolean).join(', ')}
        {mosque.address && !mosque.isDemo && (
          <>
            {' · '}
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([mosque.address, mosque.postalCode, mosque.city].join(' '))}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t.route}
            </a>
          </>
        )}
      </p>

      <nav className="daynav" aria-label={t.date}>
        <Link href={href(addDays(selected, -1))} className="btn secondary" rel="nofollow" aria-label={t.prevDay}>
          ← <span className="lbl">{t.prevDay}</span>
        </Link>
        <strong data-testid="selected-date">{selected === today ? `${t.today}, ` : ''}{formatDate(selected, locale)}</strong>
        <Link href={href(addDays(selected, 1))} className="btn secondary" rel="nofollow" aria-label={t.nextDay}>
          <span className="lbl">{t.nextDay}</span> →
        </Link>
      </nav>
      {selected !== today && (
        <p>
          <Link href={href(today)}>{t.backToToday}</Link>
        </p>
      )}

      <div className="card">
        <DayView days={data.days} timezone={mosque.timezone} selectedDate={selected} initialNowMs={nowMs} t={t} />
        <dl className="small muted" style={{ marginBottom: 0 }} data-testid="source-info">
          {meta && (
            <div>
              <dt style={{ display: 'inline', fontWeight: 600 }}>{t.source}: </dt>
              <dd style={{ display: 'inline', margin: 0 }}>
                {meta.sourceLabel} ({t.publishedOn} {formatDate(meta.publishedAt.slice(0, 10), locale)})
              </dd>
            </div>
          )}
          <div>
            <dt style={{ display: 'inline', fontWeight: 600 }}>{t.timezone}: </dt>
            <dd style={{ display: 'inline', margin: 0 }}>
              {mosque.timezone} · {t.timesShownIn}
            </dd>
          </div>
          {data.validUntil && (
            <div>
              <dt style={{ display: 'inline', fontWeight: 600 }}>{t.validUntil}: </dt>
              <dd style={{ display: 'inline', margin: 0 }}>{formatDate(data.validUntil, locale)}</dd>
            </div>
          )}
        </dl>
      </div>

      <h2>{t.week}</h2>
      <div className="grid-scroll">
        <table className="grid num" data-testid="week-table">
          <thead>
            <tr>
              <th scope="col">{t.date}</th>
              {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((k) => (
                <th scope="col" key={k}>
                  {t.prayers[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekDates.map((d) => {
              const day = dayByDate.get(d);
              return (
                <tr key={d}>
                  <th scope="row">
                    <Link href={href(d)}>{formatDateShort(d, locale)}</Link>
                  </th>
                  {day ? (
                    (['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((k) => (
                      <td key={k}>
                        {day.entries[k].adhan.time}
                        {day.entries[k].adhan.dayOffset === 1 ? '*' : ''}
                      </td>
                    ))
                  ) : (
                    <td colSpan={6} className="muted">
                      {t.status.noDataForDate}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">* {t.afterMidnight}</p>
    </div>
  );
}
