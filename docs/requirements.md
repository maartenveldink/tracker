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

*Dit document dient als levend artefact en wordt bijgewerkt naarmate de scope evolueert.*
