import { requireActor } from '@/server/auth/current';
import { listAuditEvents } from '@/server/mosques';

export const metadata = { title: 'Auditlog' };

export default async function AuditPage() {
  const actor = await requireActor();
  const events = await listAuditEvents(actor);
  return (
    <>
      <h1>Auditlog</h1>
      <p className="muted small">De laatste 200 wijzigingen binnen jouw bevoegdheid. Tijden in UTC.</p>
      <div className="grid-scroll">
        <table className="grid" data-testid="audit">
          <thead>
            <tr>
              <th>Tijdstip (UTC)</th>
              <th>Wie</th>
              <th>Actie</th>
              <th>Moskee</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="num">{e.at.toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td>{e.actor_email ?? 'systeem'}</td>
                <td>{e.action}</td>
                <td>{e.mosque_name ?? '—'}</td>
                <td className="small" style={{ whiteSpace: 'normal', maxWidth: 420 }}>
                  {JSON.stringify(e.details).slice(0, 300)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
