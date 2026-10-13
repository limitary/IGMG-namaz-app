# Begrippen

Eén betekenis in alle onderdelen (app, beheer, later TV en mobiel). Interne sleutels tussen haakjes.

| Begrip | Betekenis |
| --- | --- |
| Organisatie (`organization`) | Beheersgrens van een zelfstandig netwerk. Gegevens lopen nooit over organisaties heen. |
| Regio (`region`) | Onderverdeling binnen één organisatie. Geeft geen recht op andere organisaties. |
| Moskee / mescid (`mosque`) | Locatie met eigen tijdzone, rooster en beheerders. Interne ID is vast; de slug (webadres) mag wijzigen. |
| Gebedstijd / adhan (`adhan`) | Begin van de tijd voor een gebed volgens het gepubliceerde rooster. |
| Iqama (`iqama`) | Aanvang van het gezamenlijke gebed in de moskee. Optioneel per gebed. Fase 1: vast tijdstip per dag. |
| Imsak (`imsak`) | Afzonderlijk roostergegeven. Wordt nooit afgeleid uit Fajr. |
| Zonsopkomst / shuruq (`sunrise`) | Gebeurtenis, geen van de vijf gebeden. Heeft geen iqama. |
| Jumu'ah / Cuma | Vrijdaggebed. **Nog niet in fase 1** (komt in fase 2 als aparte diensten). |
| Roosterdatum | De datum waartoe een rij hoort. Isha na middernacht hoort bij de vorige roosterdatum (`dayOffset: 1`). |
| Dagverschuiving (`dayOffset`) | 0 = op de roosterdatum, 1 = na middernacht. Alleen toegestaan voor Isha en Isha-iqama. |
| Concept / gepubliceerd / vervangen / verworpen | Toestanden van een roosterversie. Opslaan is niet publiceren. |
| Roosterversie (`schedule_version`) | Een set dagen voor één moskee en periode, met bron. Bij overlap wint de laatst gepubliceerde. |
| Bron (`prayer_source`) | Waar de tijden vandaan komen: handmatig, Diyanet of (later) CSV. Altijd zichtbaar voor bezoekers. |
