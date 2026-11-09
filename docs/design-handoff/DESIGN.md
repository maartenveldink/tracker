# Tracker: ontwerpspecificatie voor de makeover

Dit document is de bron van waarheid voor het nieuwe uiterlijk en de nieuwe training- en inzichtenervaring van Tracker (https://tracker.app.maartenveldink.nl/). Lees het helemaal voordat je code schrijft.

## 0. Wat dit is en wat niet

- Het is een **ontwerp**, geen implementatie. De schermbestanden in `screens/` zijn mockups met voorbeelddata.
- Het ontwerp is gemaakt zonder toegang tot de broncode. De live app was leeg (geen trainingen, geen habits), dus het trainingsscherm tijdens een sessie en de progressiegrafieken zijn voorstellen, geen kopie van wat er nu is.
- **Alles in dit document dat een aanname over de bestaande code is, staat onder "Controleer in de repo" (§12).** Wijkt de repo af, dan wint de repo voor gedrag en data, en dit document voor uiterlijk.
- Verander geen backend, API-contracten of datamodel, tenzij een nieuwe afgeleide waarde (§9) het echt vereist. Bespreek dat eerst.

### Hoe lees je de bestanden in `screens/`

Elk `.dc.html`-bestand is één scherm van 390 × 844 px. Ze draaien in een eigen runtime (`support.js`) die niet is meegeleverd, dus je kunt ze **niet** los in een browser openen. Behandel ze als leesbare specificatie:

- de inline `style="…"`-waarden zijn de exacte maten, kleuren en afrondingen;
- `renderVals()` onderaan bevat de voorbeelddata en, bij `Training.dc.html`, `Habits.dc.html` en `Moment.dc.html`, de werkende logica;
- `{{naam}}` is een variabele uit `renderVals()` (de kleuren zijn de tokens uit §3);
- `canvas.json` toont hoe de schermen op het canvas liggen en welke bij elkaar horen.

Een privé weergave met alle schermen naast elkaar staat in claude.ai (artifact "Tracker redesign"). De eigenaar moet die delen voordat iemand anders hem kan openen.

## 1. Principes

1. **Trainen eerst.** Tijdens een training telt snelheid en rust. Eén duidelijke hoofdactie per scherm, bereikbaar met de duim (onderste helft).
2. **Weinig denken tijdens de set.** Waarden zijn vooraf ingevuld met de vorige keer. Een set loggen is één tik op "Set klaar" als niets verandert.
3. **Inzichten die iets zeggen.** Geen cijfers ter decoratie. Elk getal moet een beslissing ondersteunen (wat trein ik nu, wat moet zwaarder, wat blijft achter).
4. **Eén visuele taal.** Donker, rustig vlak, één fel accent dat betekent: "dit is de actie" of "dit is beter". Nooit decoratief.
5. **Geen emoji, geen gradiënten, geen schaduwen.** Diepte komt van een 1 px rand en een iets lichtere vlakkleur.
6. **Tikdoelen minimaal 44 × 44 px.** Primaire knoppen 56 px, "Set klaar" 64 px.

## 2. Schermen en bestanden

Bekende routes komen uit de live app. De rest moet je in de repo opzoeken.

| Scherm | Bestand | Route |
|---|---|---|
| Home (met data) | `Main.dc.html` | `/` |
| Home (leeg) | `HomeLeeg.dc.html` | `/` |
| Start training | `Train.dc.html` | `/start` |
| Training (tijdens sessie) | `Training.dc.html` | controleer |
| Oefening klaar (viering) | `Moment.dc.html` (lus), en in `Training.dc.html` (live) | onderdeel van training |
| Habits | `Habits.dc.html` | `/habits` |
| Progressie, tab Oefeningen | `Progressie.dc.html` | `/progress` |
| Progressie, tab Overzicht | `ProgOverzicht.dc.html` | `/progress` |
| Progressie, tab Gewicht | `ProgGewicht.dc.html` | `/progress` |
| Meer (sheet) | `Meer.dc.html` | overlay |
| Oefeningen | `Oefeningen.dc.html` | controleer |
| Schema's | `Schemas.dc.html` | controleer |
| Schema bewerken | `SchemaEdit.dc.html` | controleer |
| Instellingen | `Instellingen.dc.html` | controleer |
| Kleurvarianten Home | `HomeB.dc.html`, `HomeC.dc.html` | alleen ter vergelijking, niet bouwen |

Navigatie: vijf tabs onderaan: Home, Train, Habits, Progressie, Meer. "Meer" opent een sheet met Oefeningen, Schema's en Instellingen.

**Niet ontworpen** (bouw ze volgens de patronen in §4): formulier "Nieuwe habit", formulier "Nieuwe oefening", oefening-detail, bevestigingsdialogen, laad- en foutstaten, licht thema.

## 3. Tokens

Bestanden: `tokens/tokens.css` (CSS-variabelen) en `tokens/tokens.json`. **Gebruik de variabelen, nooit losse hex-waarden.**

### Kleur (richting A)

| Token | Waarde | Gebruik |
|---|---|---|
| `--color-bg` | `#0A0E1A` | paginaachtergrond, achtergrond van invoervelden en stappers |
| `--color-surface` | `#131A2B` | kaarten, navigatiebalk, sheets |
| `--color-line` | `#26324F` | decoratieve randen en scheidingslijnen, vlak van inactieve knoppen |
| `--color-line-strong` | `#5B6C99` | rand van invoervelden en van uitgevinkte cirkels, uit-stand van de switch |
| `--color-text` | `#F1F4FB` | primaire tekst |
| `--color-muted` | `#9AA6C2` | secundaire tekst, inactieve iconen |
| `--color-accent` | `#C8F135` | primaire actie, voortgang, positief verschil, PR, actieve tab |
| `--color-on-accent` | `#0A0E1A` | tekst op accent |
| `--color-accent-2` | `#7C9CFF` | data, rusttimer, delta-tekst "↑ x% t.o.v. vorige week" |

Contrast (gemeten): tekst op achtergrond 17,5:1, muted op kaart 7,1:1, accent op achtergrond 14,8:1, tekst op accent 14,8:1.

**Bekende afwijking in de mockups:** daar zijn randen van invoervelden en uitgevinkte cirkels getekend met `--color-line` (1,4:1). Dat is te zwak voor een UI-grens (WCAG 1.4.11 vraagt 3:1). Gebruik in de implementatie `--color-line-strong` voor: invoervelden, de uitgevinkte habit-cirkel, de uit-stand van de switch, "stippel"-rijen en de rand van niet-actieve chips. `--color-line` blijft voor decoratieve scheidingslijnen en kaartranden.

De huidige app heeft `theme-color` `#1e293b`. Zet die op `#0A0E1A`.

### Alternatieven

B (Inkt & koraal) en C (Violet & amber) staan in `tokens/tokens.json` met dezelfde rollen. Wisselen betekent alleen de waarden van §3 vervangen. Bouw eerst A. Een themakeuze in de app is niet gevraagd.

### Typografie

Webfonts via Google Fonts: **Inter** (400, 500, 600) voor tekst, **Space Grotesk** (500, 700) voor titels en cijfers. Zet `font-display: swap` en laad alleen deze gewichten.

| Rol | Font | Maat | Gewicht | Opmerking |
|---|---|---|---|---|
| Schermtitel (h1) | Space Grotesk | 28 | 700 | letter-spacing −0,02em |
| Hero / oefeningnaam | Space Grotesk | 32 | 700 | −0,02em |
| Grote waarde (1RM, gewicht) | Space Grotesk | 34 | 700 | eenheid ernaast 16/500 in muted |
| Kaart- en sheettitel, timer | Space Grotesk | 22 | 700 | |
| Waarde in stat-tile | Space Grotesk | 24 | 700 | |
| Waarde in stappers | Space Grotesk | 28 | 700 | |
| Lijstregel groot (set, oefening) | Inter | 17 | 500–600 | |
| Lijstregel | Inter | 15 | 400–600 | |
| Secundair | Inter | 13–14 | 400–500 | kleur muted |
| Caption | Inter | 12 | 400–600 | kleur muted |
| Sectielabel | Inter | 12 | 600 | HOOFDLETTERS, +0,08em, kleur accent of muted |
| Navigatielabel | Inter | 11 | 400, actief 600 | |

Getalweergave: Nederlands. Decimale komma (`82,4`), duizendtallen als `12,4k` in tiles, `kg` met spatie (`140 kg × 8`). Tijd `1:12` voor rust, `42:18` voor trainingsduur.

### Vorm en ruimte

| Wat | Waarde |
|---|---|
| Schermmarge links/rechts | 20 px |
| Bovenmarge | 22–24 px |
| Tussen kaarten | 12 px (6 px tussen rijen in een lijst) |
| Binnenmarge kaart | 16 px; hero-kaart 18–20 px |
| Afronding kaart / tile / rij / knop | 20 / 18 / 14 / 16 px |
| Afronding pill (44 px hoog, rond) | 22 px |
| Afronding sheet (alleen boven) | 28 px |
| Rand | 1 px `--color-line`, op de actieve/voorgestelde kaart 2 px `--color-accent` |
| Schaduw | geen |

### Beweging

Zie §8 voor de viering. Verder: geen schermtransities nodig. Respecteer `prefers-reduced-motion: reduce` overal: dan geen animatie, wel de eindtoestand.

### Tailwind (als je Tailwind gebruikt)

```css
/* Tailwind v4, in je globale css */
@import "./tokens/tokens.css";
@theme {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-line: var(--color-line);
  --color-line-strong: var(--color-line-strong);
  --color-text: var(--color-text);
  --color-muted: var(--color-muted);
  --color-accent: var(--color-accent);
  --color-accent-2: var(--color-accent-2);
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

Tailwind v3: zet dezelfde kleuren in `theme.extend.colors` als `var(--color-…)`. Gebruik je Angular Material of een component library, dan overschrijf je de thematokens met deze variabelen in plaats van de componenten opnieuw te stylen.

## 4. Componenten

Maten in px. Staten: standaard, actief/geselecteerd, uitgeschakeld (muted tekst, geen rand-wijziging), focus (`:focus-visible` 2 px accent, offset 2).

- **Navigatiebalk.** 76 hoog, `surface`, 1 px bovenrand `line`. Vijf gelijke kolommen. Icoon 24 (lijn 1,75, afgeronde uiteinden) + label 11. Actief: accentkleur en label 600. Niet actief: muted. Elke tab is een `<button>` of link van minstens 44 hoog. Verberg de balk tijdens een training (zie §6).
- **Kaart.** `surface`, 1 px `line`, radius 20, padding 16. Hero-kaart: padding 18–20.
- **Stat-tile.** Radius 18, padding 14. Waarde 24/700, label 12 muted, optioneel delta in `accent-2`. Drie naast elkaar in een raster.
- **Primaire knop.** Hoogte 56 (64 voor "Set klaar" en "Volgende oefening"), radius 16 (18 bij 64), achtergrond accent, tekst `on-accent`, 17/600 (19/700 bij 64). Maximaal één per scherm.
- **Secundaire knop.** Hoogte 44–48, radius 14 of pill, transparant, 1 px `line-strong`, tekst `text`, 14/600.
- **Tekstknop.** Hoogte 44, geen rand, accent of muted tekst, 14/600.
- **Chip / segment.** 44 hoog (hit area), pill. Geselecteerd: accent vlak met `on-accent` tekst, 600. Niet geselecteerd: transparant, muted tekst. Segmented control: container `surface`, radius 16, padding 4, drie gelijke knoppen van 40 hoog, radius 12.
- **Lijstrij.** Minimaal 56–64 hoog, `surface`, 1 px `line`, radius 14–16, padding 0 14–16. Titel 15–16/600, subregel 12 muted. Rechts: waarde, chevron (muted) of actie.
- **Set-rij** (training). Raster `28px | 1fr | auto`, minimaal 48 hoog, radius 14. Drie toestanden:
  - *klaar:* `surface`, ronde badge 28 gevuld accent met setnummer in `on-accent`, tekst `140 kg × 8`, rechts "Klaar" muted.
  - *nu:* achtergrond `bg`, 2 px accentrand, badge 28 met 2 px accentrand en accent tekst, rechts "Nu" accent 700.
  - *komt nog:* transparant, 1 px stippelrand `line-strong`, muted tekst, badge op `line`.
- **Stapper** (gewicht, herhalingen). Container `bg`, radius 16, padding 4. Raster `44px | 1fr | 44px`: min-knop, waarde (28/700, gecentreerd), plus-knop. Knoppen 44 × 52, radius 12, vlak `line`, symbool 24. Label erboven 12 muted, gecentreerd. Gewichtsstap 2,5 kg (instelbaar), herhalingen 1.
- **Rusttimer-strook.** Kaart radius 14, padding 10 14. Links "Rust" muted, midden tijd `Space Grotesk` 20/700 in `accent-2`, rechts tekstknop "+30 sec". Eronder voortgangsbalk 4 hoog (`line`, vulling `accent-2`).
- **Voortgangsbalk.** 8 hoog, radius 4, spoor `line`. Vulling accent of `accent-2`.
- **Invoerveld.** 48 hoog (52 bij de belangrijkste), radius 14, rand `line-strong`, vlak `bg` (of `surface` op `bg`), tekst 16 (voorkomt zoom op iOS). Altijd een zichtbaar of toegankelijk label.
- **Switch.** Knop met `role="switch"` en `aria-checked`. Spoor 52 × 32, radius 16, knop 26. Aan: spoor accent, knop `on-accent`. Uit: spoor `line-strong`, knop muted. De rij is minimaal 60 hoog.
- **Bottom sheet.** `surface`, 1 px bovenrand, radius 28 boven, padding 18 20 20, achterliggend scherm met `--color-overlay`. Titel links (22/700), sluitknop rechts (44 × 44, rond).
- **Banner (verbetering).** Radius 18, achtergrond accent, tekst `on-accent`. Raster `40px | 1fr`: ronde icoonbadge 40 (`bg` met accent icoon), titel 18/700, subregel 14/500.
- **Vergelijkingstabel.** Kaart met kolommen `44px | 1fr | 72px | 72px` (Set, Vandaag, Vorige keer, Verschil). Rijen 44–48 hoog, scheidingslijn `line`. Verschil: verbetering `↑ +n` in accent 700, gelijk "gelijk" in muted, achteruit `↓ n` in muted.
- **Grafieken.** Eigen SVG of een lichte bibliotheek, geen zware. Specificaties in §7. Elke grafiek heeft `role="img"` en een `aria-label` met de conclusie in woorden.

## 5. Schermspecificaties

Volgorde is van boven naar beneden. Exacte maten: zie het bestand.

### Home (`Main.dc.html`, leeg: `HomeLeeg.dc.html`)
1. Datumregel (13 muted, bijvoorbeeld "Zondag 8 november") en titel "Vandaag".
2. **Hero-kaart "Aan de beurt"**: sectielabel, titel (de voorgestelde training, bijvoorbeeld "Benen"), spiergroepen, metaregel (aantal oefeningen, geschatte duur, "Laatst x dagen geleden"), primaire knop "Start training", tekstknop "Vrije training starten".
3. **Weekkaart "Deze week"** met "x van y sessies" en zeven dagbolletjes (M D W D V Z Z). Gedaan: accent gevuld met vinkje. Vandaag: 2 px accentrand. Overig: `line` vlak.
4. **Drie stat-tiles**: weken streak (vlamicoon accent), volume met delta, gewicht met knop "+ Log".
5. **Kaart "Laatst getraind"**: per spiergroep een rij (naam, balk, "x dagen"). Toon de drie spiergroepen die het langst geleden zijn. De bovenste (aan de beurt) krijgt accent, de rest `accent-2`.
6. Navigatiebalk.

Leeg: hero wordt "Begin je eerste training" met knoppen "Start vrije training" en "Schema maken", tiles tonen "–", kaart "Snel wegen" met invoerveld.

### Start training (`Train.dc.html`)
Voorgestelde training (kaart met 2 px accentrand en primaire knop "Start Benen"), sectie "Uit je schema" met een rij per trainingsdag (A/B/C), en een stippelrij "Vrije training".

### Training (`Training.dc.html`), het belangrijkste scherm
Geen navigatiebalk. Boven: label "Benen · oefening 3 van 6", timer, een lijst-knop (opent het oefeningenoverzicht) en "Afronden". Daaronder oefeningnaam (32/700), "Vorige keer: 140 × 8 · 8 · 7" en een chip "Doel: 140 kg × 9" in accent. Dan de setlijst, de tekstknoppen "+ Set toevoegen" en "Laatste set weghalen", en de rusttimer-strook zodra er een set klaar is. **Onderin, vast, in duimbereik:** de twee stappers, de grote knop "Set klaar", en een regel "Straks: Beenstrekken · 3 × 12" met "Oefening overslaan".

Gedrag in §6.

### Oefeningenoverzicht (sheet in Training)
Titel "Oefeningen" met knop "Klaar". Per oefening een rij: badge (nummer, of ✓ bij klaar), naam, subregel "3 sets · vorige 140 × 8". Acties per rij: "Overslaan" (komt nog), "Terugzetten" (overgeslagen) of de tag "Klaar". Tik op de rij zelf = nu deze oefening doen. Onderaan "+ Oefening toevoegen" (stippelrand accent) dat een zoekveld en suggesties opent.

### Oefening klaar (`Moment.dc.html`, en live in `Training.dc.html`)
Zie §8.

### Progressie
Segmented control: Oefeningen | Overzicht | Gewicht.
- **Oefeningen** (`Progressie.dc.html`): oefeningkiezer (pill), periodechips (4 wkn / 3 mnd / Alles), kaart met geschat 1RM (grote waarde, label "Nieuw PR" in accent, delta), lijngrafiek, **plateau-signaal**, kaart "Sets per spiergroep".
- **Overzicht** (`ProgOverzicht.dc.html`): volume per week (8 staven), twee tiles (sessies per week, duur per training), "Recente PR's".
- **Gewicht** (`ProgGewicht.dc.html`): 7-daags gemiddelde als grote waarde, grafiek met losse metingen en gemiddelde, periodechips, "Nieuwe meting", laatste drie metingen met verschil.

### Habits (`Habits.dc.html`)
Titel + "+ Nieuw". Dagkiezer (‹ Vandaag ›). Voortgangskaart "x van y gedaan" met balk. Per habit een rij met een ronde knop van 44 (uit: rand `line-strong`, aan: accent met vinkje, `aria-pressed`), naam, frequentie en streak. Tik op de cirkel schakelt om.

### Meer (`Meer.dc.html`)
Sheet over het huidige scherm met drie rijen: Oefeningen, Schema's, Instellingen (accenticoon, titel, subregel, chevron) en een sluitknop.

### Oefeningen, Schema's, Schema bewerken, Instellingen
Zie de bestanden. Patronen: titel + "+ Nieuw", zoekveld en filterchips (alleen Oefeningen), actief schema met 2 px accentrand en label "Actief", bewerkscherm met naamveld, tabs per trainingsdag (A, B, C, +), sleepbare rijen en onderaan een vaste "Opslaan"-knop. Instellingen groepeert in "Training" en "Gegevens".

### Breedte
De ontwerpen zijn voor 390 px. De live app wordt ook op ~800 px getoond. Beperk de inhoud op breder dan 600 px tot een gecentreerde kolom van maximaal 560 px, met de navigatiebalk over de volle breedte. Er is geen apart tablet- of desktopontwerp.

## 6. Training: toestanden en regels

Dit is wat `Training.dc.html` doet. Neem de logica over, maar koppel hem aan de bestaande trainingsdata en API.

**Toestand per oefening:** `todo`, `done`, `skipped`. Er is altijd één huidige oefening (`cur`) zolang er nog een `todo` is.

**Sets van de huidige oefening:** `total` (aantal geplande sets, uit het schema of 3 bij een nieuwe oefening) en `done` (gelogde sets met gewicht en herhalingen). De rij op positie `done.length` is "nu". Gewicht en herhalingen in de stappers zijn voorgevuld met de **bovenste set van de vorige sessie** van die oefening en blijven staan na "Set klaar".

| Actie | Gevolg |
|---|---|
| Tik "Set klaar" | Voeg `{gewicht, herhalingen}` toe aan `done`. Rusttimer start (als aan in instellingen). |
| `done.length == total` | Knop wordt "Volgende oefening" ("Laatste oefening afronden" als er geen volgende is). Rusttimer-strook verdwijnt. |
| "Volgende oefening" | Huidige → `done`. Huidige oefening = eerstvolgende `todo` na de huidige; anders de eerste `todo` ervoor; anders **klaar-toestand**. |
| "+ Set toevoegen" | `total + 1`, maximaal 8. |
| "Laatste set weghalen" | `total = max(1, done.length, total − 1)`. Een gelogde set verdwijnt niet. |
| "Oefening overslaan" | Huidige → `skipped`, daarna dezelfde zoekregel als hierboven. |
| Lijst-knop | Opent het oefeningenoverzicht (sheet). |
| Rij aantikken in overzicht | Die oefening wordt huidig (status `todo`), sets worden gereset, sheet sluit. |
| "Overslaan" in overzicht | Zet een `todo` op `skipped`. Is het de huidige, dan geldt de zoekregel. |
| "Terugzetten" | `skipped` → `todo`. In de klaar-toestand wordt die oefening direct huidig. |
| "+ Oefening toevoegen" | Voegt achteraan een `todo` toe (suggestie of eigen naam). Staat de training in klaar-toestand, dan wordt de nieuwe oefening huidig. Standaard 3 sets; gewicht en herhalingen komen uit de vorige sessie van die oefening, anders leeg laten (het prototype gebruikt 20 kg × 10 als placeholder). |

**Klaar-toestand** (alle oefeningen `done` of `skipped`): titel "Training klaar", subregel "Rond af, of voeg nog een oefening toe.", geen setlijst en geen stappers, primaire knop "Training afronden", secundaire knop "+ Oefening toevoegen".

Overige regels:
- Tijdens de training: scherm aan houden (Screen Wake Lock API, instelbaar), navigatiebalk verbergen.
- "Afronden" (rechtsboven) vraagt bij openstaande oefeningen om bevestiging. Dat dialoogje is niet ontworpen: gebruik het sheet-patroon.
- Rustduur komt uit het schema, anders uit de instelling (standaard 1:30). "+30 sec" verlengt. Einde rust: trillen als ondersteund en aan.
- Bewaar elke afgeronde set direct (niet pas bij afronden), zodat een herlaad of crash niets kwijtraakt.

## 7. Inzichten: berekeningen

Alle waarden zijn afgeleid van gelogde sets. Controleer de bestaande logica eerst (§12) en vervang die alleen als hij afwijkt.

- **Volume** = Σ (gewicht × herhalingen). Week = maandag t/m zondag.
- **Geschat 1RM (Epley)** = `gewicht × (1 + herhalingen / 30)`; bij 1 herhaling is het het gewicht zelf. Per sessie telt de **beste set**. Sets met meer dan 12 herhalingen tellen niet mee.
- **PR** = hoogste geschat 1RM ooit voor die oefening. Toon "Nieuw PR" als de laatste sessie dat record verbreekt.
- **Plateau-signaal** (alleen op de oefening-detail): de laatste **3 sessies** hadden dezelfde bovenste set (zelfde gewicht en herhalingen). Tekst: "Je laatste 3 sessies bleven op {gewicht} × {herhalingen}. Probeer {gewicht + stap}, of ga naar {herhalingen + 1} herhalingen." Stap = instelling gewichtsstap.
- **Sets per spiergroep per week**: aantal afgeronde sets per primaire spiergroep in de lopende week. Balk loopt van 0 tot 20, markering bij 10. Onder 10 telt als "laag": tekst `"{n} sets · laag"` in accent. Kleur is niet het enige signaal, de tekst staat er ook bij.
- **Laatst getraind**: dagen sinds de laatste sessie met minstens één set voor die spiergroep. Balkbreedte = dagen / 7, maximaal 100 %.
- **7-daags gemiddelde (gewicht)**: voor elke meting het gemiddelde van de metingen in de 7 dagen tot en met die dag. Dagen zonder meting tellen niet mee. Delta "in 4 weken" = huidig gemiddelde min het gemiddelde van 28 dagen eerder.
- **Volume-delta in tile**: deze week tot nu toe versus de volledige vorige week. (Open vraag: eerlijker is "tot dezelfde weekdag", zie §12.)
- **Weekstrip en "x van y sessies"**: y is het aantal trainingsdagen in het actieve schema.

## 8. Viering "Oefening klaar"

**Trigger:** niet per set, maar na de **laatste set van een oefening**, en alleen als de oefening als geheel beter was dan de vorige sessie van dezelfde oefening. In het prototype is "beter": totaal volume van vandaag > totaal volume vorige keer. Is er geen vorige sessie (nieuwe oefening), dan geen viering.

**Opbouw van het scherm** (bovenin naar onder): sectielabel "Oefening klaar", oefeningnaam, banner "Beter dan vorige week" met subregel (`+n herhalingen · +n kg volume`; het herhalingendeel alleen bij een toename), vergelijkingstabel (per set: vandaag, vorige keer, verschil), kaart "Straks: …", en onderin: primaire knop "Volgende oefening", daaronder naast elkaar "+ Nog een set" en "{volgende oefening} overslaan".

**Animatie** (eenmalig bij tonen, ongeveer 4,5 s; in `Moment.dc.html` herhaalt hij als lus ter beoordeling):

| Onderdeel | Gedrag |
|---|---|
| Banner | schaal 0,6 → 1,08 → 1 in 0,9 s, opacity 0 → 1 |
| Tabel | fade en 8 px omhoog, start na 0,3 s, duur 0,6 s |
| Verschil per set | verschijnt rij voor rij: vertraging `0,5 s + index × 0,18 s`, duur 0,5 s |
| Confetti | 40 stukjes vanuit het midden van de banner. Vormen: rechthoek, cirkel, driehoek in drie gelijke delen. Grootte 6–10 px. Kleuren in vaste verdeling: accent, accent-2, text, `#FF7A59`, `#FFB84D`. Eerste fase (0–22 %): spuit uit onder een willekeurige hoek tussen −170° en −10° over 100–270 px, ease-out, draait mee. Tweede fase (22–76 %): valt tot 620 px onder de beginhoogte, ease-in, vervaagt vanaf 68 %. Willekeurige startvertraging 0–0,18 s. Gebruik een deterministische pseudo-random zodat het er elke keer hetzelfde uitziet |
| Vuurwerk | 3 uitbarstingen van 12 stralen (16 × 3 px, 30° uit elkaar), op (60,110), (332,150) en (200,56) vanaf de bovenkant van het scherm. Stralen wisselen tussen tekstkleur en accent (resp. accent-2, amber). Elk straal beweegt van 4 naar 60 px terwijl hij krimpt en vervaagt in 3,2 s. Start na 0,1 / 0,35 / 0,6 s |

Alles ligt als `pointer-events: none` overlay boven het scherm; de knoppen blijven bruikbaar.

**Toegankelijkheid en instellingen:**
- `prefers-reduced-motion: reduce` of instelling "Viering bij verbetering" uit: geen confetti, geen vuurwerk, geen pop. De banner, tabel en knoppen blijven wel staan.
- De confetti en het vuurwerk zijn `aria-hidden`. De banner zelf wordt voorgelezen ("Beter dan vorige week, plus 2 herhalingen").
- Optioneel trillen: `navigator.vibrate([20, 40, 20])` bij het tonen, alleen als de browser het ondersteunt en de instelling "Trillen" aan staat.
- Een **PR** (§7) mag later een extra moment krijgen (groter vuurwerk, label "Nieuw PR" in de banner). Dat is niet uitgewerkt: bouw eerst de gewone viering.

## 9. Gegevens die het ontwerp nodig heeft

Controleer wat de app al heeft (§12). Nieuwe afgeleide waarden, indien nog niet aanwezig:

1. Per oefening: **primaire spiergroep** (Benen, Rug, Borst, Schouders, Armen, Core) voor "Laatst getraind" en "Sets per spiergroep". Tijdens het ontwerpen bleek de app al "Voorgestelde training, gericht op spiergroepen die je lang niet trainde" te hebben, dus dit staat er waarschijnlijk al in.
2. **Vorige sessie per oefening** (alle sets met gewicht en herhalingen): voor voorinvulling, "Doel", viering en vergelijkingstabel.
3. **Geschat 1RM per sessie per oefening**: berekend bij het ophalen, niet opslaan.
4. **Doel-regel** ("Doel: 140 kg × 9"): in het prototype `vorige bovenste set + 1 herhaling`. Vervang door de bestaande logica als die er is.

## 10. Tekst

Kort, direct, informeel ("je"). Nederlands in de hele app. Teksten uit de huidige app die behouden blijven: "Start training", "Vrije training", "Voorgestelde training", "Snel wegen", "Opslaan", "Nog geen habits. Maak je eerste habit.", "Nog geen gelogde oefeningen in deze periode." Nieuwe teksten staan in de mockups. Een bruikbare lege staat vertelt wat er mist én wat je kunt doen.

## 11. Toegankelijkheid

- Echte `<button>`, `<a>`, `<input>` met `<label>`. Geen klikbare `div`s.
- Iconknoppen krijgen een `aria-label` (bijvoorbeeld "Gewicht 2,5 kg minder", "Oefeningen in deze training").
- Switch: `role="switch"` + `aria-checked`. Habit-cirkel: `aria-pressed`.
- Tekstcontrast ≥ 4,5:1 (gemeten, zie §3). UI-grenzen ≥ 3:1: gebruik `line-strong` (§3).
- Informatie nooit alleen met kleur: "laag", "gelijk" en "↑ +1" staan als tekst, niet alleen als kleur.
- Rusttimer: kondig het einde van de rust aan met `aria-live="polite"`, niet elke seconde.
- Grafieken: `role="img"` met een `aria-label` dat de conclusie noemt.

## 12. Controleer in de repo (aannames)

Dit zijn dingen die ik niet kon zien. Zoek ze op en pas het ontwerp aan waar nodig, of vraag het aan Maarten.

1. Techniek van de frontend (framework, stijlsysteem) en waar de routes staan. Bekend: `/`, `/start`, `/habits`, `/progress`.
2. Bestaat de "vorige keer"-data al, en hoe wordt "Voorgestelde training" bepaald? Behoud die logica.
3. Definitie van "weken streak" (aanname: opeenvolgende weken waarin het sessiedoel is gehaald).
4. Hoe worden lichaamsgewichtoefeningen opgeslagen (bijvoorbeeld "+10 kg × 6" bij optrekken)? Het geschatte 1RM is daar dubbelzinnig. Besluit eerst.
5. Hoe wordt een bestaande animatie bij verbetering nu getriggerd? De huidige app toont vuurwerk- en confetti-icoontjes; haal die logica weg of koppel hem aan de trigger uit §8.
6. Vergelijking met vorige sessie telt nu totaal volume. Een extra set verhoogt dat automatisch. Overweeg een eerlijkere vergelijking (zelfde aantal sets, of beste set) en leg de keuze vast.
7. Volume-delta in de tile: vorige week volledig of tot dezelfde weekdag?
8. Staat het Meer-menu, de Schema's- en Oefeningenlijst op dezelfde routes als in het ontwerp?

## 13. Bouwvolgorde

Werk in kleine, afzonderlijk te reviewen stappen. Houd de app na elke stap werkend.

1. **Inventaris.** Lees de repo, vul §12 in, noem de bestaande schermen, componenten en stijlen.
2. **Fundament.** Tokens (`tokens/tokens.css`), fonts, globale basisstijl, `theme-color`, navigatiebalk en kaart/knop/chip/rij-componenten volgens §4.
3. **Home** (met data en leeg).
4. **Training** inclusief setlijst, stappers, rusttimer, set toevoegen, oefening overslaan/toevoegen, overzicht-sheet en klaar-toestand. Dit levert de meeste waarde.
5. **Viering** (§8).
6. **Progressie** (drie tabs) met de berekeningen uit §7.
7. **Overige schermen:** Habits, Start training, Meer, Oefeningen, Schema's, Instellingen.
8. **Afwerking:** toegankelijkheid (§11), reduced motion, brede schermen, tests.

**Klaar als:**
- geen losse hex-waarden meer in de stijlen van de herontworpen schermen;
- alle tikdoelen ≥ 44 px, contrast gemeten;
- de training werkt met één hand: een set loggen is één tik als niets verandert;
- viering start alleen na een betere oefening en respecteert reduced motion;
- bestaande tests slagen, en nieuwe logica (§6, §7, §8-trigger) heeft eenheidstests.
