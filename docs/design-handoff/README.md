# tracker-handoff

Ontwerppakket voor de makeover van Tracker.

- `AGENT_PROMPT.md`  de opdracht die je aan de coder-AI geeft
- `DESIGN.md`        volledige specificatie (lezen voor je codeert)
- `tokens/`          tokens.css en tokens.json
- `screens/`         één .dc.html per scherm (leesbare specificatie, draait niet los) + canvas.json

Voorbeelddata: alle cijfers in de schermen zijn verzonnen.

Training: `screens/TrainingB1.dc.html` is het definitieve ontwerp voor de set-registratie (klikbaar prototype). `Training.dc.html` blijft de referentie voor de rest van de flow (overzicht-sheet, oefening toevoegen/overslaan, klaar-toestand, viering), maar de set-indeling daarin is verouderd. `TrainingA1-A3` en `TrainingB2` (superset-schets) zijn verworpen/uitgesteld: niet bouwen.

Unilateraal: `screens/TrainingD1U.dc.html` is het definitieve ontwerp voor oefeningen die links en rechts apart worden gelogd. Supersets zijn nog niet ontworpen; `TrainingC1-C3` zijn verworpen en niet bedoeld om te bouwen.

Nieuw (laatste overdracht): `screens/TrainingE1.dc.html` (gewone oefening, vervangt B1), `TrainingE2.dc.html` (superset), en `TrainingD1U.dc.html` (unilateraal, mist nog schuifrij en rust-balk). Lees `AGENT_PROMPT.md` stap 0: eerst deployen wat er is en eigen wijzigingen tegen dit ontwerp controleren.
