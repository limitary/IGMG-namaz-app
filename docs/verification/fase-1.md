# Verificatie fase 1: moskee naar werkende dagweergave

**Datum:** 13 oktober 2026 · **Omgeving:** Linux-container, Node 22.22.0, PostgreSQL 16, Chromium (Playwright 1.56.1), productiebuild van Next.js 16.4.0.

Elke controle is echt uitgevoerd. Status: **geslaagd**, **mislukt**, **geblokkeerd** of **niet uitgevoerd**.

## Testresultaten

| Controle | Commando | Resultaat |
| --- | --- | --- |
| Typecheck (domein + web) | `npm run typecheck` | geslaagd |
| Rekenmodule (28 tests) | `npm test -w @mescid/domain` | geslaagd: 28/28 |
| Integratie + Diyanet + demodata (45 tests, echte PostgreSQL) | `npm test -w @mescid/web` | geslaagd: 45/45 |
| Browsertests desktop + mobiel (21 tests, productiebuild) | `npm run test:e2e` | geslaagd: 21/21 |
| Productiebuild | `npm run build` | geslaagd |
| Kwetsbaarheden afhankelijkheden | `npm audit` | geslaagd: 0 gevonden |
| Gegevens na herstart app én database | handmatig (`next start`, `pg_ctl restart`, API opvragen) | geslaagd: zelfde 3 moskeeën |
| Back-up terugzetten in schone database | `pg_dump -Fc` + `pg_restore` | geslaagd: 3 moskeeën, 135 roosterdagen, 3 auditregels, checksum identiek |
| Tests in GitHub Actions | `.github/workflows/ci.yml` | niet uitgevoerd (draait na push; resultaat nog niet gezien) |
| Echte Diyanet-API | — | geblokkeerd: geen account, en domein niet bereikbaar vanuit deze omgeving |
| Screenreader-test, tekstvergroting, contrastmeting | — | niet uitgevoerd |
| Echte telefoon / echte browsers buiten Chromium | — | niet uitgevoerd |

## Wat de rekenmodule test (selectie)

Zomertijd (niet-bestaande tijd 02:30 op 28-3-2027 geweigerd), wintertijd (dubbele tijd geweigerd), tijden zonder handmatige
zomertijdcorrectie, ongeldige tijdzone, schrikkeldag, `03/04/2027` geweigerd, verkeerde volgorde, iqama vóór adhan, iqama bij
zonsopkomst geweigerd, Imsak los van Fajr, exact op het adhan- en iqama-moment, volgende adhan vs. volgende iqama, zonsopkomst
geen gebed, na laatste Isha → Fajr van morgen, ontbrekende morgen → "schedule-ended", ontbrekend nieuw jaar → geen hergebruik,
Isha en iqama na middernacht (00:05, 00:20, nooit negatieve countdown), gebruiker in andere tijdzone dan moskee.

## Pilotscenario's uit de masterprompt (§19)

| # | Scenario | Status fase 1 |
| --- | --- | --- |
| 1 | Anonieme bezoeker ziet bron, datum, tijdzone, tijden, iqama | geslaagd (e2e desktop + mobiel) |
| 2 | Wisselen van moskee toont geen oude data | geslaagd (e2e) |
| 3 | Onbevoegde beheerder kan via gewijzigd ID niets lezen/wijzigen | geslaagd (integratie + e2e, HTTP 404) |
| 4 | Import met fouten blijft concept, publieke tijden ongewijzigd | geslaagd (integratie + e2e) |
| 5 | Wijziging bereikt app en scherm binnen afgesproken tijd | deels: app direct na publicatie; scherm volgt in fase 3; doel nog af te spreken |
| 6 | App en TV zelfde versie en volgende gebeurtenis | niet uitgevoerd (TV is fase 3; gedeelde rekenmodule is al klaar) |
| 7 | Isha na middernacht: juiste roosterdatum, geen negatieve countdown | geslaagd (unit + integratie) |
| 8 | Ontbrekend volgend jaar → "niet beschikbaar" | geslaagd (unit + e2e) |
| 9 | Offline / herstart met geldige cache | niet uitgevoerd (fase 3) |
| 10 | Intrekken devicecredential | niet uitgevoerd (fase 3); intrekken beheerrol wel getest |
| 11 | Mededeling op de juiste tijd | niet uitgevoerd (fase 4) |
| 12 | Gegevens na herstart en uit back-up | geslaagd (handmatig) |
| 13 | Leesbaar op echt doelapparaat | niet uitgevoerd |
| 14 | Geen kernflow vereist MAWAQIT | geslaagd (geen enkele MAWAQIT-verwijzing in de code) |
| 15 | Licentie-/herkomstregistratie | geslaagd (`THIRD_PARTY.md`) |

## Schermafbeeldingen

- `screenshots/moskee-mobiel.png`: dagweergave op telefoonformaat (Pixel 7)
- `screenshots/moskee-desktop.png`: dagweergave op desktop
- `screenshots/beheer-concept.png`: roosterconcept na controle, klaar om te publiceren

Alle getoonde moskeeën en tijden zijn fictieve demodata.

## Bekende beperkingen

- Vrijdaggebed (Jumu'ah), iqama-regels als offset, CSV-import en rollback-knop: fase 2.
- TV-/kioskscherm en offline werking: fase 3. Mededelingen: fase 4.
- Beheerinterface alleen in het Nederlands; Turkse teksten in de bezoekersapp moeten nog door een moedertaalspreker/inhoudelijk reviewer gecontroleerd worden.
- Geen MFA, geen gebruikersbeheer in de interface (accounts nu via seed/database), geen wachtwoord-reset.
- Diyanet-koppeling niet getest tegen de echte API; `Weekly`/`Monthly`-endpoints en veldnamen moeten met een echt account bevestigd worden.
- De "aangemaakt"-datum in beheer is in UTC weergegeven.
