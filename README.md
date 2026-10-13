# IGMG Mescid app

Werktitel van een zelfstandig moskeeplatform: bezoekers vinden hun moskee en zien betrouwbare gebedstijden,
beheerders voeren roosters in en publiceren ze. Eigenaar: igmg.org. **Pilotversie, nog niet in productie.**

De app is volledig onafhankelijk van MAWAQIT. Gebedstijden komen uit roosters die een bevoegde beheerder controleert
en publiceert (handmatig, of als concept geïmporteerd uit Diyanet).

## Wat werkt nu (fase 1)

- Publieke app (Nederlands en Turks): moskee zoeken, dagweergave met gebedstijd en iqama, volgend gebed en volgende iqama
  met aftelling, 7-dagenoverzicht, andere datums bekijken, "mijn moskee" zonder account.
- Beheer: inloggen, moskeeën aanmaken en bewerken, roosterconcept invoeren, automatische controle, publiceren, auditlog.
- Rechten per organisatie, regio en moskee (organisatiebeheerder, regiobeheerder, moskeebeheerder, redacteur, publiceerder).
- Diyanet-import als concept (vereist een eigen Diyanet-account, zie `docs/research/diyanet.md`).
- Openbare API: `GET /api/v1/mosques`, `/api/v1/mosques/{id}`, `/api/v1/mosques/{id}/prayer-days`.

Zie `docs/PLAN.md` voor wat nog komt en `docs/verification/fase-1.md` voor de testresultaten.

## Zelf draaien (lokaal)

Nodig: Node.js 22 of nieuwer, en PostgreSQL 16 (zelf geïnstalleerd, of via `docker compose up -d db`).

```sh
npm install
cp apps/web/.env.example apps/web/.env.local   # pas DATABASE_URL en SEED_PASSWORD aan
npm run db:migrate                              # tabellen aanmaken
npm run db:seed                                 # demodata (alleen op een lege database)
npm run build && npm run start                  # of: npm run dev
```

Open daarna http://localhost:3000. Beheer: http://localhost:3000/beheer met een van de demo-accounts
(`beheer-a@demo.invalid`, `redacteur-a@demo.invalid`, `beheer-b@demo.invalid`) en het wachtwoord uit `SEED_PASSWORD`.

Alle demomoskeeën en demotijden zijn **fictief** en staan zo aangegeven.

## Testen

```sh
npm run typecheck
npm test                 # rekenmodule + integratietests (database mescid_test vereist)
npm run test:e2e         # browsertests tegen een echte build (database mescid_e2e vereist)
```

## Diyanet-tijden importeren

```sh
# met eigen Diyanet-account in apps/web/.env.local (DIYANET_EMAIL / DIYANET_PASSWORD)
npm run import:diyanet -w @mescid/web -- --mosque <slug> --city-id <Diyanet-plaats-ID> --period Monthly
```

Dit maakt alleen een **concept**. Een bevoegde beheerder controleert en publiceert het daarna in /beheer.

## Projectindeling

```text
packages/domain/     gedeelde tijdlogica (volgend gebed, iqama, zomertijd, Isha na middernacht) + tests
apps/web/            Next.js: publieke app, beheer, API, servermodules (src/server), scripts, tests
database/migrations/ SQL-migraties
docs/                onderzoek, besluiten, verificatie, beheer
```
