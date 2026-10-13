import type { Messages } from '@/i18n/messages';

export function SearchForm({ t, q = '' }: { t: Messages; q?: string }) {
  return (
    <form action="/moskeeen" method="get" role="search" className="card">
      <label htmlFor="q">{t.search.label}</label>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input id="q" name="q" type="search" defaultValue={q} placeholder={t.search.placeholder} maxLength={100} autoComplete="off" />
        <button type="submit">{t.search.button}</button>
      </div>
    </form>
  );
}
