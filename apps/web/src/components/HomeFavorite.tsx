'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PrayerDay } from '@mescid/domain';
import type { Messages } from '@/i18n/messages';
import { DayView } from './DayView';
import { readFavorite, writeFavorite, type Favorite } from './favorite';

interface ApiResponse {
  mosque: { id: string; slug: string; name: string; city: string; timezone: string; isDemo: boolean };
  today: string;
  nowMs: number;
  days: PrayerDay[];
}

type State = { kind: 'loading' } | { kind: 'none' } | { kind: 'error'; fav: Favorite } | { kind: 'ok'; data: ApiResponse };

/** Startscherm: de eigen moskee (lokaal bewaard) met vandaag en het volgende gebed. */
export function HomeFavorite({ t }: { t: Messages }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const fav = readFavorite();
    if (!fav) return setState({ kind: 'none' });
    const ctrl = new AbortController();
    fetch(`/api/v1/mosques/${encodeURIComponent(fav.id)}/prayer-days`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) {
          // Moskee niet meer openbaar: favoriet opruimen in plaats van oude gegevens te tonen.
          writeFavorite(null);
          return setState({ kind: 'none' });
        }
        if (!r.ok) throw new Error(String(r.status));
        setState({ kind: 'ok', data: (await r.json()) as ApiResponse });
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setState({ kind: 'error', fav });
      });
    return () => ctrl.abort();
  }, []);

  if (state.kind === 'loading') return <p className="muted">{t.loading}</p>;
  if (state.kind === 'none') return <p className="card">{t.favorite.none}</p>;
  if (state.kind === 'error')
    return (
      <div className="card">
        <p className="banner warn">{t.offline}</p>
        <Link href={`/m/${state.fav.slug}`}>{state.fav.name}</Link>
      </div>
    );
  const { data } = state;
  return (
    <section className="card" aria-labelledby="mijn-moskee" data-testid="home-favorite">
      <div className="row spread">
        <h2 id="mijn-moskee" style={{ margin: 0 }}>
          {data.mosque.name} {data.mosque.isDemo && <span className="badge">{t.demo}</span>}
        </h2>
        <Link href={`/m/${data.mosque.slug}`}>{t.openMosque}</Link>
      </div>
      <p className="muted small">{data.mosque.city}</p>
      <DayView days={data.days} timezone={data.mosque.timezone} selectedDate={data.today} initialNowMs={data.nowMs} t={t} />
    </section>
  );
}
