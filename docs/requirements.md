# Requirements Document — Tracker App
*Versie 1.2 | Datum: 2026-06-02*

---

## 1. Projectoverzicht

Tracker is een personal fitness-applicatie die één gebruiker ondersteunt bij het plannen en registreren van krachttrainingen en het bijhouden van macro-voedingsstoffen. De applicatie wordt gebouwd als Progressive Web App (PWA), primair gericht op mobiel gebruik met volledige ondersteuning op desktop/laptop. Data wordt lokaal opgeslagen (geen externe account of backend vereist).

---

## 2. Scopeafbakening

### In scope
- Krachttraining: samenstellen, registreren en terugkijken
- Voeding: voedingsmiddelen, recepten en macro-logging
- Spier- en oefendatabase met dekking-analyse
- Trainingshistorie per oefening, inclusief geschatte 1RM-grafiek
- Barcode-scanner voor voedingsmiddelen
- Optionele weergave van Fitbit/Google Health gegevens (slaap)

### Buiten scope (v1)
- Multi-user of accountbeheer
- Cloud-synchronisatie
- Cardio-tracking
- Maaltijdplanning of dieetschema's
- Sociale features (delen, vergelijken)

---

## 3. Epics en functionele requirements

**Legenda status:** `✓` Geïmplementeerd &nbsp;·&nbsp; `~` Gedeeltelijk &nbsp;·&nbsp; `—` Niet geïmplementeerd

---

### Epic 1 — Oefeningen- en spierdatabase

**Doel:** Een beheerbare database van oefeningen waaraan spiergroepen zijn gekoppeld, als fundament voor schema-analyse en suggesties.

| ID | Status | Requirement |
|----|--------|-------------|
| E1-01 | ✓ | De gebruiker kan oefeningen aanmaken met een naam, beschrijving en primaire/secundaire spiergroepen. |
| E1-02 | ✓ | Het systeem biedt een vooraf gevulde standaarddatabase met 25 veelgebruikte oefeningen (bv. squat, bench press, deadlift). |
| E1-03 | ✓ | Spiergroepen volgen een gestandaardiseerde indeling. Het detailniveau (globaal 8-10 groepen of gedetailleerd 20+ spieren) is instelbaar via het instellingenscherm (zie Epic 8); standaard globaal. |
| E1-04 | ✓ | De gebruiker kan bestaande oefeningen bewerken of verwijderen (met waarschuwing als de oefening in gebruik is). |
| E1-05 | ✓ | Oefeningen zijn doorzoekbaar op naam en filterbaar op spiergroep. |

---

### Epic 2 — Trainingsschema's samenstellen

**Doel:** De gebruiker kan vooraf trainingsschema's opbouwen die klaar staan om tijdens de training te gebruiken.

| ID | Status | Requirement |
|----|--------|-------------|
| E2-01 | ✓ | De gebruiker kan een trainingsschema aanmaken met een naam (bv. "Push A", "Full Body"). |
| E2-02 | ✓ | Aan een schema kunnen meerdere oefeningen worden toegevoegd, inclusief het gewenste aantal sets en reps per set. |
| E2-03 | ✓ | De volgorde van oefeningen binnen een schema is aanpasbaar. |
| E2-04 | ✓ | Het systeem toont per schema een spiergroepoverzicht: welke spiergroepen worden geraakt (primair en secundair), inclusief relatieve verdeling. |
| E2-05 | ✓ | Het systeem signaleert ontbrekende spiergroepen op basis van een instelbaar referentieframe (bv. "full body" of door de gebruiker gedefinieerde doelgroepen). |
| E2-06 | ✓ | Het systeem kan oefeningen suggereren die een ontbrekende of onderbelichte spiergroep aanvullen, op basis van de oefenendatabase. |
| E2-07 | ✓ | Schema's kunnen worden gekopieerd als basis voor een nieuw schema. |
| E2-08 | ✓ | Een schema kan worden onderverdeeld in meerdere benoemde dagen (bv. "Dag 1", "Push", "Pull", "Legs"). Elke dag bevat een eigen lijst van oefeningen met sets en reps. Een schema zonder dagindeling werkt als voorheen (één dag). |
| E2-09 | ✓ | Bij het aanmaken of bewerken van een schema kan de gebruiker dagen toevoegen, hernoemen, herordenen en verwijderen. Oefeningen worden aan een specifieke dag toegewezen. |
| E2-10 | ✓ | De spiergroepoverzicht (E2-04), ontbrekende spiergroepen (E2-05) en suggesties (E2-06) zijn beschikbaar per dag én voor het volledige schema als geheel. |
| E2-11 | ✓ | Bij het starten van een training vanuit een meerdaags schema kiest de gebruiker welke dag hij uitvoert. De default selectie werkt als volgt: (1) is er een actieve of gepauzeerde sessie voor dit schema, dan is de dag van die sessie de default; (2) is de laatste sessie afgerond, dan is de eerstvolgende dag in de reeks de default (na de laatste dag wordt dag 1 weer de default); (3) zonder eerdere sessies is dag 1 de default. |

