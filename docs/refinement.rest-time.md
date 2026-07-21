# Refinement — Rusttijd per set, lateraliteit & bewegingstype
*Versie 1.1 | Datum: 2026-07-21*

> Versie 1.1: de lateraliteit-offset (`bilateralRestExtraSeconds`) is vervangen door
> een instelbare 2×2-matrix van standaardrusttijden (lateraliteit × bewegingstype).
> Alle onderdelen zijn geïmplementeerd.

---

Dit document beschrijft het instelbaar maken van de rusttijd tussen sets op schema-niveau, een expliciete invoer voor de per-oefening standaardrust, en het vastleggen van lateraliteit (bilateraal/unilateraal) en bewegingstype (compound/isolatie) per oefening om slimmere standaard-rusttijden af te leiden.

Vertrekpunt is de bestaande rusttimer (thema RT in `refinement.md`, geïmplementeerd in `WorkoutPage.tsx`). Er bestaat een globale standaardrust (`AppSettings.restTimerSeconds`, 90s) en een per-oefening waarde (`Exercise.restTimerSeconds`). Deze refinement voegt een specifieker niveau toe (rust per oefening ín een schema), maakt de per-oefening default expliciet instelbaar, en leidt een slimme default af uit de combinatie van lateraliteit en bewegingstype.

---

## Resolutie-volgorde effectieve rusttijd

De timer bepaalt de rusttijd van specifiek naar algemeen. De eerste waarde die gezet is, wint:

1. `SchemaExercise.restSeconds` — expliciet ingesteld bij de oefening in dít schema.
2. `Exercise.restTimerSeconds` — expliciete per-oefening standaardrust.
3. **Type-default** — afgeleid uit `Exercise.laterality` × `Exercise.movementType` via de matrix (zie MOV-04). Geldt alleen wanneer beide bekend zijn.
4. `AppSettings.restTimerSeconds` — globale standaardrust (geldt wanneer lateraliteit of bewegingstype onbekend is).

In de invoer-UI wordt de geërfde waarde uit de eerstvolgende gezette laag als **placeholder** getoond, zodat de gebruiker ziet wat er geldt zonder iets in te vullen.

---

## Thema 1 — Rusttijd per set in het schema

**Doel:** De gebruiker kan per oefening in een schema de rusttijd tussen sets vastleggen, met dezelfde +/‑ invoer als de overige velden (sets, reps, startgewicht).

| ID | Status | Requirement |
|----|--------|-------------|
| RST-01 | ✓ | In het schema-formulier (E2) heeft elke oefening een rust-veld met een +/‑ stepper, naast de bestaande velden voor sets en reps. |
| RST-02 | ✓ | De +/‑ stepper wijzigt de rusttijd in stappen van 15 seconden. |
| RST-03 | ✓ | De rusttijd wordt weergegeven als `M:SS` (bijv. `1:00`, `1:30`, `0:45`). |
| RST-04 | ✓ | Er is geen harde standaardwaarde bij het toevoegen van een oefening: `restSeconds` blijft ongezet (undefined) en het veld toont de geërfde waarde (zie resolutie-volgorde) als placeholder. |
| RST-05 | ✓ | De rusttijd kent een minimum van 15 seconden en een maximum van 600 seconden (consistent met de globale instelling RT-05). |
| RST-06 | ✓ | De ingestelde waarde wordt opgeslagen als `SchemaExercise.restSeconds` en blijft behouden na opslaan en heropenen van het schema. |
| RST-07 | ✓ | Bij elke oefening met een gezette `restSeconds` is een reset-actie beschikbaar die de waarde terugzet naar undefined, analoog aan de reset van het startgewicht. |
| RST-08 | ✓ | De live workout gebruikt de resolutie-volgorde uit dit document om de starttijd van de rusttimer te bepalen. |

---

## Thema 2 — Per-oefening standaardrust

**Doel:** De per-oefening rustwaarde krijgt een expliciete invoer op het oefening-formulier.

| ID | Status | Requirement |
|----|--------|-------------|
| RST-09 | ✓ | Het oefening-formulier (E1) heeft een veld "Standaard rust" met +/‑ stepper (stappen van 15s, min 15s, max 600s), dat `Exercise.restTimerSeconds` zet. |
| RST-10 | ✓ | Een leeg/ongezet veld betekent dat de type-default en anders de globale instelling gelden (zie resolutie-volgorde). Het veld toont deze geërfde waarde als placeholder. |
| RST-11 | ✓ | Een reset-actie ("Reset") zet `restTimerSeconds` terug naar undefined. |

---

## Thema 3 — Lateraliteit & bewegingstype per oefening

**Doel:** De app weet of een oefening bilateraal (beide ledematen tegelijk) of unilateraal (één per keer) is, en of hij compound (meerdere gewrichten) of isolatie is. Uit die combinatie leidt hij een slimme standaard-rusttijd af.

