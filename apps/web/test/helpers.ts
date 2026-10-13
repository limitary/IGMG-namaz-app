import { randomUUID } from 'node:crypto';
import { getPool } from '../src/server/db';
import { hashPassword } from '../src/server/auth/password';
import { loadAssignments, type Actor, type Role, type ScopeType } from '../src/server/authz';
import type { DayTimes } from '../src/server/schedules';

let pwHash: string | null = null;

export async function makeOrg(name = `Test-org ${randomUUID().slice(0, 6)}`) {
  return (await getPool().query('INSERT INTO organizations (name, is_demo) VALUES ($1, true) RETURNING id', [name])).rows[0].id as string;
}

export async function makeRegion(orgId: string) {
  return (await getPool().query('INSERT INTO regions (organization_id, name) VALUES ($1, $2) RETURNING id', [orgId, 'Testregio'])).rows[0].id as string;
}

export async function makeMosque(orgId: string, opts: { regionId?: string | null; visibility?: string; timezone?: string } = {}) {
  const slug = `test-${randomUUID().slice(0, 8)}`;
  return (
    await getPool().query(
      `INSERT INTO mosques (organization_id, region_id, slug, name, city, timezone, visibility, is_demo) VALUES ($1,$2,$3,$4,'Teststad',$5,$6,true) RETURNING id`,
      [orgId, opts.regionId ?? null, slug, `Testmoskee ${slug}`, opts.timezone ?? 'Europe/Amsterdam', opts.visibility ?? 'public'],
    )
  ).rows[0].id as string;
}

export const PASSWORD = 'test-wachtwoord-123';

export async function makeActor(roles: [Role, ScopeType, string | null][], email = `u-${randomUUID().slice(0, 8)}@test.invalid`): Promise<Actor> {
  pwHash ??= await hashPassword(PASSWORD);
  const id = (await getPool().query('INSERT INTO users (email, display_name, password_hash) VALUES ($1,$2,$3) RETURNING id', [email, email, pwHash])).rows[0].id as string;
  for (const [role, scopeType, scopeId] of roles) {
    await getPool().query('INSERT INTO role_assignments (user_id, role, scope_type, scope_id) VALUES ($1,$2,$3,$4)', [id, role, scopeType, scopeId]);
  }
  return { user: { id, email, displayName: email }, assignments: await loadAssignments(getPool(), id) };
}

/** Fictieve, geldige roosterdag. */
export function validTimes(over: Partial<Record<string, string>> = {}): DayTimes {
  const t = (k: string, d: string) => ({ time: over[k] ?? d, dayOffset: 0 as const });
  return {
    imsak: null,
    entries: {
      fajr: { adhan: t('fajr', '06:00'), iqama: t('fajr_iqama', '06:20') },
      sunrise: { adhan: t('sunrise', '07:30'), iqama: null },
      dhuhr: { adhan: t('dhuhr', '13:30'), iqama: t('dhuhr_iqama', '13:45') },
      asr: { adhan: t('asr', '16:00'), iqama: null },
      maghrib: { adhan: t('maghrib', '18:30'), iqama: null },
      isha: { adhan: t('isha', '20:00'), iqama: null },
    },
  };
}
