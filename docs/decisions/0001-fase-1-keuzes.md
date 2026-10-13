# Besluit 0001: keuzes voor fase 1

**Datum:** 13 oktober 2026 · **Status:** aangenomen (goedgekeurd door opdrachtgever)

| Onderwerp | Besluit | Reden |
| --- | --- | --- |
| Eigenaar | igmg.org | Opgegeven door opdrachtgever. Geen IGMG-logo gebruikt tot dat is aangeleverd. |
| Bouwroute | Zelfstandige herimplementatie, geen MAWAQIT-code, geen MAWAQIT-API | Zie fase 0-rapport. |
| Tijdbron | Diyanet, als concept-import; handmatige invoer altijd mogelijk | Besluit opdrachtgever; zie `docs/research/diyanet.md` voor het Hicret Takvimi-aandachtspunt. |
| Pilot | Nederland, NL + TR, webapp + beheer (TV-scherm in fase 3) | Goedgekeurd. |
| Stack | TypeScript, Next.js 16.4, React 19.2, PostgreSQL 16, Node 22 | Goedgekeurd. Next 16 i.p.v. 15 omdat 15.5 een kwetsbare postcss-versie meelevert. |
| Tijdrekenen | `temporal-polyfill` (Temporal-standaard) | Exacte afhandeling van zomertijd: niet-bestaande en dubbele tijden worden herkend en geweigerd. |
| Database-toegang | `pg` met handgeschreven SQL-migraties | Weinig afhankelijkheden, transparant, makkelijk te controleren. |
| Wachtwoorden | Argon2id via `@node-rs/argon2`; sessietokens alleen gehasht opgeslagen | Bewezen bibliotheek, geen eigen cryptografie. |
| Publicatie | Roosterversies; publiceren in één transactie; laatst gepubliceerde wint bij overlap | Bezoekers zien nooit een half rooster. |
| Gelijktijdig bewerken | Versienummer (optimistische vergrendeling) | Geen stille overschrijving. |
| Favoriete moskee | Alleen in de browser (localStorage) | Geen account en geen gevoelige gegevens op de server. |
| Beheerinterface | Alleen Nederlands in fase 1 | Bezoekersapp is NL + TR; beheer volgt later. |
| MFA voor beheerders | Nog niet in fase 1 | Vereist vóór productie (zie PLAN). |