---

### Epic 3 — Training registreren (live logging)

**Doel:** Tijdens het sporten kunnen sets snel en met minimale interactie worden geregistreerd.

| ID | Status | Requirement |
|----|--------|-------------|
| E3-01 | ✓ | De gebruiker start een training vanuit een bestaand schema of als losse/ad-hoc training. |
| E3-02 | ✓ | Per set wordt gewicht (kg) en aantal reps vastgelegd. |
| E3-03 | ✓ | De interface toont de geplande sets en markeert voltooide sets visueel. |
| E3-04 | ✓ | De gebruiker kan per set afwijken van het geplande gewicht of reps (zonder het schema te wijzigen). |
| E3-05 | ✓ | Sets kunnen worden overgeslagen of achteraf toegevoegd. |
| E3-06 | ✓ | De training registreert automatisch de datum en begintijd en houdt de totale duur bij inclusief pauzetijd. |
| E3-07 | ✓ | De gebruiker kan een training tussentijds pauzeren en later hervatten (data blijft bewaard). |
| E3-08 | ✓ | Na afronding toont het systeem een samenvattingsscherm (oefeningen, sets, totaal volume per spiergroep). |
| E3-09 | ✓ | Notities kunnen per oefening of per training worden toegevoegd. |
| E3-10 | — | Zodra de gebruiker een set als voltooid markeert, start het systeem automatisch een afteltimer met een instelbare standaardduur (zie E3-14). De timer is per actieve set zichtbaar direct onder of in de setrij. |
| E3-11 | — | De resterende rusttijd wordt weergegeven als aftellende klok (MM:SS) met een visuele voortgangsindicator (balk of cirkel) die krimpt naarmate de rusttijd verstrijkt. |
| E3-12 | — | Wanneer de rusttimer afloopt geeft de app een signaal: trillen (via Vibration API) op mobiel, aangevuld met een kort hoorbaar geluid. Beide signalen zijn afzonderlijk in- en uitschakelbaar via de instellingen. |
| E3-13 | — | De gebruiker kan de lopende rusttimer handmatig vroeg stoppen ("Sla over") of opnieuw starten ("Reset"). Beide acties zijn bereikbaar met één tik vanuit het loggingscherm. |
| E3-14 | — | De standaard rusttijdsduur is instelbaar via het instellingenscherm (E8) in stappen van 15 seconden, met een minimum van 15 seconden en een maximum van 10 minuten. Standaardwaarde: 90 seconden. |
| E3-15 | — | De rusttijdsduur is per oefening overschrijfbaar: in het schema-formulier (E2) en vanuit het live loggingscherm via een contextmenu per oefening. De oefening-specifieke waarde heeft voorrang boven de globale instelling. |
| E3-16 | — | Wanneer er een actieve rusttimer loopt en de gebruiker navigeert weg van de WorkoutPage, blijft de timer doorlopen en geeft het signaal af zodra hij afloopt, ook als de app op de achtergrond staat (via Web Notification of Vibration API). |
| E3-17 | — | Er is maximaal één actieve rusttimer tegelijkertijd. Als de gebruiker een nieuwe set voltooit terwijl er al een timer loopt, herstart de timer op de ingestelde duur. |
| E3-18 | — | Bij het openen van een set toont het systeem het gewicht en het aantal reps van dezelfde set uit de meest recente voltooide sessie met dit schema als prefill. Als er geen vorige sessie is, blijven de velden leeg. |
| E3-19 | — | Naast de kg- en reps-invoer verschijnt een "Zelfde als vorige" knop die met één tik het gewicht en reps van de corresponderende set uit de vorige sessie overneemt en de set direct als voltooid markeert. |
| E3-20 | — | Het gewicht-invoerveld biedt snelle aanpassingsknoppen (+/−) voor veelgebruikte stappen: +2,5 kg / −2,5 kg en +5 kg / −5 kg, bereikbaar zonder het toetsenbord te openen. |
| E3-21 | — | Het reps-invoerveld biedt +1 / −1 knoppen naast het veld, zodat kleine afwijkingen van de geplande reps met één tik aanpasbaar zijn. |
| E3-22 | — | Wanneer de gebruiker het kg-veld of reps-veld aanraakt, selecteert het systeem automatisch de volledige inhoud, zodat de gebruiker direct kan overtypen zonder eerst te wissen. |
| E3-23 | — | De eerstvolgende niet-voltooide set wordt visueel gemarkeerd als "actieve set" (bv. lichte accentkleur of pijl-indicator) zodat de gebruiker in één oogopslag ziet waar hij is. |
| E3-24 | — | Na het voltooien van de laatste set van een oefening scrollt de pagina automatisch naar de volgende oefening (soepele animatie), mits er geen actieve rusttimer loopt. Als er een rusttimer actief is, wacht het systeem met scrollen tot de timer is afgelopen of de gebruiker hem overslaat. |
| E3-25 | — | Het systeem biedt een "Herhaal vorige set" knop per oefening waarmee gewicht en reps van de vorige set (binnen dezelfde sessie) worden overgenomen naar de eerstvolgende open set, zonder de set meteen als voltooid te markeren. |
| E3-26 | — | Bovenaan het loggingscherm verschijnt een horizontaal scrollende oefeningen-navigatiebalk met de naam (verkort) van elke oefening in de training. De actieve oefening is gemarkeerd. Tikken op een naam scrollt direct naar die oefening. |
| E3-27 | — | De navigatiebalk (E3-26) toont per oefening een compacte voortgangsindicator: het aantal voltooide sets t.o.v. het totaal (bv. "3/4"), inclusief een kleurcodering: grijs = niet gestart, amber = gedeeltelijk, groen = volledig voltooid. |
| E3-28 | — | Vanuit het loggingscherm is met één tik de detailpagina van een oefening (trainingshistorie, E4) te bereiken via een icoon in de oefening-header. Na het sluiten keert de gebruiker terug naar exact dezelfde positie in het loggingscherm. |
| E3-29 | — | Het loggingscherm toont een vaste "Afronden"-knop onderaan het scherm (floating action area) naast de timer, zodat de gebruiker altijd zichtbaar kan afronden zonder naar de header te scrollen. |
| E3-30 | — | Wanneer de gebruiker de app sluit en heropent tijdens een actieve training, navigeert de app automatisch terug naar het loggingscherm (WorkoutPage) van de actieve training, zonder tussenkomst van de gebruiker. |
| E3-31 | — | De "Oefening toevoegen"-sheet is ook bereikbaar via de navigatiebalk (E3-26) als laatste item met een "+" icoon, zodat de gebruiker niet hoeft te scrollen naar het einde van de lijst. |
| E3-32 | — | Wanneer een oefening volledig is afgerond (alle sets voltooid of overgeslagen), toont de oefening-header een duidelijke "voltooid"-markering (bv. groen vinkje naast de naam). |
| E3-33 | — | Bij het voltooien van de laatste set van een oefening toont het systeem een korte inline-melding (bv. toast of subtiele animatie) met de beste set van die oefening in vergelijking met de vorige sessie (bv. "Beste set: 80 kg × 8 — +2,5 kg t.o.v. vorige sessie"). |
| E3-34 | — | Op het samenvattingsscherm toont het systeem een persoonlijk record-melding per oefening als de geschatte 1RM van deze sessie hoger is dan alle voorgaande sessies. |
| E3-35 | — | Het samenvattingsscherm toont een vergelijking met de vorige sessie van hetzelfde schema: totaal volume deze sessie t.o.v. vorige sessie, met een +/− verschil. |
| E3-36 | — | De training-timer in de header van WorkoutPage toont naast de verstreken tijd ook de geschatte resterende tijd op basis van de gemiddelde set-duur en het aantal resterende sets. De schatting is pas zichtbaar na minimaal 2 voltooide sets. |
| E3-37 | — | Bij het starten van een training vanuit een schema toont het systeem per oefening de datum en de beste set (gewicht × reps) van de meest recente sessie met datzelfde schema als subtekst onder de oefeningnaam. |
| E3-38 | — | Het systeem biedt bij het starten van een schema de optie "Kopieer gewichten van vorige sessie": hiermee worden alle kg-velden van alle sets geprefilled met de gewichten uit de corresponderende sets van de meest recente sessie. De gebruiker kan dit per set nog aanpassen. |
| E3-39 | — | Op de oefening-header in het loggingscherm is zichtbaar of de geplande sets en gewichten zijn verhoogd, verlaagd of gelijk t.o.v. de vorige sessie via een klein pijltje-icoon (omhoog / omlaag / gelijk), gebaseerd op de geprefillde waarden. |
| E3-40 | — | Na het afronden van een training stelt het samenvattingsscherm de volgende schema-dag voor (conform de logica van E2-11) inclusief een snelstartknop "Plan volgende sessie", die de gebruiker direct terugbrengt naar StartWorkoutPage met dat schema geselecteerd. |
| E3-41 | — | Wanneer een gebruiker een training start vanuit hetzelfde schema als de vorige sessie en de vorige sessie minder dan 48 uur geleden was, toont het systeem een niet-blokkerende waarschuwing: "Je hebt dit schema recent al gedaan. Weet je het zeker?" met een optie om toch door te gaan. |
| E3-42 | — | De StartWorkoutPage toont per schema de datum van de laatste sessie en het aantal dagen geleden (bv. "Laatste sessie: 3 dagen geleden") als subtekst onder de schema-naam. |

