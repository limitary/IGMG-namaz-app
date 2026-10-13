import { requireActor } from '@/server/auth/current';
import { listCreatableOrganizations } from '@/server/mosques';
import { Flash } from '@/components/Flash';
import { createMosqueAction } from '../../../actions';
import { MosqueFields } from '../../MosqueFields';

export const metadata = { title: 'Nieuwe moskee' };

export default async function NewMosquePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  const orgs = await listCreatableOrganizations(actor);
  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Nieuwe moskee</h1>
      <Flash sp={await searchParams} />
      {orgs.length === 0 ? (
        <p>Je hebt geen recht om moskeeën aan te maken.</p>
      ) : (
        <form action={createMosqueAction} className="card">
          <label htmlFor="organizationId">Organisatie</label>
          <select id="organizationId" name="organizationId">
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <MosqueFields />
          <div style={{ marginTop: 16 }}>
            <button type="submit">Moskee aanmaken</button>
          </div>
        </form>
      )}
    </div>
  );
}
