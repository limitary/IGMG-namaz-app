import { redirect } from 'next/navigation';
import { currentUser } from '@/server/auth/current';
import { Flash } from '@/components/Flash';
import { loginAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inloggen beheer' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (await currentUser()) redirect('/beheer');
  return (
    <div className="container" style={{ maxWidth: 440 }}>
      <h1>Inloggen beheer</h1>
      <p className="muted">Alleen voor bevoegde beheerders van moskeeën en organisaties.</p>
      <Flash sp={await searchParams} />
      <form action={loginAction} className="card">
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Wachtwoord</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <div style={{ marginTop: 16 }}>
          <button type="submit">Inloggen</button>
        </div>
      </form>
    </div>
  );
}