---

### Epic 4 — Trainingshistorie en voortgangsanalyse

**Doel:** Inzicht bieden in voortgang per oefening over tijd.

| ID | Status | Requirement |
|----|--------|-------------|
| E4-01 | ✓ | Per oefening is een historieoverzicht beschikbaar met alle gelogde sessies (datum, sets × reps × gewicht, beste set, geschatte 1RM). |
| E4-02 | ✓ | Het systeem berekent per sessie de geschatte 1RM op basis van de door de gebruiker gekozen formule (zie E8-01). Standaard: Epley (gewicht × (1 + reps/30)). Brzycki en Lombardi zijn beschikbaar. |
| E4-03 | ✓ | De geschatte 1RM wordt weergegeven in een lijndiagram over tijd, filterbaar op periode (4 weken, 3 maanden, alles). |
| E4-04 | ✓ | Per sessie wordt de beste set gemarkeerd op basis van de hoogste geschatte 1RM. |
| E4-05 | ✓ | De progressiepagina toont een lijst van alle oefeningen waarvoor sessies zijn gelogd, gesorteerd op meest recente sessie (nieuwste bovenaan). Klikken op een oefening opent een detailweergave met grafiek en sessielijst. |
| E4-06 | ~ | Trainingen kunnen worden verwijderd. Bewerken van bestaande trainingen is nog niet geïmplementeerd. |
| E4-07 | — | Het systeem toont een "Streak"-indicator: het aantal opeenvolgende weken dat de gebruiker minimaal één training heeft voltooid. De indicator is zichtbaar op het samenvattingsscherm na een training en/of op de historiepagina. |

