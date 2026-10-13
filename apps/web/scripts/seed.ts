import './env';
import { randomBytes } from 'node:crypto';
import { addDays, localDateAt } from '@mescid/domain';
import { getPool, tx } from '../src/server/db';
import { hashPassword } from '../src/server/auth/password';
import { createImportedDraft } from '../src/server/schedules';
import { demoRange } from './demo-data';

/**
 * Vult een LEGE database met herkenbare demodata: twee gescheiden demo-organisaties,
 * fictieve moskeeën en fictieve tijden. Draai dit nooit op een productiedatabase.
 */
async function main() {
  const pool = getPool();
  const existing = await pool.query('SELECT count(*)::int AS n FROM organizations');
  if (existing.rows[0].n > 0) {
    console.log('Database bevat al gegevens; seed overgeslagen.');
    return;
  }
  const password = process.env.SEED_PASSWORD || randomBytes(12).toString('base64url');
  const pwHash = await hashPassword(password);
  const today = localDateAt(Date.now(), 'Europe/Amsterdam');
  const from = addDays(today, -7);

  await tx(async (db) => {
    const org = async (name: string) => (await db.query('INSERT INTO organizations (name, is_demo) VALUES ($1, true) RETURNING id', [name])).rows[0].id as string;
    const orgA = await org('Demo-organisatie A');
    const orgB = await org('Demo-organisatie B');
    const regionA = (await db.query('INSERT INTO regions (organization_id, name) VALUES ($1, $2) RETURNING id', [orgA, 'Demo-regio Noord'])).rows[0].id as string;

    const mosque = async (orgId: string, regionId: string | null, slug: string, name: string, city: string, visibility = 'public') =>
      (await db.query(
        `INSERT INTO mosques (organization_id, region_id, slug, name, city, address, postal_code, timezone, is_demo, visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Europe/Amsterdam',true,$8) RETURNING id`,
        [orgId, regionId, slug, name, city, 'Voorbeeldstraat 1', '0000 AA', visibility],
      )).rows[0].id as string;
    const m1 = await mosque(orgA, regionA, 'demo-moskee-noord', 'Demo-moskee Noord', 'Demostad');
    const m2 = await mosque(orgA, null, 'demo-moskee-zuid', 'Demo-moskee Zuid', 'Voorbeelddorp');
    const m3 = await mosque(orgB, null, 'demo-moskee-west', 'Demo-moskee West', 'Proefplaats');

    const user = async (email: string, name: string, roles: [string, string, string | null][]) => {
      const id = (await db.query('INSERT INTO users (email, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id', [email, name, pwHash])).rows[0].id as string;
      for (const [role, scopeType, scopeId] of roles) {
        await db.query('INSERT INTO role_assignments (user_id, role, scope_type, scope_id) VALUES ($1,$2,$3,$4)', [id, role, scopeType, scopeId]);
      }
      return id;
    };
    await user('beheer-a@demo.invalid', 'Beheerder A (demo)', [['org_admin', 'organization', orgA]]);
    await user('redacteur-a@demo.invalid', 'Redacteur A (demo)', [['editor', 'mosque', m1]]);
    await user('beheer-b@demo.invalid', 'Beheerder B (demo)', [['org_admin', 'organization', orgB]]);

    // Gepubliceerde fictieve roosters zodat de publieke app meteen iets toont.
    for (const m of [m1, m2, m3]) {
      const vid = await createImportedDraft(db, { mosqueId: m, kind: 'csv', label: 'Demo: fictieve tijden (geen echte gebedstijden)', reference: 'seed', days: demoRange(from, 45), actorUserId: null, note: 'Automatisch aangemaakt door seed-script' });
      await db.query(`UPDATE schedule_versions SET status='published', published_at=now(), publish_seq=nextval('publish_seq') WHERE id=$1`, [vid]);
    }
  });

  console.log('Demodata aangemaakt. Inloggen op /beheer met:');
  console.log('  beheer-a@demo.invalid    (organisatiebeheerder Demo-organisatie A)');
  console.log('  redacteur-a@demo.invalid (redacteur, alleen Demo-moskee Noord)');
  console.log('  beheer-b@demo.invalid    (organisatiebeheerder Demo-organisatie B)');
  console.log(process.env.SEED_PASSWORD ? '  wachtwoord: zie SEED_PASSWORD' : `  wachtwoord (eenmalig getoond): ${password}`);
}

main()
  .then(() => getPool().end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
