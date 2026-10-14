import { Flash } from '@/components/Flash';
import { changePasswordAction } from '../../actions';

export const metadata = { title: 'Wachtwoord wijzigen' };

export default async function PasswordPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Wachtwoord wijzigen</h1>
      <Flash sp={await searchParams} />
      <form action={changePasswordAction} className="card">
        <label htmlFor="current">Huidig wachtwoord</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
        <label htmlFor="next">Nieuw wachtwoord</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required aria-describedby="pw-hint" />
        <p className="hint" id="pw-hint">
          Minstens 12 tekens. Een zin van een paar woorden is sterk en makkelijk te onthouden.
        </p>
        <label htmlFor="confirm">Nieuw wachtwoord herhalen</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
        <p className="hint">Na het wijzigen word je op al je apparaten uitgelogd.</p>
        <div style={{ marginTop: 16 }}>
          <button type="submit">Wachtwoord wijzigen</button>
        </div>
      </form>
    </div>
  );
}
