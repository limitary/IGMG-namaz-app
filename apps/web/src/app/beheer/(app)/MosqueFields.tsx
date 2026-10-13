import type { AdminMosque } from '@/server/mosques';

/** Gedeelde formuliervelden voor aanmaken en bewerken van een moskee. */
export function MosqueFields({ m }: { m?: AdminMosque }) {
  return (
    <>
      <label htmlFor="name">Naam</label>
      <input id="name" name="name" required minLength={2} maxLength={200} defaultValue={m?.name} />
      <label htmlFor="slug">Webadres (slug)</label>
      <input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} defaultValue={m?.slug} aria-describedby="slug-hint" />
      <p className="hint" id="slug-hint">
        Kleine letters, cijfers en streepjes, bijvoorbeeld <code>moskee-amsterdam-west</code>. Wordt /m/&lt;slug&gt;.
      </p>
      <label htmlFor="city">Plaats</label>
      <input id="city" name="city" required maxLength={120} defaultValue={m?.city} />
      <label htmlFor="address">Adres (openbaar)</label>
      <input id="address" name="address" maxLength={300} defaultValue={m?.address} />
      <label htmlFor="postalCode">Postcode</label>
      <input id="postalCode" name="postalCode" maxLength={20} defaultValue={m?.postalCode} />
      <label htmlFor="timezone">Tijdzone</label>
      <select id="timezone" name="timezone" defaultValue={m?.timezone ?? 'Europe/Amsterdam'}>
        {['Europe/Amsterdam', 'Europe/Brussels', 'Europe/Berlin', 'Europe/Paris', 'Europe/Vienna', 'Europe/Zurich', 'Europe/London', 'Europe/Istanbul'].map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      <label htmlFor="visibility">Zichtbaarheid</label>
      <select id="visibility" name="visibility" defaultValue={m?.visibility === 'public' ? 'public' : 'hidden'}>
        <option value="hidden">Verborgen (alleen beheer)</option>
        <option value="public">Openbaar (zichtbaar voor bezoekers)</option>
      </select>
    </>
  );
}
