# Refinement — Rusttijd per set & lateraliteit
*Versie 1.0 | Datum: 2026-07-21*

---

Dit document beschrijft het instelbaar maken van de rusttijd tussen sets op schema-niveau, een expliciete invoer voor de per-oefening standaardrust, en het vastleggen van lateraliteit (bilateraal/unilateraal) per oefening om slimmere standaard-rusttijden af te leiden.

Vertrekpunt is de bestaande rusttimer (thema RT in `refinement.md`, geïmplementeerd in `WorkoutPage.tsx`). Nu bestaat er al een globale standaardrust (`AppSettings.restTimerSeconds`, 90s) en een impliciete per-oefening waarde (`Exercise.restTimerSeconds`, alleen gezet via de live timer). Deze refinement voegt een derde, specifieker niveau toe (rust per oefening ín een schema) en maakt de per-oefening default expliciet instelbaar.

---

## Resolutie-volgorde effectieve rusttijd

De timer bepaalt de rusttijd van specifiek naar algemeen. De eerste waarde die gezet is, wint:

1. `SchemaExercise.restSeconds` — expliciet ingesteld bij de oefening in dít schema.
2. `Exercise.restTimerSeconds` — expliciete per-oefening standaardrust.
3. **Lateraliteit-default** — afgeleid uit `Exercise.laterality` + globale instelling (zie LAT-04).
4. `AppSettings.restTimerSeconds` — globale standaardrust (geldt wanneer lateraliteit onbekend is).

In de invoer-UI wordt de geërfde waarde uit de eerstvolgende gezette laag als **placeholder** getoond, zodat de gebruiker ziet wat er geldt zonder iets in te vullen.

---

## Thema 1 — Rusttijd per set in het schema

**Doel:** De gebruiker kan per oefening in een schema de rusttijd tussen sets vastleggen, met dezelfde +/‑ invoer als de overige velden (sets, reps, startgewicht).

| ID | Status | Requirement |
|----|--------|-------------|
| RST-01 | — | In het schema-formulier (E2) heeft elke oefening een rust-veld met een +/‑ stepper, naast de bestaande velden voor sets en reps. |
| RST-02 | — | De +/‑ stepper wijzigt de rusttijd in stappen van 15 seconden. |
| RST-03 | — | De rusttijd wordt weergegeven als `M:SS` (bijv. `1:00`, `1:30`, `0:45`). |
| RST-04 | — | Er is geen harde standaardwaarde bij het toevoegen van een oefening: `restSeconds` blijft ongezet (undefined) en het veld toont de geërfde waarde (zie resolutie-volgorde) als placeholder. |
| RST-05 | — | De rusttijd kent een minimum van 15 seconden en een maximum van 600 seconden (consistent met de globale instelling RT-05). |
| RST-06 | — | De ingestelde waarde wordt opgeslagen als `SchemaExercise.restSeconds` en blijft behouden na opslaan en heropenen van het schema. |
| RST-07 | — | Bij elke oefening met een gezette `restSeconds` is een reset-actie ("gebruik standaard") beschikbaar die de waarde terugzet naar undefined, analoog aan de bestaande reset van het startgewicht. |
| RST-08 | — | De live workout gebruikt de resolutie-volgorde uit dit document om de starttijd van de rusttimer te bepalen. |

---

## Thema 2 — Per-oefening standaardrust

**Doel:** De reeds bestaande, maar impliciete, per-oefening rustwaarde krijgt een expliciete invoer op het oefening-formulier.

| ID | Status | Requirement |
|----|--------|-------------|
| RST-09 | — | Het oefening-formulier (E1) krijgt een veld "Standaard rust" met +/‑ stepper (stappen van 15s, min 15s, max 600s), dat `Exercise.restTimerSeconds` zet. |
| RST-10 | — | Een leeg/ongezet veld betekent dat de lateraliteit-default en anders de globale instelling gelden (zie resolutie-volgorde). Het veld toont deze geërfde waarde als placeholder. |
| RST-11 | — | Een reset-actie zet `restTimerSeconds` terug naar undefined. |

---

## Thema 3 — Lateraliteit per oefening

**Doel:** De app weet of een oefening bilateraal (beide ledematen tegelijk belast) of unilateraal (één ledemaat per keer) is, en leidt daaruit een slimmere standaard-rusttijd af — zware bilaterale oefeningen krijgen standaard meer rust.

