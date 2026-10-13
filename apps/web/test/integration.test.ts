import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getPool } from '../src/server/db';
import { migrate } from '../src/server/migrate';
import { login, userForToken } from '../src/server/auth/session';
import { canOnMosque, NotFoundError, ForbiddenError, type Actor } from '../src/server/authz';
import { ConflictError, createMosque, getAdminMosque, getPublicMosqueById, listAdminMosques, listAuditEvents, searchPublicMosques, updateMosque } from '../src/server/mosques';
import {
  createImportedDraft,
  createManualDraft,
  discardDraft,
  getPublishedDays,
  getVersionWithDays,
  publishVersion,
  saveDraftDays,
  ValidationFailedError,
} from '../src/server/schedules';
import { makeActor, makeMosque, makeOrg, makeRegion, PASSWORD, validTimes } from './helpers';

let orgA: string, orgB: string, regionA: string;
let mosqueA1: string, mosqueA2: string, mosqueB: string;
let adminA: Actor, adminB: Actor, editorA1: Actor, publisherA1: Actor, regionAdminA: Actor, platform: Actor;

beforeAll(async () => {
  orgA = await makeOrg('Org A');
  orgB = await makeOrg('Org B');
  regionA = await makeRegion(orgA);
  mosqueA1 = await makeMosque(orgA, { regionId: regionA });
  mosqueA2 = await makeMosque(orgA);
  mosqueB = await makeMosque(orgB);
  adminA = await makeActor([['org_admin', 'organization', orgA]], 'admin-a@test.invalid');
  adminB = await makeActor([['org_admin', 'organization', orgB]]);
  editorA1 = await makeActor([['editor', 'mosque', mosqueA1]]);
  publisherA1 = await makeActor([['publisher', 'mosque', mosqueA1]]);
  regionAdminA = await makeActor([['region_admin', 'region', regionA]]);
  platform = await makeActor([['platform_admin', 'platform', null]]);
});

afterAll(async () => {
  await getPool().end();
});

async function draftWith(actor: Actor, mosqueId: string, from: string, to: string) {
  return createManualDraft(actor, mosqueId, { fromDate: from, toDate: to, sourceLabel: 'Testbron', note: '' });
}

async function versionNo(id: string): Promise<number> {
  return (await getPool().query('SELECT version FROM schedule_versions WHERE id = $1', [id])).rows[0].version;
}

