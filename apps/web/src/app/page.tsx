import { getMessages } from '@/i18n/server';
import { HomeFavorite } from '@/components/HomeFavorite';
import { SearchForm } from '@/components/SearchForm';

export default async function HomePage() {
  const { t } = await getMessages();
  return (
    <div className="container">
      <h1>{t.nav.today}</h1>
      <HomeFavorite t={t} />
      <h2>{t.search.title}</h2>
      <SearchForm t={t} />
      <p className="muted small">{t.favorite.storedLocally}</p>
    </div>
  );
}
