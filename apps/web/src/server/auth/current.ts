import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '../db';
import { SESSION_COOKIE, userForToken, type SessionUser } from './session';
import { loadAssignments, type Actor } from '../authz';

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForToken(getPool(), token);
}

/** Voor beheerpagina's en -acties: zonder geldige sessie terug naar inloggen. */
export async function requireActor(): Promise<Actor> {
  const user = await currentUser();
  if (!user) redirect('/beheer/inloggen');
  return { user, assignments: await loadAssignments(getPool(), user.id) };
}
