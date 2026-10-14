import Link from 'next/link';
import { requireActor } from '@/server/auth/current';
import { logoutAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return (
    <div className="container wide">
      <div className="row spread card" style={{ padding: '8px 16px' }}>
        <nav className="row" aria-label="Beheermenu">
          <Link href="/beheer">Overzicht</Link>
          <Link href="/beheer/audit">Auditlog</Link>
          <Link href="/beheer/wachtwoord">Wachtwoord</Link>
        </nav>
        <form action={logoutAction} className="row">
          <span className="small muted" data-testid="current-user">
            {actor.user.displayName}
          </span>
          <button type="submit" className="secondary">
            Uitloggen
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