---

### Epic 5 — Voedingsmiddelen- en receptendatabase

**Doel:** Een persoonlijke database van losse voedingsmiddelen en zelfgemaakte gerechten met voedingswaarden.

| ID | Status | Requirement |
|----|--------|-------------|
| E5-01 | ✓ | De gebruiker kan een voedingsmiddel handmatig aanmaken met naam, portiegrootte (gram), calorieën, eiwitten, koolhydraten en vetten. |
| E5-02 | — | Via een barcode-scanner (cameratoegang op mobiel) kan een product worden opgezocht in Open Food Facts. |
| E5-03 | — | Gevonden producten via barcode kunnen worden opgeslagen in de lokale database voor hergebruik. |
| E5-04 | ✓ | De gebruiker kan recepten aanmaken met een naam en een lijst van ingrediënten (met grammen per ingrediënt). |
| E5-05 | ✓ | Het systeem berekent automatisch de totale voedingswaarde van een recept op basis van de ingrediënten. |
| E5-06 | ✓ | Bij het loggen van een recept kan de gebruiker kiezen voor: het gehele recept, een fractie (bv. 1/4), of een specifieke hoeveelheid gram. |
| E5-07 | ✓ | Voedingsmiddelen en recepten zijn doorzoekbaar op naam. |
| E5-08 | ✓ | Voedingsmiddelen en recepten kunnen worden bewerkt of verwijderd. |

