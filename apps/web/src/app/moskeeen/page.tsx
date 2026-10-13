import Link from 'next/link';
import { getMessages } from '@/i18n/server';
import { searchPublicMosques } from '@/server/mosques';
import { SearchForm } from '@/components/SearchForm';

export const dynamic = 'force-dynamic';

export default async function MosquesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { t } = await getMessages();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const mosques = await searchPublicMosques(q);
  return (
    <div className="container">
      <h1>{t.search.title}</h1>
      <SearchForm t={t} q={q} />
      <p className="muted small" role="status">
        {mosques.length} {t.search.results}
      </p>
      {mosques.length === 0 ? (
        <p>{t.search.none}</p>
      ) : (
        <ul className="plain" data-testid="mosque-list">
          {mosques.map((m) => (
            <li key={m.id}>
              <Link href={`/m/${m.slug}`} style={{ fontWeight: 600 }}>
                {m.name}
              </Link>{' '}
              {m.isDemo && <span className="badge">{t.demo}</span>}
              <div className="muted small">
                {m.city}
                {m.address ? ` · ${m.address}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
