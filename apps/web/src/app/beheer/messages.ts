/** Beheerteksten (fase 1: alleen Nederlands). */
export const ERRORS: Record<string, string> = {
  onjuist: 'E-mailadres of wachtwoord is onjuist.',
  'te-vaak': 'Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.',
  'geen-toegang': 'Je hebt geen toegang tot deze gegevens, of ze bestaan niet.',
  verouderd: 'Iemand anders heeft dit intussen gewijzigd. Laad de pagina opnieuw en controleer je wijzigingen.',
  'slug-bezet': 'Dit webadres (slug) is al in gebruik. Kies een ander.',
  invoer: 'Niet alle velden zijn juist ingevuld.',
  periode: 'Kies een geldige periode van maximaal 62 dagen en vul een bronomschrijving in.',
  'rooster-fouten': 'Publiceren geweigerd: het rooster bevat nog fouten of ontbrekende dagen.',
  bevestig: 'Vink eerst aan dat je de tijden hebt gecontroleerd.',
  'pw-wrong-current': 'Je huidige wachtwoord klopt niet.',
  'pw-too-short': 'Het nieuwe wachtwoord moet minstens 12 tekens hebben.',
  'pw-mismatch': 'De twee nieuwe wachtwoorden zijn niet gelijk.',
  'pw-same': 'Kies een ander wachtwoord dan je huidige.',
};

export const OKS: Record<string, string> = {
  aangemaakt: 'Moskee aangemaakt. Ze is pas zichtbaar voor bezoekers als je "Openbaar" kiest.',
  opgeslagen: 'Opgeslagen.',
  gepubliceerd: 'Gepubliceerd. Bezoekers zien nu deze tijden.',
  verworpen: 'Concept verworpen.',
  'pw-gewijzigd': 'Wachtwoord gewijzigd. Log opnieuw in met je nieuwe wachtwoord.',
  geimporteerd: 'Tabel ingelezen als concept. Controleer de tijden en de verschillen hieronder en publiceer daarna.',
};

export const FIELD_LABELS: Record<string, string> = {
  name: 'Naam',
  slug: 'Webadres (slug)',
  city: 'Plaats',
  address: 'Adres',
  postalCode: 'Postcode',
  timezone: 'Tijdzone',
  visibility: 'Zichtbaarheid',
};

export const ISSUE_TEXT: Record<string, string> = {
  'invalid-date': 'ongeldige datum',
  'invalid-time': 'ontbreekt of ongeldig (gebruik UU:MM)',
  'invalid-timezone': 'ongeldige tijdzone van de moskee',
  'nonexistent-time': 'bestaat niet door de zomertijdwissel',
  'ambiguous-time': 'komt twee keer voor door de wintertijdwissel; kies een andere minuut',
  'offset-not-allowed': 'alleen Isha mag na middernacht vallen',
  'iqama-not-allowed': 'zonsopkomst heeft geen iqama',
  order: 'staat in de verkeerde volgorde t.o.v. het vorige gebed',
  'iqama-before-adhan': 'iqama ligt vóór de gebedstijd',
  'iqama-after-next-prayer': 'iqama ligt na de volgende gebedstijd (controleer)',
  'imsak-after-fajr': 'imsak ligt na Fajr',
};

export const PRAYER_NL: Record<string, string> = {
  imsak: 'Imsak',
  fajr: 'Fajr',
  sunrise: 'Zonsopkomst',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export function describeField(field: string): string {
  const [key, part] = field.split('.');
  const name = PRAYER_NL[key ?? ''] ?? field;
  return part === 'iqama' ? `${name} iqama` : name;
}
