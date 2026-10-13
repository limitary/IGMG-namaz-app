'use client';
import { useEffect, useState } from 'react';
import type { Messages } from '@/i18n/messages';
import { readFavorite, writeFavorite, type Favorite } from './favorite';

export function FavoriteButton({ mosque, t }: { mosque: Favorite; t: Messages }) {
  const [fav, setFav] = useState<Favorite | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFav(readFavorite());
    setReady(true);
  }, []);
  if (!ready) return null;
  const is = fav?.id === mosque.id;
  return (
    <div className="row">
      {is && <span className="badge ok">{t.favorite.is}</span>}
      <button
        type="button"
        className="secondary"
        aria-pressed={is}
        onClick={() => {
          const next = is ? null : { id: mosque.id, slug: mosque.slug, name: mosque.name };
          writeFavorite(next);
          setFav(next);
        }}
      >
        {is ? t.favorite.remove : t.favorite.add}
      </button>
    </div>
  );
}