---

### Epic 6 — Macro's loggen

**Doel:** Het registreren van geconsumeerde voeding per dag, zonder verplichting tot dagelijkse volledigheid.

| ID | Status | Requirement |
|----|--------|-------------|
| E6-01 | ✓ | De gebruiker kan op elke datum voedingsmiddelen of recepten toevoegen aan een daglog. |
| E6-02 | ✓ | Per toevoeging specificeert de gebruiker de hoeveelheid (gram, portie of fractie afhankelijk van het type). |
| E6-03 | ✓ | De daglog toont een lopende totaaltelling van calorieën, eiwitten, koolhydraten en vetten. |
| E6-04 | ✓ | De gebruiker kan een dagelijks macrodoel instellen (calorieën, eiwitten, koolhydraten, vetten); de daglog toont voortgang t.o.v. dit doel. |
| E6-05 | ✓ | Items in de daglog kunnen worden bewerkt of verwijderd. |
| E6-06 | — | De gebruiker kan voedingen als "favoriet" markeren voor snelle toegang bij het loggen. |

---

### Epic 8 — Instellingen

**Doel:** Een centraal instellingenscherm voor persoonlijke voorkeuren en databeheer.

| ID | Status | Requirement |
|----|--------|-------------|
| E8-01 | — | De gebruiker kan de 1RM-formule kiezen: Epley, Brzycki of Lombardi. De keuze wordt direct toegepast op alle historische berekeningen. (De formules zijn in de code al geïmplementeerd; de UI-keuze ontbreekt nog.) |
| E8-02 | — | De gebruiker kan het detailniveau van spiergroepen instellen: globaal (8-10 groepen) of gedetailleerd (20+ spieren). Standaard: globaal. |
| E8-03 | — | De gebruiker kan dagelijkse macrodoelen instellen (calorieën, eiwitten, koolhydraten, vetten); deze worden gebruikt als referentie in de daglog (E6-04). |
| E8-04 | — | Instellingen worden lokaal opgeslagen en blijven behouden na het sluiten van de app. |
| E8-05 | ✓ | De gebruiker kan alle data wissen (trainingen, schema's, zelfgemaakte oefeningen). De standaard oefeningen worden daarna automatisch opnieuw ingeladen. Actie vereist bevestiging. |
| E8-06 | ✓ | De gebruiker kan een voorbeelddataset laden: een schema "Push A" en 13 bench press sessies verspreid over 3 maanden. Alleen beschikbaar als er nog geen trainingsdata aanwezig is. |
| E8-07 | ✓ | De gebruiker kan alle data exporteren als JSON-bestand. Standaard seed-oefeningen worden niet meegeëxporteerd. Het bestand bevat een versienummer en timestamp. |
| E8-08 | ✓ | De gebruiker kan een eerder geëxporteerd JSON-bestand importeren. Er zijn twee modi: "vervangen" (wist bestaande data) en "samenvoegen" (voegt toe). De import is atomair (bij fout wordt alles teruggerold). Na bestandsselectie ziet de gebruiker een preview met aantallen en kiest de importmodus. |

---

### Epic 9 — Weekplanner en persoonlijk assistent (toekomstig)

**Doel:** De gebruiker krijgt hulp bij het samenstellen van een gestructureerde trainings- en voedingsweek, met de app als persoonlijk assistent.

| ID | Status | Requirement |
|----|--------|-------------|
| E9-01 | — | De gebruiker kan een weekplan aanmaken door schema-dagen (E2-08/E2-11) te koppelen aan specifieke weekdagen (ma–zo). Meerdere schema's kunnen in hetzelfde weekplan worden gecombineerd. |
| E9-02 | — | De app toont op het startscherm welke schema-dag vandaag gepland staat, inclusief een snelstartknop voor die dag. |
| E9-03 | — | De weekplanner toont per dag de geplande training én een maaltijdadvies / meal-prep suggestie, afgestemd op de trainingsbelasting van die dag (bv. hogere eiwitinname op trainingsdagen). |
| E9-04 | — | De gebruiker kan voorkeuren opgeven (bv. voedingspatroon, rusdag-voorkeur) op basis waarvan de app een weekplan voorstelt. |
| E9-05 | — | Het weekplan is aanpasbaar per dag: training verplaatsen, overslaan of vervangen door een rustdag. |
| E9-06 | — | Meal-prep suggesties zijn gebaseerd op de receptendatabase (E5-04) en macrodoelen (E8-03); ze zijn optioneel en werken alleen als die modules actief zijn. |

---

### Epic 7 — Fitbit / Google Health integratie (nice to have)

**Doel:** Optioneel weergeven van gegevens uit Fitbit/Google Health, zonder dat de core-functionaliteit hiervan afhankelijk is.

| ID | Status | Requirement |
|----|--------|-------------|
| E7-01 | — | De gebruiker kan Fitbit/Google Health autoriseren via OAuth. |
| E7-02 | — | Slaapgegevens (duur, slaapfasen indien beschikbaar) worden weergegeven per dag op het dashboard of in een apart overzicht. |
| E7-03 | — | De koppeling is optioneel; alle functies werken volledig zonder deze integratie. |
| E7-04 | — | De gebruiker kan de koppeling op elk moment verwijderen. |

---

## 4. Niet-functionele requirements

| ID | Status | Requirement |
|----|--------|-------------|
| NF-01 | ✓ | **Platform:** De applicatie is een PWA, installeerbaar op Android en iOS, en volledig functioneel in een desktopbrowser. |
| NF-02 | ✓ | **Offline werking:** Alle core-functionaliteit (trainingen registreren, history inzien) werkt zonder internetverbinding. Barcode-lookup en Fitbit-sync vereisen een verbinding. |
| NF-03 | ✓ | **Lokale opslag:** Data wordt opgeslagen via IndexedDB (Dexie.js als abstractielaag). Geen gebruikersdata naar externe servers, uitgezonderd Open Food Facts en optionele Fitbit-koppeling. |
| NF-04 | ✓ | **Performance:** Schermovergangen en interacties tijdens het loggen voelen direct aan (< 100ms visuele respons). |
| NF-05 | ✓ | **UI/UX:** De interface is clean en minimalistisch, gebouwd op shadcn/ui (Radix UI + Tailwind CSS). Tijdens een actieve training is de UI teruggebracht tot essentiële acties. |
| NF-06 | ✓ | **Responsive design:** De UI is primair ontworpen voor mobiele schermen (360px+) en schaalt correct naar tablet en laptop. |

---

## 5. Architectuurkeuzes

Alle beslissingen zijn vastgelegd. Geen openstaande punten.

| # | Beslissing | Keuze | Toelichting |
|---|------------|-------|-------------|
| OD-01 | Tech stack frontend | React 19 + Vite 6 + TypeScript + shadcn/ui | shadcn/ui (Radix UI + Tailwind CSS) als design system; vite-plugin-pwa voor PWA |
| OD-02 | Lokale database | IndexedDB via Dexie.js | Geen backend nodig, werkt offline, schoon migratiepad naar native app later |
| OD-03 | Voedingsdatabase API voor barcode | Open Food Facts | Gratis, open, geen API-key vereist |
| OD-04 | 1RM-formule | Gebruikerskeuze (Epley standaard) | Instelbaar via Epic 8 — Instellingen |
| OD-05 | Spiergroepindeling | Gebruikerskeuze (globaal standaard) | Instelbaar via Epic 8 — Instellingen; standaard 8-10 groepen |

---

### Epic 10 — Voortgangs-dashboard

**Doel:** Een overzichtspagina waarop de gebruiker zijn krachtontwikkeling (geschatte 1RM per oefening of als gemiddelde) visueel kan afzetten tegen andere metrieken — met name macro-inname — om verbanden te zien tussen voeding en prestatie. De pagina is mobile-first, minimalistisch en biedt genoeg interactie om zinvolle vergelijkingen te maken zonder te vervallen in data-overload.

| ID | Status | Requirement |
|----|--------|-------------|
| E10-01 | — | De app bevat een dedicated dashboardpagina, bereikbaar via de bestaande bottomnav als extra tab (bv. "Dashboard"). De pagina vervangt geen bestaande pagina's maar vormt een eigen route. |
| E10-02 | — | Het dashboard toont een gecombineerd lijndiagram met twee Y-assen: de linker-as toont de geschatte 1RM (kg) van een geselecteerde oefening; de rechter-as toont een geselecteerde voedingsmetriek (calorieën, eiwitten, koolhydraten of vetten) per dag. De X-as is de gedeelde tijdlijn. |
| E10-03 | — | De gebruiker kan via een dropdown de oefening kiezen waarvoor de 1RM-lijn wordt getoond. De dropdown bevat alleen oefeningen waarvoor minimaal twee gelogde sessies beschikbaar zijn. Als geen oefening beschikbaar is, toont het systeem een melding: "Log minimaal twee sessies van dezelfde oefening om voortgang te zien." |
| E10-04 | — | De gebruiker kan via een tweede dropdown de voedingsmetriek kiezen die op de tweede Y-as wordt weergegeven: calorieën, eiwitten, koolhydraten of vetten. Als er geen voedingsdata beschikbaar is, wordt de tweede Y-as verborgen en toont het systeem een placeholder: "Voeg macro-logs toe om ze hier te zien." |
| E10-05 | — | Het diagram is filterbaar op tijdperiode: 4 weken, 3 maanden, alles. De standaard bij het openen van de pagina is 3 maanden. |
| E10-06 | — | Voedingsdatapunten worden per dag geaggregeerd (dagsom). Trainingsdatapunten worden per sessie getoond. Op dagen zonder training ontbreekt het 1RM-datapunt; de lijn wordt onderbroken (geen interpolatie). Op dagen zonder voedingslog ontbreekt het voedingsdatapunt. |
| E10-07 | — | Boven het diagram toont het dashboard drie samenvattingskaarten voor de geselecteerde periode en oefening: (1) begin-1RM vs. eind-1RM met absoluut en procentueel verschil; (2) gemiddelde dagelijkse inname van de geselecteerde voedingsmetriek; (3) aantal gelogde trainingssessies voor de geselecteerde oefening. |
| E10-08 | — | De geselecteerde oefening en voedingsmetriek worden onthouden zolang de gebruiker op de dashboardpagina blijft. Bij het verlaten en terugkeren naar de pagina worden de laatste selecties hersteld (via lokale state of sessionStorage). |
| E10-09 | — | Als er voor de geselecteerde periode minder dan twee trainingssessies beschikbaar zijn voor de gekozen oefening, toont het systeem in het diagram een melding in plaats van een lege grafiek: "Te weinig data voor deze periode — kies een langere periode of een andere oefening." |
| E10-10 | — | De 1RM-berekening op het dashboard gebruikt dezelfde formule als ingesteld via E8-01 (Epley standaard). Wijzigt de gebruiker de formule in de instellingen, dan herschikt het dashboard de waarden direct zonder pagina-herlaad. |
| E10-11 | — | Het diagram is touch-vriendelijk: een tik op een datapunt toont een tooltip met de exacte waarden (datum, 1RM in kg of voedingswaarde in g/kcal). Op desktop werkt hover. |
| E10-12 | — | Het dashboard werkt volledig offline. Alle data wordt uitgelezen uit de lokale IndexedDB. Er worden geen externe verzoeken gedaan. |

---

*Dit document dient als levend artefact en wordt bijgewerkt naarmate de scope evolueert.*