| ID | Status | Requirement |
|----|--------|-------------|
| LAT-01 | ✓ | `Exercise` heeft een optioneel veld `laterality: 'bilateral' \| 'unilateral'`. Undefined = onbekend. |
| LAT-02 | ✓ | Het oefening-formulier (E1) heeft een tap-to-cycle toggle bilateraal / unilateraal / onbekend, zowel bij aanmaken als bewerken. |
| LAT-03 | ✓ | De 25 default-oefeningen (seed) krijgen een correcte lateraliteit (zie mapping-tabel). |
| MOV-01 | ✓ | `Exercise` heeft een optioneel veld `movementType: 'compound' \| 'isolation'`. Undefined = onbekend. |
| MOV-02 | ✓ | Het oefening-formulier (E1) heeft een tap-to-cycle toggle compound / isolatie / onbekend, naast de lateraliteit-toggle. |
| MOV-03 | ✓ | De 25 default-oefeningen (seed) krijgen een correct bewegingstype (zie mapping-tabel). |
| MOV-04 | ✓ | Bij een oefening met zowel lateraliteit als bewegingstype bekend en zonder expliciete rustwaarde is de afgeleide standaardrust de bijbehorende waarde uit de matrix (`AppSettings.restDefaults`). Bij onbekende lateraliteit of bewegingstype geldt de globale instelling. |
| MOV-05 | ✓ | `AppSettings` heeft `restDefaults` met vier instelbare waarden (matrix hieronder), instelbaar in het instellingenscherm (E8) in stappen van 15s, min 15s en max 600s. |

### Matrix standaardrust (`AppSettings.restDefaults`)

| | Compound | Isolatie |
|-----------------|----------|----------|
| **Bilateraal** | 3:00 (180s) | 1:00 (60s) |
| **Unilateraal** | 1:30 (90s) | 0:15 (15s) |

---

## Datamodel-wijzigingen

| Entiteit | Wijziging |
|----------|-----------|
| `SchemaExercise` | Optioneel veld `restSeconds?: number` (seconden). |
| `Exercise` | Optionele velden `laterality?: 'bilateral' \| 'unilateral'` en `movementType?: 'compound' \| 'isolation'`. (`restTimerSeconds` bestond al.) |
| `AppSettings` | `restDefaults: { bilateralCompound, unilateralCompound, bilateralIsolation, unilateralIsolation }` (vervangt het eerdere `bilateralRestExtraSeconds`). |

| ID | Status | Requirement |
|----|--------|-------------|
| MIG-01 | ✓ | Dexie v8: nieuwe optionele velden (`restSeconds`, `laterality`) blijven undefined en vallen terug via de resolutie-volgorde; bestaande data blijft werken. |
| MIG-02 | ✓ | Dexie v8 backfilled de lateraliteit van bestaande default-oefeningen (`isDefault: true`) op naam. Custom oefeningen blijven undefined. |
| MIG-03 | ✓ | Dexie v11 backfilled `movementType` van bestaande default-oefeningen op naam (compound-set, anders isolatie). |
| MIG-04 | ✓ | Dexie v12 zet `restDefaults` (matrixdefaults) op de bestaande settings-rij; `bilateralRestExtraSeconds` is niet langer in gebruik. |

---

## Seed-mapping lateraliteit & bewegingstype

Vrijwel alle default-oefeningen belasten beide zijden tegelijk (bilateraal); alleen de Bulgarian Split Squat is unilateraal. Compound = meerdere gewrichten (grote barbell-/lichaamsgewicht-bewegingen), isolatie = één gewricht.

| Oefening | Lateraliteit | Bewegingstype |
|----------|--------------|---------------|
| Barbell Back Squat | bilateral | compound |
| Barbell Bench Press | bilateral | compound |
| Conventional Deadlift | bilateral | compound |
| Overhead Press | bilateral | compound |
| Barbell Row | bilateral | compound |
| Incline Dumbbell Press | bilateral | compound |
| Cable Fly | bilateral | isolation |
| Dips | bilateral | compound |
| Pull-up | bilateral | compound |
| Lat Pulldown | bilateral | compound |
| Seated Cable Row | bilateral | compound |
| Face Pull | bilateral | isolation |
| Lateral Raise | bilateral | isolation |
| Barbell Curl | bilateral | isolation |
| Hammer Curl | bilateral | isolation |
| Tricep Pushdown | bilateral | isolation |
| Skull Crusher | bilateral | isolation |
| Romanian Deadlift | bilateral | compound |
| Leg Press | bilateral | compound |
| Leg Curl | bilateral | isolation |
| Leg Extension | bilateral | isolation |
| Bulgarian Split Squat | **unilateral** | compound |
| Hip Thrust | bilateral | compound |
| Standing Calf Raise | bilateral | isolation |
| Hanging Leg Raise | bilateral | isolation |

---

## Open punten / vervolg

- **Dumbbell-bewegingen:** dumbbell-persen en -curls zijn als bilateraal geclassificeerd (beide armen tegelijk). Wie ze afwisselend uitvoert kan ze handmatig op unilateraal zetten.
- **Grensgevallen bewegingstype:** o.a. Face Pull en Hip Thrust zijn discutabel; de seed kiest een standaard, per oefening handmatig aanpasbaar via de toggle.
