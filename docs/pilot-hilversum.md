# Pilot IGMG Hilversum: stappenplan

Eenvoudige stappen om de moskee in Hilversum met echte Diyanet-tijden in de app te krijgen.

## 1. Eenmalig klaarzetten (technisch)

```sh
npm run pilot:setup -w @mescid/web -- --email <jouw e-mailadres> --name "<jouw naam>"
```

Dit maakt de organisatie **IGMG**, de moskee **IGMG Hilversum** (nog **verborgen**, zonder tijden) en jouw beheeraccount.
Je krijgt eenmalig een tijdelijk wachtwoord te zien.

## 2. Inloggen en wachtwoord wijzigen

Ga naar `/beheer`, log in, en kies **Wachtwoord** om meteen een eigen wachtwoord in te stellen.

## 3. Moskeegegevens controleren

Open **IGMG Hilversum** en vul de officiële naam, het adres en de postcode in. Laat **Zichtbaarheid** nog op *Verborgen*.

## 4. Diyanet-tijden importeren

1. Open namazvakitleri.diyanet.gov.tr, kies Nederland en Hilversum (of de afgesproken plaats), en open de maandweergave.
2. Selecteer de tabel, kopieer, en plak die bij **Rooster importeren**.
3. Vul de iqama-minuten in (bijvoorbeeld Öğle 15). Laat leeg wat de moskee niet gebruikt.
4. Klik **Controleren en concept maken**. Bij fouten wordt niets aangemaakt en zie je welke regel niet klopt.

## 5. Controleren en publiceren

Vergelijk een paar dagen met de Diyanet-pagina. Valt Yatsı in de zomer na middernacht, vink dan "+1" aan.
Vink aan dat je het hebt gecontroleerd en klik **Publiceren**.

## 6. Openbaar maken

Zet bij de moskee **Zichtbaarheid** op *Openbaar*. Bezoekers vinden de moskee nu via zoeken.

## 7. Elke maand

Herhaal stap 4 en 5 ruim vóór het einde van de maand. Het beheeroverzicht waarschuwt als het rooster binnen 14 dagen afloopt.

## Nog niet in de pilot

Cuma-tijden, TV-scherm in de moskee, mededelingen en meldingen op de telefoon volgen in latere fasen.
De app moet nog op een server op internet worden gezet; zie "Nog open" in `PLAN.md`.
