import './env';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { getPool, tx } from '../src/server/db';
import { hashPassword } from '../src/server/auth/password';
import { audit } from '../src/server/audit';

/**
 * Zet de pilot klaar: organisatie "IGMG", de moskee "IGMG Hilversum" (VERBORGEN, zonder tijden)
 * en één organisatiebeheerder. Mag vaker gedraaid worden; bestaande gegevens blijven staan.
 *
 *   npm run pilot:setup -w @mescid/web -- --email jij@voorbeeld.nl --name "Jouw naam"
 *
 * Daarna in /beheer: adres controleren, Diyanet-tabel plakken, controleren, publiceren, en pas dan
 * de moskee op "Openbaar" zetten.
 */
async function main() {
  const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
  const email = values.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Gebruik: --email <e-mailadres> --name "<naam>"');
  const name = values.name?.trim() || email;

  const result = await tx(async (db) => {
    let org = (await db.query(`SELECT id FROM organizations WHERE name = 'IGMG' AND is_demo = false`)).rows[0]?.id as string | undefined;
    if (!org) org = (await db.query(`INSERT INTO organizations (name, is_demo) VALUES ('IGMG', false) RETURNING id`)).rows[0].id as string;

    let mosque = (await db.query(`SELECT id FROM mosques WHERE slug = 'igmg-hilversum'`)).rows[0]?.id as string | undefined;
    if (!mosque) {
      mosque = (
        await db.query(
          `INSERT INTO mosques (organization_id, slug, name, city, timezone, visibility, is_demo)
           VALUES ($1, 'igmg-hilversum', 'IGMG Hilversum', 'Hilversum', 'Europe/Amsterdam', 'hidden', false) RETURNING id`,
          [org],
        )
      ).rows[0].id as string;
      await audit(db, { actorUserId: null, action: 'mosque.create', entityType: 'mosque', entityId: mosque, organizationId: org, mosqueId: mosque, details: { via: 'pilot-setup' } });
    }

    let password: string | null = null;
    let user = (await db.query('SELECT id FROM users WHERE email = $1', [email])).rows[0]?.id as string | undefined;
    if (!user) {
      password = randomBytes(12).toString('base64url');
      user = (await db.query('INSERT INTO users (email, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id', [email, name, await hashPassword(password)])).rows[0].id as string;
    }
    const granted = await db.query(
      `INSERT INTO role_assignments (user_id, role, scope_type, scope_id) VALUES ($1, 'org_admin', 'organization', $2) ON CONFLICT DO NOTHING`,
      [user, org],
    );
    if (granted.rowCount) await audit(db, { actorUserId: null, action: 'role.grant', entityType: 'user', entityId: user, organizationId: org, details: { role: 'org_admin', via: 'pilot-setup' } });
    return { password };
  });

  console.log('Pilot klaar: organisatie "IGMG", moskee "IGMG Hilversum" (verborgen, nog zonder tijden).');
  console.log(`Inloggen op /beheer met ${email}`);
  console.log(result.password ? `Tijdelijk wachtwoord (eenmalig getoond, bewaar het veilig): ${result.password}` : 'Account bestond al; wachtwoord is niet gewijzigd.');
}

main()
  .then(() => getPool().end())
  .catch((err) => {
    console.error(`Mislukt: ${err.message}`);
    process.exit(1);
  });
