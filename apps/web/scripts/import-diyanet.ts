import './env';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { getPool, tx } from '../src/server/db';
import { fetchDiyanet, parseDiyanetResponse } from '../src/server/diyanet';
import { createImportedDraft, validateDays } from '../src/server/schedules';

/**
 * Importeert Diyanet-tijden als CONCEPT voor één moskee. Publiceren gebeurt daarna door een bevoegde
 * beheerder in /beheer, na controle.
 *
 *   npm run import:diyanet -- --mosque demo-moskee-noord --city-id 13980 --period Monthly
 *   npm run import:diyanet -- --mosque demo-moskee-noord --city-id 13980 --from-file antwoord.json
 */
async function main() {
  const { values } = parseArgs({
    options: {
      mosque: { type: 'string' },
      'city-id': { type: 'string' },
      period: { type: 'string', default: 'Monthly' },
      'from-file': { type: 'string' },
    },
  });
  if (!values.mosque || !values['city-id']) throw new Error('Gebruik: --mosque <slug> --city-id <Diyanet-plaats-ID> [--period Monthly|Weekly|Daily] [--from-file pad.json]');
  const cityId = Number(values['city-id']);
  const period = values.period as 'Daily' | 'Weekly' | 'Monthly';
  if (!['Daily', 'Weekly', 'Monthly'].includes(period)) throw new Error('--period moet Daily, Weekly of Monthly zijn');

  const pool = getPool();
  const m = (await pool.query('SELECT id, name, timezone FROM mosques WHERE slug = $1', [values.mosque])).rows[0];
  if (!m) throw new Error(`Moskee met slug "${values.mosque}" niet gevonden`);

  const days = values['from-file']
    ? parseDiyanetResponse(JSON.parse(await readFile(values['from-file'], 'utf8')))
    : await fetchDiyanet(cityId, period, { email: process.env.DIYANET_EMAIL, password: process.env.DIYANET_PASSWORD });

  const id = await tx((db) =>
    createImportedDraft(db, {
      mosqueId: m.id,
      kind: 'diyanet',
      label: 'Diyanet İşleri Başkanlığı (Awqat Salah)',
      reference: `city:${cityId}`,
      days,
      actorUserId: null,
      note: values['from-file'] ? 'Import uit bestand' : `Import via API (${period})`,
    }),
  );
  const v = validateDays(days, m.timezone, days[0]!.date, days[days.length - 1]!.date);
  console.log(`Concept aangemaakt voor ${m.name}: ${days.length} dagen (${days[0]!.date} t/m ${days[days.length - 1]!.date}).`);
  console.log(`Controle: ${v.errorCount} fout(en), ${v.warningCount} waarschuwing(en). Bekijk en publiceer via /beheer/rooster/${id}`);
}

main()
  .then(() => getPool().end())
  .catch((err) => {
    console.error(`Import mislukt: ${err.message}`);
    process.exit(1);
  });
