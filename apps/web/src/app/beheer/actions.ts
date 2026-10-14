'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getPool } from '@/server/db';
import { changePassword, login, logout, SESSION_COOKIE } from '@/server/auth/session';
import { requireActor } from '@/server/auth/current';
import { ForbiddenError, NotFoundError } from '@/server/authz';
import { ConflictError, createMosque, mosqueInputSchema, updateMosque } from '@/server/mosques';
import {
  createManualDraft,
  discardDraft,
  draftInputSchema,
  publishVersion,
  saveDraftDays,
  ValidationFailedError,
  type DayTimes,
} from '@/server/schedules';
import { DAY_EVENTS } from '@mescid/domain';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/** Vertaalt bekende fouten naar een foutcode in de URL; onbekende fouten worden niet gemaskeerd. */
function failTo(path: string, err: unknown): never {
  if (err instanceof ForbiddenError || err instanceof NotFoundError) redirect(`${path}?fout=geen-toegang`);
  if (err instanceof ConflictError) redirect(`${path}?fout=${err.code === 'slug-taken' ? 'slug-bezet' : 'verouderd'}`);
  if (err instanceof ValidationFailedError) redirect(`${path}?fout=rooster-fouten`);
  throw err;
}

export async function loginAction(fd: FormData) {
  const res = await login(getPool(), str(fd, 'email'), str(fd, 'password'));
  if (!res.ok) redirect(`/beheer/inloggen?fout=${res.reason === 'throttled' ? 'te-vaak' : 'onjuist'}`);
  const secure = (await headers()).get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production';
  (await cookies()).set(SESSION_COOKIE, res.token, { httpOnly: true, sameSite: 'lax', secure, path: '/', expires: res.expiresAt });
  redirect('/beheer');
}

export async function logoutAction() {
  const jar = await cookies();
  await logout(getPool(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect('/beheer/inloggen');
}

function mosqueFromForm(fd: FormData) {
  return mosqueInputSchema.safeParse({
    name: str(fd, 'name'),
    slug: str(fd, 'slug'),
    city: str(fd, 'city'),
    address: str(fd, 'address'),
    postalCode: str(fd, 'postalCode'),
    timezone: str(fd, 'timezone'),
    visibility: str(fd, 'visibility'),
  });
}

export async function createMosqueAction(fd: FormData) {
  const actor = await requireActor();
  const parsed = mosqueFromForm(fd);
  if (!parsed.success) redirect(`/beheer/moskeeen/nieuw?fout=invoer&veld=${parsed.error.issues[0]?.path[0] ?? ''}`);
  let id: string;
  try {
    id = await createMosque(actor, str(fd, 'organizationId'), parsed.data);
  } catch (err) {
    failTo('/beheer/moskeeen/nieuw', err);
  }
  redirect(`/beheer/moskeeen/${id}?ok=aangemaakt`);
}

export async function updateMosqueAction(fd: FormData) {
  const actor = await requireActor();
  const id = str(fd, 'id');
  const path = `/beheer/moskeeen/${encodeURIComponent(id)}`;
  const parsed = mosqueFromForm(fd);
  if (!parsed.success) redirect(`${path}?fout=invoer&veld=${parsed.error.issues[0]?.path[0] ?? ''}`);
  try {
    await updateMosque(actor, id, Number(str(fd, 'version')), parsed.data);
  } catch (err) {
    failTo(path, err);
  }
  revalidatePath('/', 'layout');
  redirect(`${path}?ok=opgeslagen`);
}

export async function createDraftAction(fd: FormData) {
  const actor = await requireActor();
  const mosqueId = str(fd, 'mosqueId');
  const path = `/beheer/moskeeen/${encodeURIComponent(mosqueId)}`;
  const parsed = draftInputSchema.safeParse({ fromDate: str(fd, 'fromDate'), toDate: str(fd, 'toDate'), sourceLabel: str(fd, 'sourceLabel'), note: str(fd, 'note') });
  if (!parsed.success) redirect(`${path}?fout=periode`);
  let id: string;
  try {
    id = await createManualDraft(actor, mosqueId, parsed.data);
  } catch (err) {
    failTo(path, err);
  }
  redirect(`/beheer/rooster/${id}`);
}

/** Leest het roosterraster uit het formulier. Lege velden blijven leeg (en worden door de controle gemeld). */
function daysFromForm(fd: FormData): { date: string; times: DayTimes }[] {
  const dates = fd.getAll('date').map(String);
  return dates.map((date) => {
    const v = (k: string) => str(fd, `${date}|${k}`).trim().slice(0, 5);
    const offset = (k: string) => (fd.get(`${date}|${k}`) === '1' ? 1 : 0) as 0 | 1;
    const entries = Object.fromEntries(
      DAY_EVENTS.map((key) => {
        const iq = key === 'sunrise' ? '' : v(`${key}|iqama`);
        return [
          key,
          {
            adhan: { time: v(`${key}|adhan`), dayOffset: key === 'isha' ? offset('isha|adhan|next') : 0 },
            iqama: iq ? { time: iq, dayOffset: key === 'isha' ? offset('isha|iqama|next') : 0 } : null,
          },
        ];
      }),
    ) as DayTimes['entries'];
    const imsak = v('imsak');
    return { date, times: { imsak: imsak ? { time: imsak, dayOffset: 0 } : null, entries } };
  });
}

export async function saveDraftAction(fd: FormData) {
  const actor = await requireActor();
  const id = str(fd, 'id');
  const path = `/beheer/rooster/${encodeURIComponent(id)}`;
  try {
    await saveDraftDays(actor, id, Number(str(fd, 'version')), daysFromForm(fd));
  } catch (err) {
    failTo(path, err);
  }
  redirect(`${path}?ok=opgeslagen`);
}

export async function publishAction(fd: FormData) {
  const actor = await requireActor();
  const id = str(fd, 'id');
  const path = `/beheer/rooster/${encodeURIComponent(id)}`;
  if (fd.get('confirm') !== 'ja') redirect(`${path}?fout=bevestig`);
  try {
    await publishVersion(actor, id, Number(str(fd, 'version')));
  } catch (err) {
    failTo(path, err);
  }
  revalidatePath('/', 'layout');
  redirect(`${path}?ok=gepubliceerd`);
}

export async function discardAction(fd: FormData) {
  const actor = await requireActor();
  const id = str(fd, 'id');
  const path = `/beheer/rooster/${encodeURIComponent(id)}`;
  try {
    await discardDraft(actor, id, Number(str(fd, 'version')));
  } catch (err) {
    failTo(path, err);
  }
  redirect(`${path}?ok=verworpen`);
}

export async function changePasswordAction(fd: FormData) {
  const actor = await requireActor();
  const r = await changePassword(getPool(), actor.user.id, str(fd, 'current'), str(fd, 'next'), str(fd, 'confirm'));
  if (!r.ok) redirect(`/beheer/wachtwoord?fout=pw-${r.reason}`);
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/beheer/inloggen?ok=pw-gewijzigd');
}
