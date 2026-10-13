# IGMG Mescid app — Fase 0: onderzoek en voorstel

**Datum:** 13 oktober 2026
**Status:** voorstel ter goedkeuring. Er is nog geen app-code geschreven.
**Basis:** "IGMG Mescid app: uitgebreide onderzoeks- en bouwprompt", versie 1.0.

Dit document beantwoordt de acht vragen uit hoofdstuk 21 van de masterprompt.

---

## 1. Welke bronnen zijn gecontroleerd, en wat kon wel en niet

| Bron | Resultaat | Label |
| --- | --- | --- |
| `raw.githubusercontent.com/mawaqit/mawaqit-js` (README, NOTICE, LICENSE, `tests/prayer-times.test.ts`) | Gelezen | IN CODE GEVONDEN / GEDOCUMENTEERD |
| `raw.githubusercontent.com/mawaqit/mawaqit-py` (README) | Gelezen | GEDOCUMENTEERD |
| `raw.githubusercontent.com/mawaqit/mawaqit-tv-l10n` (LICENSE, `l10n/intl_en.arb`) | Gelezen | IN CODE GEVONDEN |
| `raw.githubusercontent.com/mawaqit/prayer-times` (LICENSE, README) | Gelezen | GEDOCUMENTEERD |
| `www.mawaqit.net` | **Geblokkeerd** door de netwerkregels van deze omgeving | ONBEKEND (niet zelf gezien) |
| `github.com/mawaqit` en de GitHub-API voor de volledige repo-lijst | **Geblokkeerd** (deze sessie mag alleen de eigen repository via de API bekijken) | ONBEKEND (niet zelf gezien) |

Gevolg: de repository-inventaris en de homepage-beschrijving uit het vooronderzoek van de masterprompt heb ik **niet zelf opnieuw kunnen controleren**. Ik neem ze over als "volgens vooronderzoek", niet als eigen waarneming. Commit-ID's per repository zijn nog niet vastgelegd; dat moet nog gebeuren vanuit een omgeving met volledige GitHub-toegang.

Niet gedaan (bewust, valt buiten fase 0): ingelogd beheerportaal, app-decompilatie, browseronderzoek van schermen, iets installeren of draaien.

## 2. Wat van MAWAQIT openbaar is en wat ontbreekt

**Openbaar en bekeken:**

