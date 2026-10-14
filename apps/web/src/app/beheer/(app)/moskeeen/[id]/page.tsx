import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, localDateAt } from '@mescid/domain';
import { requireActor } from '@/server/auth/current';
import { canOnMosque, NotFoundError } from '@/server/authz';
import { getAdminMosque } from '@/server/mosques';
import { listVersions, MAX_DRAFT_DAYS } from '@/server/schedules';
import { Flash } from '@/components/Flash';
import { createDraftAction, updateMosqueAction } from '../../../actions';
import { MosqueFields } from '../../MosqueFields';
import { ImportForm } from '@/components/ImportForm';

const STATUS_NL = { draft: 'Concept', published: 'Gepubliceerd', superseded: 'Vervangen', discarded: 'Verworpen' } as const;

export default async function AdminMosquePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  const { id } = await params;
  let mosque;
  try {
    mosque = await getAdminMosque(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const versions = await listVersions(actor, id);
  const canEditMosque = canOnMosque(actor, 'mosque.edit', mosque);
  const canEditSchedule = canOnMosque(actor, 'schedule.edit', mosque);
  const today = localDateAt(Date.now(), mosque.timezone);

  return (
    <>
      <h1>
        {mosque.name} {mosque.isDemo && <span className="badge">Demo</span>}
      </h1>
      <p className="muted">
        {mosque.organizationName} ·{' '}
        {mosque.visibility === 'public' ? (
          <Link href={`/m/${mosque.slug}`}>Bekijk publieke pagina</Link>
        ) : (
          'Niet zichtbaar voor bezoekers'
        )}
      </p>
      <Flash sp={await searchParams} />

      <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
        <section style={{ flex: '1 1 340px' }}>
          <h2>Roosterversies</h2>
          {versions.length === 0 ? (
            <p>Nog geen rooster.</p>
          ) : (
            <ul className="plain" data-testid="versions">
              {versions.map((v) => (
                <li key={v.id}>
                  <Link href={`/beheer/rooster/${v.id}`}>
                    {v.fromDate} t/m {v.toDate}
                  </Link>{' '}
                  <span className={`badge ${v.status === 'published' ? 'ok' : 'neutral'}`}>{STATUS_NL[v.status]}</span>
                  <div className="small muted">
                    Bron: {v.sourceLabel}
                    {v.publishedAt ? ` · gepubliceerd ${v.publishedAt.toISOString().slice(0, 10)}${v.publishedBy ? ` door ${v.publishedBy}` : ''}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canEditSchedule && <ImportForm mosqueId={mosque.id} defaultLabel={`Diyanet İşleri Başkanlığı (namazvakitleri.diyanet.gov.tr) – ${mosque.city}`} />}

          {canEditSchedule && (
            <form action={createDraftAction} className="card" data-testid="new-draft">
              <h3 style={{ marginTop: 0 }}>Nieuw rooster (handmatig)</h3>
              <p className="small muted">
                Je maakt eerst een concept. Bezoekers zien niets tot het concept is gecontroleerd en gepubliceerd. Maximaal {MAX_DRAFT_DAYS} dagen per concept.
                Al gepubliceerde tijden in deze periode worden als startwaarde overgenomen.
              </p>
              <input type="hidden" name="mosqueId" value={mosque.id} />
              <div className="row">
                <div style={{ flex: 1 }}>
                  <label htmlFor="fromDate">Van</label>
                  <input id="fromDate" name="fromDate" type="date" required defaultValue={today} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="toDate">Tot en met</label>
                  <input id="toDate" name="toDate" type="date" required defaultValue={addDays(today, 6)} />
                </div>
              </div>
              <label htmlFor="sourceLabel">Bron van de tijden</label>
              <input id="sourceLabel" name="sourceLabel" required minLength={2} maxLength={200} placeholder="Bijv. rooster aangeleverd door het moskeebestuur" />
              <label htmlFor="note">Notitie (intern)</label>
              <input id="note" name="note" maxLength={1000} />
              <div style={{ marginTop: 16 }}>
                <button type="submit">Concept aanmaken</button>
              </div>
            </form>
          )}
        </section>

        <section style={{ flex: '1 1 340px' }}>
          <h2>Gegevens</h2>
          {canEditMosque ? (
            <form action={updateMosqueAction} className="card">
              <input type="hidden" name="id" value={mosque.id} />
              <input type="hidden" name="version" value={mosque.version} />
              <MosqueFields m={mosque} />
              <div style={{ marginTop: 16 }}>
                <button type="submit">Opslaan</button>
              </div>
            </form>
          ) : (
            <dl className="card">
              <dt>Plaats</dt>
              <dd>{mosque.city}</dd>
              <dt>Tijdzone</dt>
              <dd>{mosque.timezone}</dd>
            </dl>
          )}
        </section>
      </div>
    </>
  );
}
