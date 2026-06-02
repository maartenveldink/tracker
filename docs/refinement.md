# Refinement — UX-verbeteringen tijdens training
*Versie 1.0 | Datum: 2026-06-02*

> Geïntegreerd in requirements.md op 2026-06-02.

---

Dit document beschrijft UX-verbeteringen voor het live logging-scherm en de bredere trainingservaring. Het vertrekpunt is de huidige implementatie van Epic 3 (WorkoutPage, StartWorkoutPage, WorkoutSummaryPage). De centrale vraag bij elke requirement: kost dit de gebruiker minder moeite dan de huidige situatie?

---

## Thema 1 — Rusttimer

**Doel:** De gebruiker hoeft niet op zijn horloge of telefoonklok te kijken om de rusttijd bij te houden. Zodra een set is afgerond, start de app automatisch de timer.

| ID | Status | Requirement |
|----|--------|-------------|
| RT-01 | — | Zodra de gebruiker een set als voltooid markeert (vinkje), start het systeem automatisch een afteltimer met een instelbare standaardduur (zie RT-05). De timer is per actieve set zichtbaar direct onder of in de setrij. |
| RT-02 | — | De resterende rusttijd wordt weergegeven als aftellende klok (MM:SS) met een visuele voortgangsindicator (balk of cirkel) die krimpt naarmate de rusttijd verstrijkt. |
| RT-03 | — | Wanneer de rusttimer afloopt geeft de app een signaal: trillen (via Vibration API) op mobiel, aangevuld met een kort hoorbaar geluid. Beide signalen zijn afzonderlijk in- of uitschakelbaar via de instellingen. |
| RT-04 | — | De gebruiker kan de lopende timer handmatig vroeg stoppen ("Sla over") of opnieuw starten ("Reset"). Beide acties zijn bereikbaar met één tik vanuit het loggingscherm. |
| RT-05 | — | De standaard rusttijdsduur is instelbaar via het instellingenscherm (E8) in stappen van 15 seconden, met een minimum van 15 seconden en een maximum van 10 minuten. Standaardwaarde: 90 seconden. |
| RT-06 | — | De rusttijdsduur is ook per oefening overschrijfbaar: in het schema-formulier (E2) en vanuit het live loggingscherm via een contextmenu per oefening. De oefening-specifieke waarde heeft voorrang boven de globale instelling. |
| RT-07 | — | Wanneer er een actieve rusttimer loopt en de gebruiker navigeert weg van de WorkoutPage (bv. naar een andere tab), blijft de timer doorlopen en geeft het signaal af zodra hij afloopt, ook als de app op de achtergrond staat (via Web Notification of Vibration API). |
| RT-08 | — | Er is maximaal één actieve rusttimer tegelijkertijd. Als de gebruiker een nieuwe set voltooit terwijl er al een timer loopt, herstart de timer op de ingestelde duur. |

---

## Thema 2 — Snel loggen

**Doel:** Het aantal tikken per set terugbrengen. Momenteel moet de gebruiker twee invoervelden aanraken (kg en reps) en daarna het vinkje. Door slimme defaults en snelle invoerpatronen wordt dit sneller.

| ID | Status | Requirement |
|----|--------|-------------|
| SL-01 | — | Bij het openen van een set toont het systeem het gewicht en het aantal reps van dezelfde set uit de meest recente voltooide sessie met dit schema als prefill. Als er geen vorige sessie is, blijven de velden leeg (huidig gedrag). |
| SL-02 | — | Naast de kg- en reps-invoer verschijnt een "Zelfde als vorige" knop (of geste) die met één tik het gewicht en reps van de corresponderende set uit de vorige sessie overneemt en de set direct als voltooid markeert. |
| SL-03 | — | Het gewicht-invoerveld biedt snelle aanpassingsknoppen (+/−) voor veelgebruikte stappen: +2,5 kg / −2,5 kg en +5 kg / −5 kg, bereikbaar zonder het toetsenbord te openen. |
| SL-04 | — | Het reps-invoerveld biedt +1 / −1 knoppen naast het veld, zodat kleine afwijkingen van de geplande reps met één tik aanpasbaar zijn. |
| SL-05 | — | Wanneer de gebruiker het kg-veld of reps-veld aanraakt, selecteert het systeem automatisch de volledige inhoud, zodat de gebruiker direct kan overtypen zonder eerst te wissen. |
| SL-06 | — | De eerstvolgende niet-voltooide set wordt visueel gemarkeerd als "actieve set" (bv. lichte accentkleur of pijl-indicator) zodat de gebruiker in één oogopslag ziet waar hij is. |
| SL-07 | — | Na het voltooien van de laatste set van een oefening scrollt de pagina automatisch naar de volgende oefening (soepele animatie), mits er geen actieve rusttimer loopt. Als er een rusttimer actief is, wacht het systeem met scrollen tot de timer is afgelopen of de gebruiker hem overslaat. |
| SL-08 | — | Het systeem biedt een "Herhaal vorige set" knop per oefening waarmee gewicht en reps van de vorige set (binnen dezelfde sessie) worden overgenomen naar de eerstvolgende open set, zonder de set meteen als voltooid te markeren. |

---

## Thema 3 — Navigatie tijdens training

**Doel:** De gebruiker moet snel kunnen wisselen tussen oefeningen, een oefening kunnen opzoeken en terugkeren naar de training zonder data te verliezen of moeite te doen.

