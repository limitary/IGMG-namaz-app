export interface Favorite {
  id: string;
  slug: string;
  name: string;
}

const KEY = 'mescid:favorite';

// Opslag kan ontbreken of geblokkeerd zijn (privévenster); de app werkt dan gewoon zonder favoriet.
export function readFavorite(): Favorite | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Favorite;
    return typeof v?.id === 'string' && typeof v.slug === 'string' && typeof v.name === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function writeFavorite(f: Favorite | null): void {
  try {
    if (f) window.localStorage.setItem(KEY, JSON.stringify(f));
    else window.localStorage.removeItem(KEY);
  } catch {
    // negeren
  }
}
