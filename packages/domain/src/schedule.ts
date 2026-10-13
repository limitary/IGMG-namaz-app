import { addDays, compareDates, isLocalDate, type LocalDate } from './time';

export interface CoverageReport {
  duplicates: LocalDate[];
  missing: LocalDate[];
  invalid: string[];
}

/** Zoekt dubbele, ontbrekende en ongeldige datums binnen een periode (grenzen inbegrepen). */
export function checkCoverage(dates: string[], from: LocalDate, to: LocalDate): CoverageReport {
  const seen = new Set<string>();
  const duplicates = new Set<LocalDate>();
  const invalid: string[] = [];
  for (const d of dates) {
    if (!isLocalDate(d)) {
      invalid.push(d);
      continue;
    }
    if (seen.has(d)) duplicates.add(d);
    seen.add(d);
  }
  const missing: LocalDate[] = [];
  if (isLocalDate(from) && isLocalDate(to) && compareDates(from, to) <= 0) {
    for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) {
      if (!seen.has(d)) missing.push(d);
    }
  }
  return { duplicates: [...duplicates].sort(), missing, invalid };
}
