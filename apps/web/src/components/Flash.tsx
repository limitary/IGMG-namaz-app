import { ERRORS, FIELD_LABELS, OKS } from '@/app/beheer/messages';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function Flash({ sp }: { sp: SP }) {
  const fout = one(sp.fout);
  const ok = one(sp.ok);
  const veld = one(sp.veld);
  return (
    <>
      {fout && ERRORS[fout] && (
        <p className="banner danger" role="alert" data-testid="flash-error">
          {ERRORS[fout]}
          {veld && FIELD_LABELS[veld] ? ` Controleer: ${FIELD_LABELS[veld]}.` : ''}
        </p>
      )}
      {ok && OKS[ok] && (
        <p className="banner ok" role="status" data-testid="flash-ok">
          {OKS[ok]}
        </p>
      )}
    </>
  );
}
