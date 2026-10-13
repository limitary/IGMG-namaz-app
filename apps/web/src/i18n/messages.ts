/**
 * Interfaceteksten. Nederlands is de bron; Turks is een eerste vertaling die door een
 * bevoegde inhoudelijke reviewer gecontroleerd moet worden voordat de pilot live gaat.
 */
export const LOCALES = ['nl', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

const nl = {
  appName: 'IGMG Mescid app',
  workTitleNote: 'Werktitel, pilotversie',
  nav: { today: 'Vandaag', mosques: 'Moskeeën', more: 'Meer', admin: 'Beheer' },
  prayers: { imsak: 'Imsak', fajr: 'Fajr (Sabah)', sunrise: 'Zonsopkomst', dhuhr: 'Dhuhr (Öğle)', asr: 'Asr (İkindi)', maghrib: 'Maghrib (Akşam)', isha: 'Isha (Yatsı)' },
  adhan: 'Gebedstijd',
  iqama: 'Iqama',
  iqamaHelp: 'Gebedstijd = begin van de tijd voor het gebed (adhan). Iqama = aanvang van het gezamenlijke gebed in de moskee.',
  afterMidnight: 'na middernacht',
  next: 'Volgende',
  nextPrayer: 'Volgend gebed',
  nextIqama: 'Volgende iqama',
  in: 'over',
  now: 'Nu',
  hoursShort: 'u',
  minutesShort: 'min',
  today: 'Vandaag',
  date: 'Datum',
  prevDay: 'Vorige dag',
  nextDay: 'Volgende dag',
  backToToday: 'Terug naar vandaag',
  week: 'Komende 7 dagen',
  source: 'Bron',
  publishedOn: 'gepubliceerd op',
  timezone: 'Tijdzone',
  timesShownIn: 'Tijden in de tijdzone van de moskee',
  validUntil: 'Rooster beschikbaar t/m',
  demo: 'Demo',
  demoBanner: 'Fictieve moskee en fictieve tijden. Niet gebruiken om te bidden.',
  status: {
    'no-schedule-today': 'Voor deze datum is (nog) geen rooster gepubliceerd. Vraag de moskee om het actuele rooster.',
    'schedule-ended': 'Het gepubliceerde rooster loopt hierna af. Er is nog geen rooster voor morgen.',
    'invalid-timezone': 'Deze moskee heeft een ongeldige tijdzone-instelling. Neem contact op met de beheerder.',
    noDataForDate: 'Voor deze datum is geen rooster beschikbaar.',
  },
  search: {
    title: 'Vind je moskee',
    label: 'Zoek op naam, plaats of postcode',
    placeholder: 'Bijvoorbeeld een plaatsnaam',
    button: 'Zoeken',
    none: 'Geen moskeeën gevonden.',
    results: 'resultaten',
  },
  favorite: {
    add: 'Als mijn moskee instellen',
    remove: 'Niet meer mijn moskee',
    is: 'Dit is je moskee',
    yours: 'Mijn moskee',
    none: 'Je hebt nog geen moskee gekozen. Zoek hieronder je moskee en stel die in als jouw moskee.',
    storedLocally: 'Je keuze wordt alleen op dit apparaat bewaard. Je hebt geen account nodig.',
  },
  address: 'Adres',
  route: 'Route plannen',
  openMosque: 'Bekijk tijden',
  more: {
    title: 'Meer',
    language: 'Taal',
    privacyTitle: 'Privacy',
    privacy:
      'Deze app werkt zonder account. We gebruiken geen advertenties, geen trackers en geen locatiegegevens. Je gekozen moskee wordt alleen op je eigen apparaat bewaard.',
    aboutTitle: 'Over de tijden',
    about:
      'Elke moskee publiceert haar eigen rooster. Bij elk rooster zie je de bron en de publicatiedatum. Als er geen geldig rooster is, tonen we dat duidelijk in plaats van tijden te verzinnen.',
  },
  offline: 'Je bent offline. Je ziet de laatst geladen gegevens.',
  loading: 'Laden…',
  notFound: 'Niet gevonden',
  notFoundText: 'Deze pagina of moskee bestaat niet of is niet openbaar.',
  backHome: 'Naar de startpagina',
};

export type Messages = typeof nl;

const tr: Messages = {
  appName: 'IGMG Mescid app',
  workTitleNote: 'Çalışma adı, pilot sürüm',
  nav: { today: 'Bugün', mosques: 'Camiler', more: 'Daha fazla', admin: 'Yönetim' },
  prayers: { imsak: 'İmsak', fajr: 'Sabah (Fajr)', sunrise: 'Güneş', dhuhr: 'Öğle', asr: 'İkindi', maghrib: 'Akşam', isha: 'Yatsı' },
  adhan: 'Vakit',
  iqama: 'Kamet',
  iqamaHelp: 'Vakit = namaz vaktinin başlangıcı (ezan). Kamet = camide cemaatle namazın başlama saati.',
  afterMidnight: 'gece yarısından sonra',
  next: 'Sıradaki',
  nextPrayer: 'Sıradaki namaz',
  nextIqama: 'Sıradaki kamet',
  in: 'kalan',
  now: 'Şimdi',
  hoursShort: 'sa',
  minutesShort: 'dk',
  today: 'Bugün',
  date: 'Tarih',
  prevDay: 'Önceki gün',
  nextDay: 'Sonraki gün',
  backToToday: 'Bugüne dön',
  week: 'Önümüzdeki 7 gün',
  source: 'Kaynak',
  publishedOn: 'yayın tarihi',
  timezone: 'Saat dilimi',
  timesShownIn: 'Saatler caminin saat dilimine göredir',
  validUntil: 'Takvim şu tarihe kadar mevcut',
  demo: 'Demo',
  demoBanner: 'Hayali cami ve hayali vakitler. Namaz için kullanmayın.',
  status: {
    'no-schedule-today': 'Bu tarih için (henüz) yayınlanmış bir takvim yok. Güncel takvimi camiden isteyin.',
    'schedule-ended': 'Yayınlanan takvim burada sona eriyor. Yarın için henüz takvim yok.',
    'invalid-timezone': 'Bu caminin saat dilimi ayarı geçersiz. Lütfen yönetici ile iletişime geçin.',
    noDataForDate: 'Bu tarih için takvim mevcut değil.',
  },
  search: {
    title: 'Camini bul',
    label: 'İsim, şehir veya posta koduyla ara',
    placeholder: 'Örneğin bir şehir adı',
    button: 'Ara',
    none: 'Cami bulunamadı.',
    results: 'sonuç',
  },
  favorite: {
    add: 'Camim olarak ayarla',
    remove: 'Artık camim değil',
    is: 'Bu senin camin',
    yours: 'Camim',
    none: 'Henüz bir cami seçmedin. Aşağıda camini ara ve kendi camin olarak ayarla.',
    storedLocally: 'Seçimin yalnızca bu cihazda saklanır. Hesaba ihtiyacın yok.',
  },
  address: 'Adres',
  route: 'Yol tarifi',
  openMosque: 'Vakitleri gör',
  more: {
    title: 'Daha fazla',
    language: 'Dil',
    privacyTitle: 'Gizlilik',
    privacy:
      'Bu uygulama hesap gerektirmez. Reklam, takip aracı veya konum verisi kullanmıyoruz. Seçtiğin cami yalnızca kendi cihazında saklanır.',
    aboutTitle: 'Vakitler hakkında',
    about:
      'Her cami kendi takvimini yayınlar. Her takvimde kaynağı ve yayın tarihini görürsün. Geçerli bir takvim yoksa, vakit uydurmak yerine bunu açıkça gösteririz.',
  },
  offline: 'Çevrimdışısın. En son yüklenen bilgileri görüyorsun.',
  loading: 'Yükleniyor…',
  notFound: 'Bulunamadı',
  notFoundText: 'Bu sayfa veya cami mevcut değil ya da herkese açık değil.',
  backHome: 'Ana sayfaya',
};

export const MESSAGES: Record<Locale, Messages> = { nl, tr };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}