- **mawaqit-js** — officiële TypeScript-bibliotheek om de MAWAQIT-API aan te roepen. Volgens de README kan de API moskeeën zoeken, jaarroosters met iqama, Hijri-instellingen, scherminstellingen en "flash messages" ophalen. Bevat hulpfuncties voor "dag van gebeden" en "volgend gebed" (iqama-offsets, Imsak, Jumu'a, zomertijd).
- **mawaqit-py** — dezelfde bibliotheek in Python, gegenereerd uit dezelfde OpenAPI-beschrijving.
- **mawaqit-tv-l10n** — alleen vertaalteksten voor de TV-app, geen werkende app.
- **prayer-times** — PHP-rekenbibliotheek. Opvallend: de README verwijst naar `islamic-network/prayer-times`, het is dus waarschijnlijk een kopie (fork) van een project van een andere partij, zelf weer gebaseerd op PrayTimes.org.

**Niet openbaar gevonden (volgens vooronderzoek, door mij niet opnieuw gecontroleerd):** de backend, de database, het beheerportaal en de complete mobiele en TV-apps.

**Nuttige aanwijzingen uit de TV-vertalingen** (AFGELEID — een vertaaltekst bewijst niet dat de functie werkt): hoofd- en nevenscherm, modus met alleen mededelingen, schermoriëntatie, offline-status, iqama-aftelling, Jumu'a-scherm, dua tussen adhan en iqama, scherm aan/uit, schermvergrendeling, camera-livestream (RTSP).

**Nuttige aanwijzingen uit de testlijst van mawaqit-js** (IN CODE GEVONDEN): zomertijdwissel, Jumu'a wel/niet, Imsak uit rooster of als minuten vóór Fajr, ontbrekende iqama, Isha na middernacht, fouten van de moskee in de volgorde, tijden zonder voorloopnul, 29 februari, onbekende tijdzone, "volgend gebed" versus "volgende iqama".

Eén test is een **waarschuwing voor ons**: *"after the last Isha of the year, the first Fajr of the calendar"*. MAWAQIT springt na het einde van het jaar dus terug naar het begin van hetzelfde rooster. Onze masterprompt verbiedt dat expliciet (§7.3 en pilotscenario 8): wij tonen dan "rooster niet beschikbaar".

## 3. Wat herbruikbaar lijkt, en onder welke voorwaarden

| Onderdeel | Licentie | Hergebruik? | Voorwaarde / advies |
| --- | --- | --- | --- |
| mawaqit-js code | Apache-2.0 + NOTICE | Juridisch mogelijk, **inhoudelijk niet nodig** | De code is vooral een API-client voor een dienst die wij niet mogen gebruiken. Alleen als inspiratie voor testgevallen. Bij kopiëren: LICENSE + NOTICE meenemen en wijzigingen vermelden. |
| mawaqit-py | Apache-2.0 | Niet nodig | Wij bouwen geen Python-client. |
| mawaqit-tv-l10n | MIT | Mogelijk, maar **niet aanbevolen** | Vrij te gebruiken met naamsvermelding, maar we hebben eigen NL/TR-teksten nodig die door IGMG worden gecontroleerd. Gebruiken als begrippenlijst. |
| prayer-times (PHP) | LGPL-3.0, waarschijnlijk fork van islamic-network | **Niet opnemen** | Andere programmeertaal, strengere licentie, en P0 rekent niet (we tonen alleen aangeleverde officiële roosters). |
| MAWAQIT-API | Niet open | **Nee** | Beide README's zeggen letterlijk dat gebruik buiten de officiële MAWAQIT-apps niet is toegestaan zonder toestemming. |
| MAWAQIT-logo's, beelden, lettertypen | Onbekend | **Nee** | Niet onderzocht, niet gebruiken. |

## 4. Waarom de IGMG-app los moet staan van de MAWAQIT-API

1. **Geen toestemming.** MAWAQIT verbiedt het in de eigen documentatie en kan toegang "zonder waarschuwing" blokkeren. Een moskeescherm dat plots leeg is, is onacceptabel.
2. **Bron van de tijden.** IGMG wil eigen, goedgekeurde roosters tonen. Via MAWAQIT zouden we tijden tonen die een derde partij beheert.
3. **Privacy.** Elke opvraging zou laten zien welke moskee een bezoeker volgt (gevoelige informatie).
4. **Gedrag dat we niet willen.** Bijvoorbeeld het hergebruik van het jaarrooster (zie §2).

Een officiële koppeling kan later alsnog, maar alleen met schriftelijke toestemming, en standaard uitgeschakeld.

## 5. Aanbevolen bouwroute en afbakening van de pilot

**Route: zelfstandige herimplementatie** (geen fork, geen code overnemen).
Er is geen complete openbare basis om te forken, en de bruikbare stukken zijn vooral API-clients. MAWAQIT-code en -tests gebruiken we alleen om te begrijpen welk gedrag lastig is. Let op: dit is "code-geïnformeerd" werk, geen juridisch getoetste clean-room-ontwikkeling.

**Techniek (voorstel):** één TypeScript-project; Next.js voor publieke app + beheer; een lichte aparte kioskpagina voor TV; PostgreSQL; alles samen draaibaar met Docker Compose. Gebedstijdlogica in één gedeeld pakket, zodat app en TV altijd hetzelfde uitrekenen.

**Pilot (P0) in één zin:** Nederlandse IGMG-moskeeën kunnen een goedgekeurd rooster (handmatig of CSV) publiceren, bezoekers zien dat zonder account in NL/TR, en een gekoppeld TV-scherm toont het betrouwbaar, ook offline. Geen meldingen, geen kaart, geen native apps, geen Quran/Qibla.

## 6. Belangrijkste risico's

| Gebied | Risico | Maatregel |
| --- | --- | --- |
| Gebedstijden | Verkeerde tijd door foute import, dubbele zomertijdcorrectie of verkeerde dag bij Isha na middernacht | Import blijft concept tot controle + goedkeuring; tijdzone per moskee; uitgebreide tests (§17) |
| Gebedstijden | Rooster loopt af en de app verzint tijden | Duidelijke melding "rooster niet beschikbaar"; waarschuwing aan beheerder ruim vooraf |
| Offline schermen | TV toont verouderde of halve gegevens | Alleen complete snapshots activeren; geldigheidsdatum tonen; toestand na herstart opnieuw berekenen |
| Offline schermen | Ingetrokken scherm blijft offline werken | Vaste "offline-graceperiode" vastleggen en documenteren |
| Privacy | Moskeevoorkeur verraadt religieuze betrokkenheid | Geen account nodig, favorieten alleen lokaal, geen tracking of advertenties |
| Rechten | Beheerder van moskee A ziet data van moskee B | Rechten controleren op de server bij elke actie; tests met twee organisaties |
| Meldingen | Belofte van "adhan op tijd" die een telefoon niet waarmaakt | Buiten P0; later eerst per platform testen |

## 7. Beslissingen die ik van jullie nodig heb

Alleen deze punten blokkeren fase 1:

1. **Eigenaar en naam.** Wie bij IGMG is eigenaar van dit project (merk, inhoud, privacy)? Mag "IGMG Mescid app" als werktitel zichtbaar in de app staan (zonder logo)?
2. **Bron van de tijden.** Welke organisatie levert de officiële roosters aan (bijv. IGMG centraal of per moskee), en in welk formaat (Excel, PDF, iets anders)? Een voorbeeldbestand helpt enorm.
3. **Pilot-afbakening.** Akkoord met: Nederland, Nederlands + Turks, webapp + beheer + TV-webweergave, nog geen native apps en geen meldingen?
4. **Techniek.** Akkoord met de voorgestelde stack (TypeScript, Next.js, PostgreSQL, Docker)?
5. **Werkplek.** Mag ik in deze repository (`IGMG-namaz-app`, branch `claude/new-session-vcyzpe`) code schrijven voor fase 1? Waar draait de pilot later (eigen server, cloudaanbieder)? Voor fase 1 is alleen lokaal draaien nodig.

Aannames die ik maak tenzij jullie iets anders zeggen: geen dubbele controle verplicht in kleine moskeeën; tijdzone Europe/Amsterdam; demodata altijd zichtbaar gemarkeerd als "Demo".

## 8. Voorstel fase 1: van moskee naar werkende dagweergave

**Wat het oplevert (end-to-end):** een beheerder logt in, maakt binnen de eigen organisatie een demo-moskee aan en voert de gebedstijden voor een aantal dagen in. Een bezoeker zoekt de moskee zonder account en ziet de tijden van vandaag, de iqama en het eerstvolgende gebed.

**Onderdelen:** database met moskee, organisatie, gebruiker en rol; gebedsdagen; beheerscherm; publieke zoek- en dagpagina in NL/TR; gedeelde rekenmodule voor "volgend gebed" / "volgende iqama".

**Verificatie (wordt echt uitgevoerd en gerapporteerd als geslaagd/mislukt/geblokkeerd):**

- Unittests rekenmodule: grens adhan/iqama, Isha na middernacht, zomer-/wintertijd, klok vóór eerste/na laatste gebed, ontbrekende dag → "niet beschikbaar", schrikkeldag.
- Integratietest: beheerder van organisatie A kan via een gewijzigd ID niets van organisatie B lezen of wijzigen.
- Browsertest: bezoeker vindt de demo-moskee en ziet bron, datum, tijdzone, tijden en iqama; wisselen van moskee toont nooit oude tijden; gegevens blijven na herstart bewaard.
- Screenshots van de echte schermen op telefoon- en desktopformaat.

Nog **niet** in fase 1: CSV-import, goedkeuringsflow, TV-scherm, mededelingen (fasen 2–4).

---

### Bronnen

- https://raw.githubusercontent.com/mawaqit/mawaqit-js/main/README.md
- https://raw.githubusercontent.com/mawaqit/mawaqit-js/main/NOTICE
- https://raw.githubusercontent.com/mawaqit/mawaqit-js/main/tests/prayer-times.test.ts
- https://raw.githubusercontent.com/mawaqit/mawaqit-py/main/README.md
- https://raw.githubusercontent.com/mawaqit/mawaqit-tv-l10n/main/LICENSE
- https://raw.githubusercontent.com/mawaqit/mawaqit-tv-l10n/main/l10n/intl_en.arb
- https://raw.githubusercontent.com/mawaqit/prayer-times/master/LICENSE
- https://raw.githubusercontent.com/mawaqit/prayer-times/master/README.md
