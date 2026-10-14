# Diyanet als bron voor gebedstijden

**Datum:** 13–14 oktober 2026 · **Besluit eigenaar:** Diyanet is leidend. Er komt **geen** Diyanet API-account.

## Wat ik heb gevonden

| Bevinding | Label |
| --- | --- |
| Diyanet biedt een officiële API: "Awqat Salah" op `awqatsalah.diyanet.gov.tr`. | GEDOCUMENTEERD (via openbare clientcode) |
| Die API vereist **inloggen met een eigen account** (e-mail + wachtwoord) en geeft tokens van ca. 30 minuten. Hij is dus niet "vrij te gebruiken zonder afspraak". | IN CODE GEVONDEN (pydiyanet 0.1.2) |
| Endpoints: `/Auth/Login`, `/api/Place/Countries`, `/api/Place/States/{land}`, `/api/Place/Cities/{provincie}`, `/api/PrayerTime/Daily/{plaats}`. `Weekly`/`Monthly` zijn AFGELEID en nog niet bevestigd. | IN CODE GEVONDEN / AFGELEID |
| Gebruiksvoorwaarden, limieten en hoe je een account krijgt heb ik **niet** kunnen vinden of lezen. | ONBEKEND |
| `diyanet.gov.tr`, `awqatsalah.diyanet.gov.tr` en `igmg.org` waren vanuit deze ontwikkelomgeving niet bereikbaar (netwerkbeleid). De koppeling is daarom getest met een nagebootste server, **niet** tegen de echte API. | WAARGENOMEN |
| Diyanet deelt de eigen rekenmethode niet; berekende "Diyanet-achtige" tijden kunnen tot 40 minuten afwijken. Zelf narekenen is dus geen optie. | GEDOCUMENTEERD (ontwikkelaarsforum) |
| Diyanet noemt de eerste tijd "İmsak"; in de API heet dat veld `fajr`. | AFGELEID |

## Belangrijk aandachtspunt voor IGMG

De IGMG-app zelf toont tijden uit de **Hicret Takvimi** (eigen IGMG-kalender), niet per se Diyanet-tijden. Als IGMG-moskeeën
in Nederland nu de Hicret-tijden gebruiken, kan het tonen van Diyanet-tijden verschillen geven met wat in de moskee hangt
(soms tientallen minuten bij Fajr en Isha). **Laat de inhoudelijk verantwoordelijke bij IGMG bevestigen welke bron leidend is.**
De app ondersteunt beide: de bron wordt per rooster vastgelegd en aan bezoekers getoond.

## Gekozen werkwijze (zonder account)

Omdat er geen API-account komt, kopieert een beheerder de **maandtabel** van namazvakitleri.diyanet.gov.tr en plakt die in
het beheer ("Rooster importeren"). De app leest per regel de datum en de zes tijden (İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı),
maakt er een concept van, toont fouten en verschillen, en een mens publiceert. Iqama kan als "aantal minuten na de gebedstijd"
worden meegegeven. Er wordt **niet** automatisch van de Diyanet-website gelezen (geen scraping).

Let op: ik kon de Diyanet-website niet zelf openen, dus de exacte vorm van de gekopieerde tabel is AFGELEID. De lezer is ruim
(tab, puntkomma, spaties; datums als `14.10.2026`, `2026-10-14` of `14 Ekim 2026`), maar weigert alles wat dubbelzinnig is.
Bij de eerste echte import: controleer de tijden van een paar dagen met de Diyanet-pagina.

Of Hilversum als aparte plaats in de Diyanet-lijst voor Nederland staat, heb ik niet kunnen controleren. Staat het er niet in,
dan moet IGMG kiezen welke nabije plaats (bijv. Amsterdam of Utrecht) leidend is.

## Hoe de app ermee omgaat

1. Diyanet wordt **nooit** live aangeroepen bij een bezoek. Een beheerder (of later een geplande taak) importeert tijden.
2. Een import wordt een **concept**. Pas na controle en een bewuste klik op "Publiceren" zien bezoekers de tijden.
3. De parser is streng: onbekende datumvormen, ontbrekende velden of dubbele dagen laten de hele import mislukken.
4. Een Isha die vóór Maghrib lijkt te vallen wordt **niet** automatisch naar "na middernacht" verschoven; de controle markeert dat.
5. Zonder `DIYANET_EMAIL`/`DIYANET_PASSWORD` staat de koppeling uit; handmatige invoer werkt altijd.

## Alleen nodig als later tóch een API-account komt

- Een Diyanet-account voor IGMG aanvragen en de voorwaarden lezen (mag hergebruik in een eigen app? limieten?).
- Per pilotmoskee de juiste Diyanet-plaats-ID opzoeken (via `/api/Place/...`).
- Eén echte import doen en het resultaat naast het officiële Diyanet-rooster leggen.