| ID | Status | Requirement |
|----|--------|-------------|
| NAV-01 | — | Bovenaan het loggingscherm verschijnt een horizontaal scrollende oefeningen-navigatiebalk met de naam (verkort) van elke oefening in de training. De actieve oefening is gemarkeerd. Tikken op een naam scrollt direct naar die oefening. |
| NAV-02 | — | De navigatiebalk (NAV-01) toont per oefening een compacte voortgangsindicator: het aantal voltooide sets t.o.v. het totaal (bv. "3/4"), inclusief een kleurcodering: grijs = niet gestart, amber = gedeeltelijk, groen = volledig voltooid. |
| NAV-03 | — | Vanuit het loggingscherm is met één tik de detailpagina van een oefening (trainingshistorie, E4) te bereiken via een icoon in de oefening-header. Na het sluiten keert de gebruiker terug naar exact dezelfde positie in het loggingscherm. |
| NAV-04 | — | Het loggingscherm toont een vaste "Afronden"-knop onderaan het scherm (floating action area) naast de timer, zodat de gebruiker altijd zichtbaar kan afronden zonder naar de header te scrollen. |
| NAV-05 | — | Wanneer de gebruiker de app sluit en heropent tijdens een actieve training, navigeert de app automatisch terug naar het loggingscherm (WorkoutPage) van de actieve training, zonder tussenkomst van de gebruiker. |
| NAV-06 | — | De "Oefening toevoegen"-sheet (huidig onderaan de lijst) is ook bereikbaar via de navigatiebalk (NAV-01) als laatste item met een "+" icoon, zodat de gebruiker niet hoeft te scrollen naar het einde van de lijst. |

---

## Thema 4 — Motivatie en feedback

**Doel:** De gebruiker krijgt tijdens en na de training relevante, beknopte terugkoppeling die inspireert zonder af te leiden.

| ID | Status | Requirement |
|----|--------|-------------|
| MF-01 | — | Wanneer een oefening volledig is afgerond (alle sets voltooid of overgeslagen), toont de oefening-header een duidelijke "voltooid"-markering (bv. groen vinkje naast de naam) zodat de gebruiker direct overzicht heeft. |
| MF-02 | — | Bij het voltooien van de laatste set van een oefening toont het systeem een korte inline-melding (bv. toast of subtiele animatie) met de beste set van die oefening in vergelijking met de vorige sessie: bv. "Beste set: 80 kg x 8 — +2,5 kg t.o.v. vorige sessie". |
| MF-03 | — | Op het samenvattingsscherm (WorkoutSummaryPage) toont het systeem een persoonlijk record-melding per oefening als de geschatte 1RM van deze sessie hoger is dan alle voorgaande sessies. |
| MF-04 | — | Het samenvattingsscherm toont een vergelijking met de vorige sessie van hetzelfde schema: totaal volume deze sessie t.o.v. vorige sessie, met een +/− verschil. |
| MF-05 | — | Het samenvattingsscherm toont een "Streak"-indicator: het aantal opeenvolgende weken dat de gebruiker minimaal één training heeft voltooid. |
| MF-06 | — | De training-timer in de header van WorkoutPage toont naast de verstreken tijd ook de geschatte resterende tijd op basis van de gemiddelde set-duur (sets voltooid / verstreken tijd) en het aantal resterende sets. De schatting is pas zichtbaar na minimaal 2 voltooide sets. |

---

## Thema 5 — Continuïteit tussen sessies

**Doel:** De app onthoudt relevante context van de vorige sessie, zodat de gebruiker niet handmatig hoeft te reconstrueren wat hij eerder deed.

| ID | Status | Requirement |
|----|--------|-------------|
| CT-01 | — | Bij het starten van een training vanuit een schema toont het systeem per oefening de datum en de beste set (gewicht x reps) van de meest recente sessie met datzelfde schema, als subtekst onder de oefeningnaam. |
| CT-02 | — | Het StartWorkoutPage toont per schema de datum van de laatste sessie en het aantal dagen geleden (bv. "Laatste sessie: 3 dagen geleden") als subtekst onder de schema-naam. |
| CT-03 | — | Het systeem biedt bij het starten van een schema de optie "Kopieer gewichten van vorige sessie": hiermee worden alle kg-velden van alle sets geprefilled met de gewichten uit de corresponderende sets van de meest recente sessie. De gebruiker kan dit per set nog aanpassen. |
| CT-04 | — | Op de oefening-header in het loggingscherm is zichtbaar of de geplande sets en gewichten zijn verhoogd, verlaagd of gelijk zijn t.o.v. de vorige sessie via een klein pijltje-icoon (omhoog / omlaag / gelijk), gebaseerd op de geprefillde waarden. |
| CT-05 | — | Na het afronden van een training stelt het samenvattingsscherm de volgende schema-dag voor (conform de logica van E2-11) inclusief een snelstartknop "Plan volgende sessie", die de gebruiker direct terugbrengt naar StartWorkoutPage met dat schema geselecteerd. |
| CT-06 | — | Wanneer een gebruiker een training start vanuit hetzelfde schema als de vorige sessie en de vorige sessie minder dan 48 uur geleden was, toont het systeem een niet-blokkerende waarschuwing: "Je hebt dit schema recent al gedaan. Weet je het zeker?" met een optie om toch door te gaan. |

---

*Dit document is een levend artefact en dient als input voor sprint-refinement. Requirements met status `—` zijn nog niet geïmplementeerd en hebben geen prioritering toegewezen gekregen; dat gebeurt tijdens de refinement-sessie.*
