'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireActor } from '@/server/auth/current';
import { ForbiddenError, NotFoundError } from '@/server/authz';
import { createDraftFromTable } from '@/server/schedules';
import { parseTimetable, TABLE_ERROR_TEXT, type IqamaOffsets } from '@/server/table-import';

export interface ImportState {
  errors: string[];
}

const MAX_BYTES = 200_000;
const offset = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 120), 'offset');

/** Leest de geplakte tekst of het geüploade bestand, controleert alles en maakt pas dan een concept. */
export async function importTableAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const actor = await requireActor();
  const mosqueId = String(fd.get('mosqueId') ?? '');
  const label = String(fd.get('sourceLabel') ?? '').trim().slice(0, 200);
  const reference = String(fd.get('reference') ?? '').trim().slice(0, 300);
  if (label.length < 2) return { errors: ['Vul de bron in (bijvoorbeeld "Diyanet – Hilversum").'] };

  let text = String(fd.get('table') ?? '');
  const file = fd.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { errors: ['Bestand is te groot (maximaal 200 kB).'] };
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) return { errors: ['Alleen .csv-, .tsv- of .txt-bestanden. Sla Excel op als CSV.'] };
    text = await file.text();
  }
  if (text.length > MAX_BYTES) return { errors: ['Tekst is te lang (maximaal 200 kB).'] };
  if (!text.trim()) return { errors: ['Plak de tabel of kies een bestand.'] };

  const iqama: IqamaOffsets = {};
  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
    const r = offset.safeParse(String(fd.get(`iqama_${k}`) ?? ''));
    if (!r.success) return { errors: [`Iqama-minuten voor ${k} moeten een heel getal van 0 tot 120 zijn.`] };
    iqama[k] = r.data;
  }

  const parsed = parseTimetable(text, iqama);
  if (parsed.errors.length) {
    return {
      errors: [
        `Niets geïmporteerd: ${parsed.errors.length} regel(s) konden niet gelezen worden.`,
        ...parsed.errors.slice(0, 20).map((e) => `Regel ${e.line}: ${TABLE_ERROR_TEXT[e.reason]} — "${e.text}"`),
      ],
    };
  }
  if (parsed.days.length === 0) return { errors: ['Geen enkele roosterregel gevonden. Controleer of je de hele tabel hebt gekopieerd.'] };

  let id: string;
  try {
    id = await createDraftFromTable(actor, mosqueId, { label, reference, days: parsed.days, note: `Tabelimport (${parsed.days.length} dagen)` });
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) return { errors: ['Je hebt geen recht om voor deze moskee roosters in te voeren.'] };
    throw err;
  }
  redirect(`/beheer/rooster/${id}?ok=geimporteerd`);
}
