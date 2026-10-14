'use client';
import { useActionState } from 'react';
import { importTableAction, type ImportState } from '@/app/beheer/import-action';

const PRAYERS = [
  ['fajr', 'Fajr (Sabah)'],
  ['dhuhr', 'Dhuhr (Öğle)'],
  ['asr', 'Asr (İkindi)'],
  ['maghrib', 'Maghrib (Akşam)'],
  ['isha', 'Isha (Yatsı)'],
] as const;

export function ImportForm({ mosqueId, defaultLabel }: { mosqueId: string; defaultLabel: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importTableAction, { errors: [] });
  return (
    <form action={action} className="card" data-testid="import-form">
      <h3 style={{ marginTop: 0 }}>Rooster importeren (Diyanet-tabel plakken)</h3>
      <ol className="small muted" style={{ paddingLeft: 18 }}>
        <li>
          Open <strong>namazvakitleri.diyanet.gov.tr</strong>, kies Nederland en de plaats, en open de maandweergave (Aylık).
        </li>
        <li>Selecteer de hele tabel, kopieer (Ctrl+C) en plak hieronder (Ctrl+V). Een CSV-bestand kan ook.</li>
        <li>De app maakt een concept. Jij controleert het en publiceert daarna zelf.</li>
      </ol>
      {state.errors.length > 0 && (
        <div className="banner danger" role="alert" data-testid="import-errors">
          {state.errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
      <input type="hidden" name="mosqueId" value={mosqueId} />
      <label htmlFor="imp-table">Tabel</label>
      <textarea id="imp-table" name="table" rows={8} placeholder={'14.10.2026  …  06:12  07:58  13:27  16:01  18:45  20:21'} spellCheck={false} />
      <p className="hint">
        Per regel: datum (bijv. 14.10.2026 of 14 Ekim 2026) en zes tijden in deze volgorde: İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı.
      </p>
      <label htmlFor="imp-file">Of kies een bestand (.csv, .tsv, .txt)</label>
      <input id="imp-file" name="file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" />
      <label htmlFor="imp-sourceLabel">Bron (zichtbaar voor bezoekers)</label>
      <input id="imp-sourceLabel" name="sourceLabel" required defaultValue={defaultLabel} maxLength={200} />
      <label htmlFor="imp-reference">Verwijzing (optioneel, bijv. de webpagina)</label>
      <input id="imp-reference" name="reference" maxLength={300} placeholder="https://namazvakitleri.diyanet.gov.tr/…" />
      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
        <legend style={{ fontWeight: 600 }}>Iqama: aantal minuten na de gebedstijd (leeg = geen iqama)</legend>
        <div className="row">
          {PRAYERS.map(([k, label]) => (
            <div key={k} style={{ flex: '1 1 110px' }}>
              <label htmlFor={`iqama_${k}`} style={{ fontWeight: 400, marginTop: 4 }}>
                {label}
              </label>
              <input id={`iqama_${k}`} name={`iqama_${k}`} type="number" min={0} max={120} step={1} inputMode="numeric" />
            </div>
          ))}
        </div>
        <p className="hint">De iqama-tijden worden per dag in het concept gezet. Je kunt ze daarna nog per dag aanpassen.</p>
      </fieldset>
      <div style={{ marginTop: 16 }}>
        <button type="submit" disabled={pending}>
          {pending ? 'Bezig…' : 'Controleren en concept maken'}
        </button>
      </div>
    </form>
  );
}
