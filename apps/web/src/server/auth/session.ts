import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db';
import { audit } from '../audit';
import { dummyHash, verifyPassword } from './password';

export const SESSION_COOKIE = 'mescid_session';
export const SESSION_TTL_HOURS = 12;
const MAX_FAILED_PER_15_MIN = 8;

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export type LoginResult =
  | { ok: true; token: string; user: SessionUser; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'throttled' };

/** Controleert e-mail en wachtwoord en maakt een nieuwe sessie. Geeft geen hint of het e-mailadres bestaat. */
export async function login(db: Db, emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase().slice(0, 320);
  const { rows: attempts } = await db.query(
    `SELECT count(*)::int AS n FROM login_attempts WHERE email = $1 AND success = false AND at > now() - interval '15 minutes'`,
    [email],
  );
  if ((attempts[0] as { n: number }).n >= MAX_FAILED_PER_15_MIN) return { ok: false, reason: 'throttled' };

  const { rows } = await db.query(
    'SELECT id, email, display_name, password_hash FROM users WHERE email = $1 AND disabled_at IS NULL',
    [email],
  );
  const user = rows[0] as { id: string; email: string; display_name: string; password_hash: string } | undefined;
  const valid = user ? await verifyPassword(user.password_hash, password) : (await verifyPassword(await dummyHash(), password), false);
  await db.query('INSERT INTO login_attempts (email, success) VALUES ($1, $2)', [email, valid]);
  if (!user || !valid) return { ok: false, reason: 'invalid' };

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  await db.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, hashToken(token), expiresAt]);
  await audit(db, { actorUserId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });
  return { ok: true, token, user: { id: user.id, email: user.email, displayName: user.display_name }, expiresAt };
}

export async function userForToken(db: Db, token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.disabled_at IS NULL`,
    [hashToken(token)],
  );
  const r = rows[0] as { id: string; email: string; display_name: string } | undefined;
  return r ? { id: r.id, email: r.email, displayName: r.display_name } : null;
}

export async function logout(db: Db, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}
