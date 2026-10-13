import { getMessages } from '@/i18n/server';
import { setLocale } from '../actions';

export default async function MorePage() {
  const { locale, t } = await getMessages();
  return (
    <div className="container">
      <h1>{t.more.title}</h1>
      <section className="card" aria-labelledby="taal">
        <h2 id="taal">{t.more.language}</h2>
        <div className="row">
          {(['nl', 'tr'] as const).map((l) => (
            <form action={setLocale} key={l}>
              <input type="hidden" name="lang" value={l} />
              <input type="hidden" name="back" value="/meer" />
              <button type="submit" className={l === locale ? '' : 'secondary'} aria-pressed={l === locale} lang={l}>
                {l === 'nl' ? 'Nederlands' : 'Türkçe'}
              </button>
            </form>
          ))}
        </div>
      </section>
      <section className="card" aria-labelledby="privacy">
        <h2 id="privacy">{t.more.privacyTitle}</h2>
        <p>{t.more.privacy}</p>
      </section>
      <section className="card" aria-labelledby="over">
        <h2 id="over">{t.more.aboutTitle}</h2>
        <p>{t.more.about}</p>
        <p className="muted small">{t.iqamaHelp}</p>
      </section>
    </div>
  );
}
