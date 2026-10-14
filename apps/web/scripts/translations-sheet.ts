import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { MESSAGES } from '../src/i18n/messages';

/** Maakt docs/vertalingen-controle.md: alle teksten Nederlands naast Turks, om na te kijken. */
type Tree = { [k: string]: string | Tree };
function flatten(o: Tree, prefix = ''): [string, string][] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : flatten(v, `${prefix}${k}.`)));
}
const nl = new Map(flatten(MESSAGES.nl as unknown as Tree));
const tr = new Map(flatten(MESSAGES.tr as unknown as Tree));
const esc = (s: string) => s.replace(/\|/g, '\\|');
const rows = [...nl.keys()].map((k) => `| \`${k}\` | ${esc(nl.get(k)!)} | ${esc(tr.get(k) ?? '')} | |`);
const out = `# Turkse teksten nakijken

Zet in de laatste kolom een verbeterde Turkse tekst als iets niet klopt of niet natuurlijk klinkt, en geef het bestand terug.
Laat de linkerkolom (sleutel) ongewijzigd. Gegenereerd met \`npm run translations:sheet -w @mescid/web\`.

| Sleutel | Nederlands | Turks (huidig) | Verbetering |
| --- | --- | --- | --- |
${rows.join('\n')}
`;
writeFileSync(path.resolve(__dirname, '../../../docs/vertalingen-controle.md'), out);
console.log(`${rows.length} teksten geschreven naar docs/vertalingen-controle.md`);