| ID | Status | Requirement |
|----|--------|-------------|
| LAT-01 | — | `Exercise` krijgt een optioneel veld `laterality: 'bilateral' \| 'unilateral'`. Undefined betekent onbekend. |
| LAT-02 | — | Het oefening-formulier (E1) krijgt een keuze bilateraal / unilateraal / onbekend, die `laterality` zet. Dit geldt zowel bij het aanmaken van een nieuwe (custom) oefening als bij het bewerken van een bestaande. |
| LAT-03 | — | De 25 default-oefeningen (seed) krijgen een correcte lateraliteit-waarde (zie mapping-tabel hieronder). |
| LAT-04 | — | Bij een `bilateral` oefening zonder expliciete rustwaarden is de afgeleide standaardrust = globale instelling + `AppSettings.bilateralRestExtraSeconds`, gecapt op 600s. Bij `unilateral` of onbekend geldt de globale instelling. |
| LAT-05 | — | `AppSettings` krijgt `bilateralRestExtraSeconds` (standaard 60), instelbaar in het instellingenscherm (E8) in stappen van 15s, minimaal 0 en maximaal 600s, zodat de gebruiker de offset kan tunen. |

---

## Datamodel-wijzigingen

| Entiteit | Wijziging |
|----------|-----------|
| `SchemaExercise` | Nieuw optioneel veld `restSeconds?: number` (seconden). |
| `Exercise` | Nieuw optioneel veld `laterality?: 'bilateral' \| 'unilateral'`. (`restTimerSeconds` bestaat al.) |
| `AppSettings` | Nieuw veld `bilateralRestExtraSeconds: number` (standaard 60). |

| ID | Status | Requirement |
|----|--------|-------------|
| MIG-01 | — | Dexie-migratie (version 8) voegt `bilateralRestExtraSeconds: 60` toe aan de bestaande settings-rij. Nieuwe optionele velden (`restSeconds`, `laterality`) blijven undefined en vallen terug via de resolutie-volgorde; bestaande schema's en oefeningen blijven werken. |
| MIG-02 | — | Dezelfde migratie backfilled de lateraliteit van de reeds aanwezige default-oefeningen (`isDefault: true`) op basis van de seed-mapping (match op naam), zodat bestaande installaties de lateraliteit-defaults meteen benutten. Custom oefeningen blijven undefined tot de gebruiker ze zelf instelt. |

---

## Seed-mapping lateraliteit

Vrijwel alle default-oefeningen zijn barbell-, kabel- of machinebewegingen die beide zijden tegelijk belasten (bilateraal). Alleen de Bulgarian Split Squat traint één been per keer (unilateraal).

| Oefening | Lateraliteit |
|----------|--------------|
| Barbell Back Squat | bilateral |
| Barbell Bench Press | bilateral |
| Conventional Deadlift | bilateral |
| Overhead Press | bilateral |
| Barbell Row | bilateral |
| Incline Dumbbell Press | bilateral |
| Cable Fly | bilateral |
| Dips | bilateral |
| Pull-up | bilateral |
| Lat Pulldown | bilateral |
| Seated Cable Row | bilateral |
| Face Pull | bilateral |
| Lateral Raise | bilateral |
| Barbell Curl | bilateral |
| Hammer Curl | bilateral |
| Tricep Pushdown | bilateral |
| Skull Crusher | bilateral |
| Romanian Deadlift | bilateral |
| Leg Press | bilateral |
| Leg Curl | bilateral |
| Leg Extension | bilateral |
| Bulgarian Split Squat | **unilateral** |
| Hip Thrust | bilateral |
| Standing Calf Raise | bilateral |
| Hanging Leg Raise | bilateral |

---

## Open punten / vervolg

- **Lateraliteit als proxy voor "zwaar":** de offset geldt voor álle bilaterale oefeningen, ook lichte isolatie (bijv. Barbell Curl). Als dit te grof blijkt, kan later een apart intensiteits-/type-veld (compound vs. isolatie) worden overwogen.
- **Dumbbell-bewegingen:** dumbbell-persen en -curls zijn hier als bilateraal geclassificeerd (beide armen tegelijk). Wie ze afwisselend (één arm per keer) uitvoert kan ze handmatig op unilateraal zetten.
