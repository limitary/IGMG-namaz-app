# Back-up en herstel (pilot)

Alle gegevens staan in PostgreSQL. De app zelf bewaart niets lokaal.

## Back-up maken

```sh
pg_dump -h <host> -U mescid -Fc mescid -f mescid-$(date +%F).dump
```

Bewaar back-ups versleuteld en buiten de server. De RPO/RTO (hoeveel data je maximaal kwijt mag raken, hoe snel herstel moet)
moet nog met de eigenaar worden afgesproken.

## Terugzetten (in een lege database)

```sh
createdb -h <host> -U postgres -O mescid mescid_herstel
pg_restore -h <host> -U mescid -d mescid_herstel mescid-JJJJ-MM-DD.dump
```

Zet daarna `DATABASE_URL` naar de herstelde database en start de app.

## Getest

Op 13 oktober 2026 is een back-up gemaakt en teruggezet in een schone database. Aantal moskeeën, roosterdagen,
auditregels en een checksum over alle roosterdagen waren identiek. Zie `docs/verification/fase-1.md`.

## Schema-updates

`npm run db:migrate` past nieuwe migraties toe, elk in een eigen transactie. Een al uitgevoerde migratie die achteraf wordt
gewijzigd, wordt geweigerd. Maak altijd eerst een back-up.