describe('migraties', () => {
  test('tweede keer migreren doet niets', async () => {
    const done = await migrate(getPool(), path.resolve(__dirname, '../../../database/migrations'));
    expect(done).toEqual([]);
  });

  test('database weigert een regio van een andere organisatie', async () => {
    const regionB = await makeRegion(orgB);
    await expect(makeMosque(orgA, { regionId: regionB })).rejects.toThrow(/foreign key/);
  });

  test('database weigert een roosterbron van een andere moskee', async () => {
    const src = (await getPool().query(`INSERT INTO prayer_sources (mosque_id, kind, label) VALUES ($1,'manual','x') RETURNING id`, [mosqueB])).rows[0].id;
    await expect(
      getPool().query(`INSERT INTO schedule_versions (mosque_id, source_id, from_date, to_date) VALUES ($1,$2,'2027-01-01','2027-01-02')`, [mosqueA1, src]),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('inloggen', () => {
  test('juist wachtwoord geeft een sessie; token wordt alleen gehasht bewaard', async () => {
    const r = await login(getPool(), 'Admin-A@test.invalid', PASSWORD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await userForToken(getPool(), r.token))?.email).toBe('admin-a@test.invalid');
    const stored = await getPool().query('SELECT count(*)::int AS n FROM sessions WHERE token_hash::text LIKE $1', [`%${r.token}%`]);
    expect(stored.rows[0].n).toBe(0);
  });

  test('fout wachtwoord en onbekend e-mailadres geven dezelfde fout', async () => {
    expect(await login(getPool(), 'admin-a@test.invalid', 'fout-wachtwoord-xyz')).toEqual({ ok: false, reason: 'invalid' });
    expect(await login(getPool(), 'bestaat-niet@test.invalid', 'fout-wachtwoord-xyz')).toEqual({ ok: false, reason: 'invalid' });
  });

  test('na te veel mislukte pogingen wordt inloggen tijdelijk geblokkeerd', async () => {
    const email = 'throttle@test.invalid';
    await makeActor([], email);
    for (let i = 0; i < 8; i++) await login(getPool(), email, 'fout-wachtwoord-xyz');
    expect(await login(getPool(), email, PASSWORD)).toEqual({ ok: false, reason: 'throttled' });
  });

  test('ongeldig of verlopen token geeft geen gebruiker', async () => {
    expect(await userForToken(getPool(), 'onzin')).toBeNull();
    expect(await userForToken(getPool(), undefined)).toBeNull();
  });
});

describe('scheiding tussen organisaties (pilotscenario 3)', () => {
  test('beheerder B ziet in zijn lijst alleen moskeeën van B', async () => {
    const ids = (await listAdminMosques(adminB)).map((m) => m.id);
    expect(ids).toContain(mosqueB);
    expect(ids).not.toContain(mosqueA1);
    expect(ids).not.toContain(mosqueA2);
  });

  test('beheerder B kan moskee A niet lezen via een gewijzigd ID', async () => {
    await expect(getAdminMosque(adminB, mosqueA1)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('beheerder B kan moskee A niet wijzigen', async () => {
    await expect(
      updateMosque(adminB, mosqueA1, 1, { name: 'Gekaapt', slug: 'gekaapt', city: 'X', address: '', postalCode: '', timezone: 'Europe/Amsterdam', visibility: 'public' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const m = await getAdminMosque(adminA, mosqueA1);
    expect(m.name).not.toBe('Gekaapt');
  });

  test('beheerder B kan geen moskee aanmaken in organisatie A', async () => {
    await expect(
      createMosque(adminB, orgA, { name: 'Indringer', slug: 'indringer', city: 'X', address: '', postalCode: '', timezone: 'Europe/Amsterdam', visibility: 'public' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('beheerder B kan geen rooster maken, bekijken of publiceren voor moskee A', async () => {
    await expect(draftWith(adminB, mosqueA1, '2027-02-01', '2027-02-02')).rejects.toBeInstanceOf(NotFoundError);
    const vid = await draftWith(adminA, mosqueA1, '2027-02-01', '2027-02-01');
    await expect(getVersionWithDays(adminB, vid)).rejects.toBeInstanceOf(NotFoundError);
    await expect(publishVersion(adminB, vid, await versionNo(vid))).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveDraftDays(adminB, vid, await versionNo(vid), [{ date: '2027-02-01', times: validTimes() }])).rejects.toBeInstanceOf(NotFoundError);
    await expect(discardDraft(adminB, vid, await versionNo(vid))).rejects.toBeInstanceOf(NotFoundError);
  });

  test('auditlog van B bevat geen gebeurtenissen van A', async () => {
    const events = await listAuditEvents(adminB);
    const aMosqueNames = new Set((await listAdminMosques(adminA)).map((m) => m.name));
    expect(events.some((e) => e.mosque_name && aMosqueNames.has(e.mosque_name))).toBe(false);
  });
});

describe('rollen binnen een organisatie', () => {
  test('redacteur mag concept bewerken maar niet publiceren', async () => {
    const vid = await draftWith(editorA1, mosqueA1, '2027-03-01', '2027-03-01');
    await saveDraftDays(editorA1, vid, await versionNo(vid), [{ date: '2027-03-01', times: validTimes() }]);
    await expect(publishVersion(editorA1, vid, await versionNo(vid))).rejects.toBeInstanceOf(ForbiddenError);
    // Een publiceerder mag het wel.
    await publishVersion(publisherA1, vid, await versionNo(vid));
    expect((await getPublishedDays(mosqueA1, '2027-03-01', '2027-03-01')).length).toBe(1);
  });

  test('redacteur van moskee A1 heeft geen toegang tot moskee A2', async () => {
    await expect(getAdminMosque(editorA1, mosqueA2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(draftWith(editorA1, mosqueA2, '2027-03-01', '2027-03-01')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('publiceerder mag geen concept maken', async () => {
    await expect(draftWith(publisherA1, mosqueA1, '2027-03-02', '2027-03-02')).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('regiobeheerder ziet alleen moskeeën in de eigen regio', async () => {
    const ids = (await listAdminMosques(regionAdminA)).map((m) => m.id);
    expect(ids).toEqual([mosqueA1]);
    const m = await getAdminMosque(regionAdminA, mosqueA1);
    expect(canOnMosque(regionAdminA, 'schedule.publish', m)).toBe(true);
  });

  test('platformbeheerder ziet alles', async () => {
    const ids = (await listAdminMosques(platform)).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining([mosqueA1, mosqueA2, mosqueB]));
  });

  test('ingetrokken rol geeft direct geen toegang meer', async () => {
    const tmp = await makeActor([['mosque_admin', 'mosque', mosqueA2]]);
    await getAdminMosque(tmp, mosqueA2);
    await getPool().query('DELETE FROM role_assignments WHERE user_id = $1', [tmp.user.id]);
    const reloaded = { ...tmp, assignments: [] };
    await expect(getAdminMosque(reloaded, mosqueA2)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('concept naar publicatie (pilotscenario 4)', () => {
  test('concept met fouten blijft concept en verandert geen publieke tijden', async () => {
    const good = await draftWith(adminA, mosqueA2, '2027-04-01', '2027-04-02');
    await saveDraftDays(adminA, good, await versionNo(good), [
      { date: '2027-04-01', times: validTimes() },
      { date: '2027-04-02', times: validTimes() },
    ]);
    await publishVersion(adminA, good, await versionNo(good));
    const before = await getPublishedDays(mosqueA2, '2027-04-01', '2027-04-02');

    const bad = await draftWith(adminA, mosqueA2, '2027-04-01', '2027-04-02');
    await saveDraftDays(adminA, bad, await versionNo(bad), [
      { date: '2027-04-01', times: validTimes({ dhuhr: '05:00' }) }, // verkeerde volgorde
      { date: '2027-04-02', times: validTimes({ fajr: '05:00' }) },
    ]);
    const err = await publishVersion(adminA, bad, await versionNo(bad)).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect((await getVersionWithDays(adminA, bad)).version.status).toBe('draft');
    expect(await getPublishedDays(mosqueA2, '2027-04-01', '2027-04-02')).toEqual(before);
  });

  test('concept met lege dagen kan niet gepubliceerd worden', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-05-01', '2027-05-03');
    await saveDraftDays(adminA, vid, await versionNo(vid), [{ date: '2027-05-01', times: validTimes() }]);
    const v = await getVersionWithDays(adminA, vid);
    expect(v.validation.publishable).toBe(false);
    await expect(publishVersion(adminA, vid, await versionNo(vid))).rejects.toBeInstanceOf(ValidationFailedError);
  });

  test('concepten zijn nooit publiek zichtbaar', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-06-01', '2027-06-01');
    await saveDraftDays(adminA, vid, await versionNo(vid), [{ date: '2027-06-01', times: validTimes() }]);
    expect(await getPublishedDays(mosqueA2, '2027-06-01', '2027-06-01')).toEqual([]);
  });

  test('nieuwere publicatie wint bij overlap; oudere tijden buiten de overlap blijven', async () => {
    const v1 = await draftWith(adminA, mosqueA2, '2027-07-01', '2027-07-03');
    await saveDraftDays(adminA, v1, await versionNo(v1), ['2027-07-01', '2027-07-02', '2027-07-03'].map((date) => ({ date, times: validTimes() })));
    await publishVersion(adminA, v1, await versionNo(v1));
    const v2 = await draftWith(adminA, mosqueA2, '2027-07-02', '2027-07-02');
    await saveDraftDays(adminA, v2, await versionNo(v2), [{ date: '2027-07-02', times: validTimes({ dhuhr: '13:31' }) }]);
    await publishVersion(adminA, v2, await versionNo(v2));
    const days = await getPublishedDays(mosqueA2, '2027-07-01', '2027-07-03');
    expect(days.map((d) => d.times.entries.dhuhr.adhan.time)).toEqual(['13:30', '13:31', '13:30']);
    expect(days[1]!.versionId).toBe(v2);
  });

  test('nieuw concept neemt gepubliceerde tijden als startwaarde over', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-07-02', '2027-07-04');
    const v = await getVersionWithDays(adminA, vid);
    expect(v.days[0]!.times.entries.dhuhr.adhan.time).toBe('13:31');
    expect(v.days[2]!.times.entries.dhuhr.adhan.time).toBe('');
  });

  test('gelijktijdige wijziging wordt gedetecteerd (geen stille overschrijving)', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-08-01', '2027-08-01');
    const v = await versionNo(vid);
    await saveDraftDays(adminA, vid, v, [{ date: '2027-08-01', times: validTimes() }]);
    await expect(saveDraftDays(adminA, vid, v, [{ date: '2027-08-01', times: validTimes({ asr: '16:01' }) }])).rejects.toBeInstanceOf(ConflictError);
  });

  test('dubbel publiceren van dezelfde versie lukt niet', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-08-05', '2027-08-05');
    await saveDraftDays(adminA, vid, await versionNo(vid), [{ date: '2027-08-05', times: validTimes() }]);
    const v = await versionNo(vid);
    await publishVersion(adminA, vid, v);
    await expect(publishVersion(adminA, vid, v)).rejects.toBeInstanceOf(ConflictError);
  });

  test('dagen buiten het concept kunnen niet stiekem toegevoegd worden', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-08-10', '2027-08-10');
    await expect(saveDraftDays(adminA, vid, await versionNo(vid), [{ date: '2027-08-11', times: validTimes() }])).rejects.toThrow(/Onbekende datum/);
    // De hele opslag is teruggedraaid.
    expect((await getVersionWithDays(adminA, vid)).days[0]!.times.entries.fajr.adhan.time).toBe('');
  });

  test('publicatie wordt geauditeerd met de uitvoerder', async () => {
    const events = await listAuditEvents(adminA);
    const pub = events.find((e) => e.action === 'schedule.publish');
    expect(pub?.actor_email).toBe('admin-a@test.invalid');
  });

  test('Isha na middernacht wordt geaccepteerd en zo bewaard', async () => {
    const vid = await draftWith(adminA, mosqueA2, '2027-06-20', '2027-06-20');
    const times = validTimes({ fajr: '03:10', sunrise: '05:18', dhuhr: '13:45', asr: '18:05', maghrib: '22:05' });
    times.entries.isha = { adhan: { time: '00:15', dayOffset: 1 }, iqama: { time: '00:30', dayOffset: 1 } };
    times.entries.fajr.iqama = { time: '03:30', dayOffset: 0 };
    times.entries.dhuhr.iqama = null;
    await saveDraftDays(adminA, vid, await versionNo(vid), [{ date: '2027-06-20', times }]);
    await publishVersion(adminA, vid, await versionNo(vid));
    const [d] = await getPublishedDays(mosqueA2, '2027-06-20', '2027-06-20');
    expect(d!.times.entries.isha).toEqual({ adhan: { time: '00:15', dayOffset: 1 }, iqama: { time: '00:30', dayOffset: 1 } });
  });
});

describe('publieke gegevens', () => {
  test('verborgen moskee is niet publiek vindbaar', async () => {
    const hidden = await makeMosque(orgA, { visibility: 'hidden' });
    expect(await getPublicMosqueById(hidden)).toBeNull();
    expect((await searchPublicMosques('')).map((m) => m.id)).not.toContain(hidden);
  });

  test('zoeken behandelt % en _ als gewone tekens', async () => {
    expect(await searchPublicMosques('%')).toEqual([]);
    expect(await searchPublicMosques('_')).toEqual([]);
  });

  test('publieke moskee bevat geen beheervelden', async () => {
    const m = await getPublicMosqueById(mosqueA1);
    expect(m).not.toBeNull();
    expect(Object.keys(m!)).not.toContain('organizationId');
    expect(Object.keys(m!)).not.toContain('version');
  });

  test('ongeldige ID geeft null, geen databasefout', async () => {
    expect(await getPublicMosqueById("1' OR '1'='1")).toBeNull();
  });
});

describe('import als concept', () => {
  test('een import wordt nooit automatisch gepubliceerd', async () => {
    const client = await getPool().connect();
    try {
      const vid = await createImportedDraft(client, {
        mosqueId: mosqueB,
        kind: 'diyanet',
        label: 'Diyanet',
        reference: 'city:1',
        days: [{ date: '2027-09-01', times: validTimes() }],
        actorUserId: null,
      });
      const status = (await client.query('SELECT status FROM schedule_versions WHERE id = $1', [vid])).rows[0].status;
      expect(status).toBe('draft');
    } finally {
      client.release();
    }
    expect(await getPublishedDays(mosqueB, '2027-09-01', '2027-09-01')).toEqual([]);
  });
});
