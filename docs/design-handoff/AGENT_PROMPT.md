# Opdracht voor de coder-AI: Tracker-makeover

Kopieer dit als eerste bericht aan de coder-AI (Claude Code, Cursor of vergelijkbaar), met de map `tracker-handoff/` naast de repo of in de repo gezet.

---

Je gaat de frontend van Tracker, mijn trainingsapp (https://tracker.app.maartenveldink.nl/), een nieuw uiterlijk en een nieuwe trainingservaring geven. Het ontwerp is af en staat in `tracker-handoff/`.

**Stap 0, voordat je iets van dit ontwerp toepast. Dit is verplicht:**
1. **Deploy eerst wat je nu hebt.** Zorg dat alles wat je al gebouwd hebt (ook de wijzigingen die je tussen de vorige overdracht en nu hebt gemaakt) gecommit is, dat de tests slagen en dat het is uitgerold via de gebruikelijke route. Zo is er een veilig terugvalpunt. Kun je niet deployen, of is er iets onduidelijk over de route, vraag het mij en ga niet door met nieuwe wijzigingen.
2. **Controleer daarna je eigen wijzigingen tegen dit ontwerp.** Loop per scherm langs wat je zelf hebt aangepast (met name het trainingsscherm: set-registratie, bolletjes/set-voortgang, rust-timer, header, Gedaan-lijst, tokens en kleurnamen, en het datamodel voor sets) en zet naast elkaar wat het nieuwe ontwerp daarover zegt. Maak een korte lijst met (a) overlap, (b) conflicten, (c) dingen die jij beter hebt gedaan dan het ontwerp. **Leg de conflicten aan mij voor, met een voorstel, voordat je ze oplost.** Overschrijf niets van je eerdere werk zonder dat je het hebt vergeleken.

**Nieuw in deze overdracht (alles op het trainingsscherm):** `TrainingE1.dc.html` (gewone oefening, vervangt `TrainingB1`), `TrainingE2.dc.html` (superset) en bij `TrainingD1U.dc.html` (unilateraal) de schuifrij en rust-balk uit E1. Details: §0, §4, §5, §6 en §12 van `DESIGN.md`.

**Lees eerst, in deze volgorde:**
1. `tracker-handoff/DESIGN.md`: de volledige specificatie (tokens, componenten, schermen, regels, formules, bouwvolgorde). Dit is de bron van waarheid voor uiterlijk.
2. `tracker-handoff/tokens/tokens.css` en `tokens.json`: de kleuren, fonts, maten.
3. `tracker-handoff/screens/*.dc.html`: één bestand per scherm. Ze draaien niet los in een browser. Lees de inline stijlen voor exacte maten en `renderVals()` voor voorbeelddata en logica (met name `TrainingE1.dc.html`, `TrainingE2.dc.html`, `TrainingD1U.dc.html`, `Training.dc.html`, `Habits.dc.html`, `Moment.dc.html`). **Training:** `TrainingE1.dc.html` is het definitieve ontwerp van de set-registratie en wint van de set-indeling in `Training.dc.html` (dat bestand blijft de referentie voor overzicht-sheet, toevoegen/overslaan, klaar-toestand en viering). Supersets: `TrainingE2.dc.html`. Unilaterale oefeningen (links/rechts apart loggen): `TrainingD1U.dc.html` (pas daar de schuifrij en rust-balk van E1 op toe). `TrainingB1` is verouderd door E1. Bouw `TrainingA1-A3`, `TrainingB2` en `TrainingC1-C3` niet.

**Werkwijze:**
- Begin met een inventaris van de repo en vul de lijst "Controleer in de repo" (§12 van DESIGN.md) in. Laat me weten wat je vindt voordat je aan stap 2 begint, als iets het ontwerp raakt.
- Werk in de bouwvolgorde van §13 en in kleine stappen die ik apart kan reviewen. Houd de app na elke stap werkend.
- Pas **geen** backend, API-contracten of datamodel aan, tenzij een afgeleide waarde uit §9 echt ontbreekt. Bespreek dat eerst. Let op: unilaterale oefeningen (links én rechts apart) en supersets (groepen met rondes) vragen vrijwel zeker een uitbreiding van het datamodel (§9). Leg die uitbreiding aan mij voor voordat je bouwt.
- Gebruik de tokens, geen losse hex-waarden. Gebruik `--color-line-strong` voor randen van invoervelden en niet-actieve controls (zie §3, "Bekende afwijking").
- De mockups zijn voorbeelddata. Koppel alles aan echte data.
- Wijkt de repo af van het ontwerp voor gedrag of data, dan wint de repo. Voor uiterlijk wint het ontwerp. Twijfel je, vraag het mij.
- Maak voor nieuwe logica (training-toestanden §6, formules §7, viering-trigger §8) eenheidstests.
- Open ontwerpvragen voor het trainingsscherm staan in §12 (set verwijderen, verschil per set, rust-ring zonder actieve rust, hoe een oefening als unilateraal of superset wordt gemarkeerd, superset in het overzicht-sheet en bij de viering, fade per rand). Stel ze aan mij voordat je een eigen keuze maakt.
- Bouw niet wat niet ontworpen is zonder overleg (lijst in §2), behalve waar §2 zegt dat je het patroon mag volgen.

**Klaar als** de punten onder "Klaar als" in §13 gelden. Geef bij elke oplevering een korte samenvatting: wat is gebouwd, wat is afgeweken, welke vragen staan open.
