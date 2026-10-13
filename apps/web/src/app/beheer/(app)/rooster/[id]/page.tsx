import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DAY_EVENTS, isoWeekday } from '@mescid/domain';
import { requireActor } from '@/server/auth/current';
import { NotFoundError } from '@/server/authz';
import { getVersionWithDays } from '@/server/schedules';
import { Flash } from '@/components/Flash';
import { describeField, ISSUE_TEXT, PRAYER_NL } from '../../../messages';
import { discardAction, publishAction, saveDraftAction } from '../../../actions';

const WEEKDAY = ['', 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const STATUS_NL = { draft: 'Concept', published: 'Gepubliceerd', superseded: 'Vervangen', discarded: 'Verworpen' } as const;

export default async function VersionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  let data;
  try {
    data = await getVersionWithDays(actor, (await params).id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { version: v, mosque, days, validation, canEdit, canPublish } = data;
  const readOnly = !canEdit;

  return (
    <>
      <p>
        <Link href={`/beheer/moskeeen/${mosque.id}`}>← {mosque.name}</Link>
      </p>
      <h1>
        Rooster {v.fromDate} t/m {v.toDate} <span className={`badge ${v.status === 'published' ? 'ok' : 'neutral'}`} data-testid="version-status">{STATUS_NL[v.status]}</span>
      </h1>
      <p className="muted small">
        Bron: {v.sourceLabel}
        {v.sourceReference ? ` (${v.sourceReference})` : ''} · tijdzone {mosque.timezone} · aangemaakt {v.createdAt.toISOString().slice(0, 10)}
        {v.createdBy ? ` door ${v.createdBy}` : ''}
        {v.note ? ` · ${v.note}` : ''}
      </p>
      <Flash sp={await searchParams} />

      <section className={`banner ${validation.publishable ? 'ok' : 'warn'}`} data-testid="validation">
        {validation.publishable ? (
          <>Controle: geen fouten{validation.warningCount ? `, ${validation.warningCount} waarschuwing(en)` : ''}. Dit rooster kan gepubliceerd worden.</>
        ) : (
          <>
            Controle: {validation.errorCount} fout(en)
            {validation.warningCount ? ` en ${validation.warningCount} waarschuwing(en)` : ''}. Publiceren kan pas als alles klopt.
            {validation.missing.length > 0 && <div>Ontbrekende dagen: {validation.missing.join(', ')}</div>}
            {validation.duplicates.length > 0 && <div>Dubbele dagen: {validation.duplicates.join(', ')}</div>}
          </>
        )}
      </section>

      <form action={saveDraftAction}>
        <input type="hidden" name="id" value={v.id} />
        <input type="hidden" name="version" value={v.version} />
        <p className="small muted">
          Vul tijden in als UU:MM in de lokale tijd van de moskee. Vink &quot;+1&quot; aan als Isha of de iqama ná middernacht valt (bijvoorbeeld 00:15). Iqama is
          optioneel.
        </p>
        <div className="grid-scroll">
          <table className="grid" data-testid="draft-grid">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Imsak</th>
                {DAY_EVENTS.map((k) => (
                  <th scope="col" key={k} colSpan={k === 'sunrise' ? 1 : k === 'isha' ? 4 : 2}>
                    {PRAYER_NL[k]}
                  </th>
                ))}
              </tr>
              <tr>
                <th />
                <th />
                {DAY_EVENTS.map((k) =>
                  k === 'sunrise' ? (
                    <th key={k} className="small">tijd</th>
                  ) : k === 'isha' ? (
                    [
                      <th key="a" className="small">tijd</th>,
                      <th key="an" className="small">+1</th>,
                      <th key="i" className="small">iqama</th>,
                      <th key="in" className="small">+1</th>,
                    ]
                  ) : (
                    [
                      <th key="a" className="small">tijd</th>,
                      <th key="i" className="small">iqama</th>,
                    ]
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const issues = validation.dayIssues[d.date] ?? [];
                const hasError = issues.some((i) => i.severity === 'error');
                const input = (name: string, value: string | undefined, label: string) => (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                    placeholder="UU:MM"
                    maxLength={5}
                    size={5}
                    name={`${d.date}|${name}`}
                    defaultValue={value ?? ''}
                    aria-label={`${d.date} ${label}`}
                    disabled={readOnly}
                    aria-invalid={issues.some((i) => i.field === name.replace('|', '.')) || undefined}
                  />
                );
                const check = (name: string, checked: boolean, label: string) => (
                  <input type="checkbox" name={`${d.date}|${name}`} value="1" defaultChecked={checked} aria-label={`${d.date} ${label}`} disabled={readOnly} />
                );
                return [
                  <tr key={d.date} className={hasError ? 'has-error' : ''} data-date={d.date}>
                    <th scope="row">
                      <input type="hidden" name="date" value={d.date} />
                      {WEEKDAY[isoWeekday(d.date)]} {d.date}
                    </th>
                    <td>{input('imsak', d.times.imsak?.time, 'Imsak')}</td>
                    {DAY_EVENTS.map((k) => {
                      const e = d.times.entries[k];
                      if (k === 'sunrise') return <td key={k}>{input(`${k}|adhan`, e.adhan.time, PRAYER_NL[k]!)}</td>;
                      if (k === 'isha')
                        return [
                          <td key="a">{input('isha|adhan', e.adhan.time, 'Isha')}</td>,
                          <td key="an">{check('isha|adhan|next', e.adhan.dayOffset === 1, 'Isha na middernacht')}</td>,
                          <td key="i">{input('isha|iqama', e.iqama?.time, 'Isha iqama')}</td>,
                          <td key="in">{check('isha|iqama|next', e.iqama?.dayOffset === 1, 'Isha iqama na middernacht')}</td>,
                        ];
                      return [
                        <td key={`${k}a`}>{input(`${k}|adhan`, e.adhan.time, PRAYER_NL[k]!)}</td>,
                        <td key={`${k}i`}>{input(`${k}|iqama`, e.iqama?.time, `${PRAYER_NL[k]} iqama`)}</td>,
                      ];
                    })}
                  </tr>,
                  issues.length > 0 && (
                    <tr key={`${d.date}-issues`} className={hasError ? 'has-error' : ''}>
                      <td colSpan={14} className="small" data-testid={`issues-${d.date}`}>
                        {issues.map((i) => `${describeField(i.field)}: ${ISSUE_TEXT[i.code] ?? i.code}${i.severity === 'warning' ? ' (waarschuwing)' : ''}`).join(' · ')}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div style={{ marginTop: 12 }}>
            <button type="submit">Concept opslaan en controleren</button>
          </div>
        )}
      </form>

      {v.status === 'draft' && (
        <div className="row" style={{ marginTop: 24, alignItems: 'flex-start', gap: 24 }}>
          {canPublish && (
            <form action={publishAction} className="card" style={{ flex: '1 1 320px' }}>
              <h2 style={{ marginTop: 0 }}>Publiceren</h2>
              <p className="small">Na publicatie zien bezoekers deze tijden direct. Sla eerst je wijzigingen op.</p>
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="version" value={v.version} />
              <label style={{ fontWeight: 400 }}>
                <input type="checkbox" name="confirm" value="ja" required /> Ik heb de tijden gecontroleerd met de officiële bron.
              </label>
              <button type="submit" disabled={!validation.publishable} style={{ marginTop: 8 }}>
                Publiceren
              </button>
            </form>
          )}
          <form action={discardAction} className="card" style={{ flex: '1 1 240px' }}>
            <h2 style={{ marginTop: 0 }}>Concept verwerpen</h2>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="version" value={v.version} />
            <button type="submit" className="danger">
              Verwerpen
            </button>
          </form>
        </div>
      )}
    </>
  );
}
