import Link from 'next/link';
import { addDays, compareDates, localDateAt } from '@mescid/domain';
import { requireActor } from '@/server/auth/current';
import { listAdminMosques, listCreatableOrganizations } from '@/server/mosques';
import { getPublishedUntil } from '@/server/schedules';
import { query } from '@/server/db';

export const metadata = { title: 'Beheer' };

export default async function AdminHome() {
  const actor = await requireActor();
  const [mosques, orgs] = await Promise.all([listAdminMosques(actor), listCreatableOrganizations(actor)]);
  const ids = mosques.map((m) => m.id);
  const drafts = ids.length
    ? await query<{ mosque_id: string; n: number }>(`SELECT mosque_id, count(*)::int AS n FROM schedule_versions WHERE status = 'draft' AND mosque_id = ANY($1::uuid[]) GROUP BY mosque_id`, [ids])
    : [];
  const draftCount = new Map(drafts.map((d) => [d.mosque_id, d.n]));
  const until = await Promise.all(mosques.map((m) => getPublishedUntil(m.id)));

  return (
    <>
      <div className="row spread">
        <h1>Mijn moskeeën</h1>
        {orgs.length > 0 && (
          <Link href="/beheer/moskeeen/nieuw" className="btn">
            Nieuwe moskee
          </Link>
        )}
      </div>
      {mosques.length === 0 ? (
        <p>Je hebt nog geen toegang tot moskeeën. Vraag je organisatiebeheerder om rechten.</p>
      ) : (
        <div className="grid-scroll">
          <table className="grid" data-testid="admin-mosques">
            <thead>
              <tr>
                <th>Moskee</th>
                <th>Organisatie</th>
                <th>Zichtbaarheid</th>
                <th>Rooster gepubliceerd t/m</th>
                <th>Open concepten</th>
              </tr>
            </thead>
            <tbody>
              {mosques.map((m, i) => {
                const today = localDateAt(Date.now(), m.timezone);
                const u = until[i];
                const soon = !u || compareDates(u, addDays(today, 14)) < 0;
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/beheer/moskeeen/${m.id}`}>{m.name}</Link> {m.isDemo && <span className="badge">Demo</span>}
                      <div className="small muted">{m.city}</div>
                    </td>
                    <td>{m.organizationName}</td>
                    <td>{m.visibility === 'public' ? <span className="badge ok">Openbaar</span> : <span className="badge neutral">Verborgen</span>}</td>
                    <td>
                      {u ?? '—'} {soon && <span className="badge">{u ? 'loopt binnen 14 dagen af' : 'geen rooster'}</span>}
                    </td>
                    <td>{draftCount.get(m.id) ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
