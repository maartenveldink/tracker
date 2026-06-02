# Iteratieplan — Tracker App
*Versie 1.0 | Datum: 2026-06-02 | Gebaseerd op requirements.md v1.2*

---

## 1. Uitgangssituatie

De MVP-kern van de trainingsmodule is gereed. Epic 1, 2 en 3 zijn volledig geimplementeerd. Epic 4 (historie en voortgang) is functioneel op het bewerken van bestaande trainingen na. De instellingenpagina bestaat maar voert de functionele keuzes (1RM-formule, spiergroepdetailniveau) nog niet uit.

**Openstaande items die de huidige MVP onvolledig maken:**

| ID | Status | Omschrijving |
|----|--------|--------------|
| E4-06 | ~ | Trainingen kunnen worden verwijderd maar niet bewerkt |
| E8-01 | — | 1RM-formule keuze ontbreekt in UI (logica bestaat al) |
| E8-02 | — | Spiergroepdetailniveau keuze ontbreekt in UI (logica bestaat al) |
| E8-04 | — | Instellingen worden nog niet persistent opgeslagen |

---

## 2. Gefaseerd implementatieplan

### Iteratie 1 — Trainingsmodule afronden (aanbevolen eerstvolgende stap)

**Scope:** Alle openstaande `—` en `~` items binnen de trainingsmodule en instellingen die de bestaande functionaliteit completeren.

**Volgorde en rationale:**

1. **E8-04 eerst** — Instellingen persistent opslaan is de technische randvoorwaarde voor E8-01 en E8-02. Zonder persistentie vervalt een gekozen formule bij elke herstart.
2. **E8-01 en E8-02** — Activeren van logica die al in de code bestaat. Lage implementatieduur, directe gebruikerswaarde. E8-02 raakt ook Epic 1 en 2 (spierweergeave), dus vroeg oplossen voorkomt inconsistenties.
3. **E3-10** — Vorige prestatie tonen als referentie per set. Vereist leestoegang tot de sessiehistorie; de data is er al. Verhoogt de waarde van elke trainingsessie aanzienlijk.
4. **E4-07 / E4-08** — Trainingen bewerken. Complexer dan de bovenstaande items (form-state, validatie, impact op 1RM-berekeningen). Als laatste in Iteratie 1 zodat de instellingenlaag al stabiel is.

**Requirements in deze iteratie:**

| ID | Prioriteit | Requirement |
|----|-----------|-------------|
| E3-10 | P0 | Zie uitwerking sectie 3 |
| E4-07 | P0 | Zie uitwerking sectie 3 |
| E4-08 | P0 | Zie uitwerking sectie 3 |
| E8-01 | P0 | Zie uitwerking sectie 3 |
| E8-02 | P0 | Zie uitwerking sectie 3 |
| E8-04 | P0 | Zie uitwerking sectie 3 |

---

### Iteratie 2 — Voedingsmodule (Epic 5 + 6)

**Scope:** Volledige implementatie van voedingsmiddelendatabase, recepten, daglog en macrodoelen.

**Volgorde binnen de iteratie:**

1. E8-03 (macrodoelen instellen) — aanpassen bestaande instellingenpagina; kleine toevoeging.
2. E5-01 (handmatige invoer voedingsmiddel) — fundament voor alle overige voedingsfunctionaliteit.
3. E5-07 / E5-08 (zoeken en bewerken/verwijderen) — CRUD compleet maken voor losse voedingsmiddelen.
4. E6-01 / E6-02 / E6-03 (daglog toevoegen en totalen) — kernfunctie voor het loggen.
5. E6-04 (voortgang t.o.v. macrodoelen) — bouwt op E6-03 en E8-03.
6. E6-05 (daglog bewerken/verwijderen) — CRUD compleet maken voor de daglog.
7. E5-04 / E5-05 / E5-06 (recepten aanmaken, berekenen, loggen) — hogere complexiteit, bouwt op losse voedingsmiddelen.
8. E5-02 / E5-03 (barcode-scanner) — vereist cameratoegang en externe API; als laatste om UI-flow al stabiel te hebben.
9. E6-06 (favorieten) — nice-to-have, als tijd beschikbaar.
10. E5-09 / E5-10 / E6-07 / E6-08 (zie sectie 4) — nieuwe requirements uit review.

**Afhankelijkheden:** E8-04 (persistentie) moet gereed zijn vanuit Iteratie 1. E8-03 hangt af van de instellingeninfrastructuur uit Iteratie 1.

---

### Iteratie 3 — Dataportabiliteit

**Scope:** Export en import van alle app-data als JSON, zodat de gebruiker een back-up kan maken en data kan migreren.

**Volgorde:**

1. E8-07 (JSON export) — lezen uit IndexedDB, geen destructieve operatie, eenvoudig te implementeren.
2. E8-08 (JSON import) — complexer vanwege validatie, conflictdetectie en foutafhandeling.

**Afhankelijkheden:** Pas zinvol na Iteratie 2, omdat de export anders geen voedingsdata bevat. Kan los van Iteratie 2 worden gepland als de voedingsmodule vertraging oploopt, mits het dataschema voor voeding al vaststaat.

---

## 3. Uitgewerkte requirements — Iteratie 1

De volgende requirements zijn nieuw of verfijnd tot het niveau van de geimplementeerde epics.

---

### E3-10 — Vorige prestatie tonen als referentie per set

| Veld | Inhoud |
|------|--------|
| ID | E3-10 |
| Status | — |
| Prioriteit | P0 |
| Epic | Epic 3 — Training registreren (live logging) |

| ID | Status | Requirement |
|----|--------|-------------|
| E3-10 | — | Tijdens een actieve training toont het systeem per oefening de meest recente vorige sessie als referentie: gewicht en reps per set, de datum van die sessie, en de beste geschatte 1RM van die sessie. De referentie is zichtbaar zonder de actieve invoer te verbergen. Als er geen vorige sessie beschikbaar is voor een oefening, toont het systeem een placeholder ("Geen eerdere sessie"). |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E3-10-01 | De vorige-sessie-referentie is zichtbaar zodra een training op basis van een schema is gestart en de oefening actief is. |
| AC-E3-10-02 | De referentie toont per set: het gewicht (kg), het aantal reps en de geschatte 1RM van de vorige sessie voor diezelfde set-positie. |
| AC-E3-10-03 | De datum van de referentiesessie is leesbaar weergegeven (bv. "14 mei 2026"). |
| AC-E3-10-04 | Als een oefening in de vorige sessie meer sets had dan de huidige planning, worden alleen de sets getoond die overeenkomen met de huidige planning. |
| AC-E3-10-05 | Als er geen vorige sessie is voor een oefening, toont het systeem "Geen eerdere sessie" op de positie van de referentie. |
| AC-E3-10-06 | De referentie is ook zichtbaar bij ad-hoc trainingen, voor zover er een vorige sessie beschikbaar is voor de gekozen oefening. |
| AC-E3-10-07 | De referentieweergave heeft geen invloed op de invoer van de actieve set (afzonderlijke UI-zones). |

---

### E4-07 — Workout bewerken: toegang en navigatie

| ID | Status | Requirement |
|----|--------|-------------|
| E4-07 | — | Vanuit de historieweergave (sessielijst per oefening en uit het trainingsoverzicht) kan de gebruiker een bestaande training openen in een bewerkingsmodus. De bewerkingspagina is bereikbaar via een expliciete "Bewerken"-actie; de historieweergave zelf blijft alleen-lezen. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E4-07-01 | Op de detailpagina van een sessie is een "Bewerken"-knop zichtbaar. |
| AC-E4-07-02 | De bewerkingspagina laadt de bestaande setgegevens voor (gewicht, reps, notities). |
| AC-E4-07-03 | Navigeren naar de bewerkingspagina wijzigt de opgeslagen data nog niet; wijzigingen worden alleen opgeslagen na expliciete bevestiging. |
| AC-E4-07-04 | De gebruiker kan de bewerkingspagina verlaten zonder op te slaan; het systeem vraagt om bevestiging als er niet-opgeslagen wijzigingen zijn. |

---

### E4-08 — Workout bewerken: inhoud aanpassen

| ID | Status | Requirement |
|----|--------|-------------|
| E4-08 | — | In de bewerkingsmodus kan de gebruiker per set het gewicht (kg) en het aantal reps aanpassen. De gebruiker kan sets toevoegen aan een bestaande oefening of sets verwijderen. De gebruiker kan oefeningen toevoegen aan de training of een oefening volledig verwijderen uit de training. Trainingsnotities en oefennotities zijn bewerkbaar. Datum en starttijd zijn niet bewerkbaar. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E4-08-01 | Gewicht en reps zijn bewerkbaar per set via dezelfde invoercomponenten als de live logging. |
| AC-E4-08-02 | Een set kan worden verwijderd; het systeem vraagt geen bevestiging voor het verwijderen van een enkele set. |
| AC-E4-08-03 | Een extra set kan worden toegevoegd aan een bestaande oefening; de nieuwe set wordt onderaan de lijst geplaatst. |
| AC-E4-08-04 | Een oefening kan worden verwijderd uit de training; het systeem toont een bevestigingsmelding als de oefening de enige in de training is. |
| AC-E4-08-05 | Een oefening kan worden toegevoegd via dezelfde oefenzoeker als in de live logging. |
| AC-E4-08-06 | Na opslaan worden de 1RM-berekeningen voor de gewijzigde sessie direct herberekend op basis van de actuele ingestelde formule (E8-01). |
| AC-E4-08-07 | De progressiegrafiek (E4-03) reflecteert de herberekende waarden direct na opslaan. |
| AC-E4-08-08 | Datum en starttijd van de training zijn niet bewerkbaar in deze interface. |

---

### E4-09 — Workout bewerken: validatie en foutafhandeling

| ID | Status | Requirement |
|----|--------|-------------|
| E4-09 | — | Het systeem valideert de invoer bij het opslaan van een bewerkte training. Gewicht moet groter zijn dan 0. Reps moet een geheel getal zijn groter dan 0. Een training moet minimaal één oefening met minimaal één set bevatten. Bij validatiefouten worden de velden gemarkeerd met een foutmelding en wordt opslaan geblokkeerd. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E4-09-01 | Een gewichtswaarde van 0 of negatief resulteert in een inline foutmelding bij het betreffende veld. |
| AC-E4-09-02 | Een reps-waarde van 0, negatief of niet-geheel resulteert in een inline foutmelding. |
| AC-E4-09-03 | De "Opslaan"-knop is uitgeschakeld zolang er validatiefouten zijn. |
| AC-E4-09-04 | Als de laatste oefening wordt verwijderd, verschijnt een melding: "Een training moet minimaal één oefening bevatten." De verwijdering wordt niet uitgevoerd. |

---

### E8-01 — 1RM-formule instelbaar (UI)

| ID | Status | Requirement |
|----|--------|-------------|
| E8-01 | — | Op de instellingenpagina kan de gebruiker de 1RM-formule kiezen uit drie opties: Epley (standaard), Brzycki en Lombardi. De gekozen formule wordt direct na selectie toegepast op alle bestaande historische 1RM-berekeningen en op toekomstige sessies. De naam en beschrijving van elke formule zijn leesbaar weergegeven. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E8-01-01 | De instellingenpagina toont een keuzecomponent (bv. radio-groep of select) met de drie formules. |
| AC-E8-01-02 | De naam en formule-uitleg (één zin) zijn zichtbaar naast elke optie. |
| AC-E8-01-03 | De standaardkeuze bij eerste gebruik is Epley. |
| AC-E8-01-04 | Na het wijzigen van de formule toont de progressiegrafiek (E4-03) direct de herberekende 1RM-waarden zonder dat de pagina opnieuw geladen hoeft te worden. |
| AC-E8-01-05 | De keuze wordt persistent opgeslagen (E8-04) en blijft behouden na herstart van de app. |

---

### E8-02 — Spiergroepdetailniveau instelbaar (UI)

| ID | Status | Requirement |
|----|--------|-------------|
| E8-02 | — | Op de instellingenpagina kan de gebruiker het detailniveau van spiergroepen kiezen: globaal (8–10 groepen, standaard) of gedetailleerd (20+ spieren). De keuze wordt direct toegepast op alle schermen waarop spiergroepen worden weergegeven: oefenformulier, schema-analyse, trainingsoverzicht en samenvatting. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E8-02-01 | De instellingenpagina toont een keuzecomponent met twee opties: "Globaal" en "Gedetailleerd". |
| AC-E8-02-02 | De standaardkeuze bij eerste gebruik is "Globaal". |
| AC-E8-02-03 | Na het wijzigen van het detailniveau reflecteren alle spiergroepweergaven in de app de nieuwe instelling zonder dat de pagina opnieuw geladen hoeft te worden. |
| AC-E8-02-04 | De keuze wordt persistent opgeslagen (E8-04). |
| AC-E8-02-05 | Bij het aanmaken of bewerken van een oefening toont de spiergroepkiezer de spiergroepen op het ingestelde detailniveau. |

---

### E8-04 — Instellingen persistent opslaan

| ID | Status | Requirement |
|----|--------|-------------|
| E8-04 | — | Alle gebruikersinstellingen (1RM-formule, spiergroepdetailniveau, macrodoelen) worden opgeslagen in de lokale database (IndexedDB) en blijven behouden na het sluiten en opnieuw openen van de app. Bij eerste gebruik worden de standaardwaarden toegepast en opgeslagen. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E8-04-01 | Na het sluiten en opnieuw openen van de app zijn de eerder gekozen instellingen nog actief. |
| AC-E8-04-02 | Bij eerste gebruik (lege database) worden de standaardwaarden (Epley, globaal, geen macrodoelen ingesteld) automatisch aangemaakt in de database. |
| AC-E8-04-03 | Het wissen van alle data (E8-05) reset ook de instellingen naar standaardwaarden. |
| AC-E8-04-04 | Instellingen worden opgeslagen in dezelfde IndexedDB-instantie als trainingsdata (geen aparte opslag zoals localStorage). |

---

## 4. Nieuwe requirements — geidentificeerd tijdens review

De volgende requirements zijn geidentificeerd tijdens de requirements-review maar staan nog niet in requirements.md. Ze moeten worden opgenomen bij de eerstvolgende update van dat document.

---

### E5-09 — Voedingswaarden per 100 gram weergeven

| ID | Status | Requirement |
|----|--------|-------------|
| E5-09 | — | Naast de voedingswaarden per portie toont het systeem altijd ook de waarden per 100 gram, zodat de gebruiker producten onderling kan vergelijken ongeacht portiegrootte. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E5-09-01 | Het detailscherm van een voedingsmiddel toont zowel de waarden per portie als per 100 gram. |
| AC-E5-09-02 | Als een product via barcode is gevonden en Open Food Facts waarden per 100 gram levert, worden deze direct ingevuld. |
| AC-E5-09-03 | Bij handmatige invoer berekent het systeem de waarden per 100 gram automatisch op basis van de ingevoerde portiegrootte en voedingswaarden. |

---

### E5-10 — Recente en favoriete voedingsmiddelen bij snel loggen

| ID | Status | Requirement |
|----|--------|-------------|
| E5-10 | — | Bij het toevoegen van een voedingsmiddel aan de daglog toont het systeem een lijst van recent gebruikte voedingsmiddelen (laatste 10, op datum van laatste gebruik) bovenaan de zoekresultaten, vóór de volledige database. Favorieten (E6-06) worden gemarkeerd in deze lijst. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E5-10-01 | De toevoegdialoog toont bij een lege zoekterm de 10 meest recent gebruikte voedingsmiddelen. |
| AC-E5-10-02 | Bij een zoekterm worden recente items die overeenkomen bovenaan getoond, gevolgd door overige database-resultaten. |
| AC-E5-10-03 | Favorieten zijn visueel gemarkeerd (bv. een icoon) in zowel de recente lijst als de zoekresultaten. |

---

### E6-07 — Weekoverzicht macro's

| ID | Status | Requirement |
|----|--------|-------------|
| E6-07 | — | Naast de daglog biedt het systeem een weekoverzicht dat per dag de totale calorieën, eiwitten, koolhydraten en vetten toont voor de lopende week (maandag t/m zondag). Dagen zonder gelogde voeding tonen een nulwaarde. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E6-07-01 | Het weekoverzicht is bereikbaar vanaf de daglog via een navigatieknop of tab. |
| AC-E6-07-02 | Het overzicht toont zeven rijen (ma–zo) met per dag de totalen voor calorieën, eiwitten, koolhydraten en vetten. |
| AC-E6-07-03 | Dagen zonder gelogde voeding tonen "0" voor alle waarden, niet leeg of "–". |
| AC-E6-07-04 | De gebruiker kan naar de vorige en volgende week navigeren. |
| AC-E6-07-05 | Als macrodoelen zijn ingesteld (E8-03), toont elke dag de voortgang t.o.v. het doel (bv. kleurcodering of percentage). |

---

### E6-08 — Daglog kopiëren naar andere datum

| ID | Status | Requirement |
|----|--------|-------------|
| E6-08 | — | De gebruiker kan de volledige daglog van een dag kopiëren naar een andere datum. Bestaande items op de doeldatum blijven behouden; de gekopieerde items worden toegevoegd. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E6-08-01 | Op de daglog is een optie beschikbaar om de huidige dag te kopiëren naar een andere datum. |
| AC-E6-08-02 | De gebruiker selecteert de doeldatum via een datumkiezer. |
| AC-E6-08-03 | Na bevestiging worden alle items van de brondag als nieuwe vermeldingen toegevoegd aan de doeldag; items op de doeldag worden niet overschreven of verwijderd. |
| AC-E6-08-04 | Het systeem toont een bevestigingsmelding met het aantal gekopieerde items en de doeldatum. |

---

### E8-07 — Data exporteren als JSON

| ID | Status | Requirement |
|----|--------|-------------|
| E8-07 | — | De gebruiker kan vanuit de instellingenpagina alle app-data exporteren als een JSON-bestand. De export bevat trainingsschema's, workouts, oefeningen (gebruikersaanpassingen en aanvullingen op de standaardset), voedingsmiddelen, recepten, dagloggegevens en instellingen. Standaard seeddataset-oefeningen die niet zijn gewijzigd worden niet meegenomen in de export om de bestandsgrootte beperkt te houden. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E8-07-01 | De instellingenpagina toont een "Exporteer data"-knop. |
| AC-E8-07-02 | Na het klikken op de knop wordt een JSON-bestand gedownload naar het apparaat met de bestandsnaam `tracker-export-JJJJ-MM-DD.json`. |
| AC-E8-07-03 | Het JSON-bestand bevat een versienummer van het exportformaat (bv. `"exportVersion": 1`) zodat toekomstige imports het schema kunnen valideren. |
| AC-E8-07-04 | De export bevat alle workouts, schema's, gebruikersgemaakte en -gewijzigde oefeningen, voedingsmiddelen, recepten, daglogs en instellingen. |
| AC-E8-07-05 | De export werkt volledig offline (geen netwerk vereist). |
| AC-E8-07-06 | Als er geen data aanwezig is, geeft de knop een melding: "Er is geen data om te exporteren." |

---

### E8-08 — Data importeren vanuit JSON

| ID | Status | Requirement |
|----|--------|-------------|
| E8-08 | — | De gebruiker kan vanuit de instellingenpagina een eerder geëxporteerd JSON-bestand importeren. Het systeem valideert het bestand voor import. De gebruiker kiest expliciet of bestaande data wordt vervangen of samengevoegd. |

**Acceptatiecriteria:**

| # | Criterium |
|---|-----------|
| AC-E8-08-01 | De instellingenpagina toont een "Importeer data"-knop die een bestandskiezer opent. |
| AC-E8-08-02 | Het systeem controleert of het gekozen bestand een geldig JSON-bestand is met het verwachte exportformaat (aanwezigheid van `exportVersion` en verplichte sleutels). |
| AC-E8-08-03 | Bij een ongeldig bestand toont het systeem een foutmelding en wordt de import afgebroken zonder data te wijzigen. |
| AC-E8-08-04 | Het systeem toont een samenvatting van de te importeren data (aantal workouts, schema's, oefeningen, voedingsmiddelen) en vraagt bevestiging voor de import. |
| AC-E8-08-05 | De gebruiker kiest voor "Vervangen" (alle bestaande data wordt gewist en vervangen) of "Samenvoegen" (bestaande data blijft, geimporteerde items worden toegevoegd; duplicaten op basis van naam worden overgeslagen). |
| AC-E8-08-06 | Na een geslaagde import toont het systeem een bevestigingsmelding met het aantal succesvol geimporteerde items per categorie. |
| AC-E8-08-07 | Een mislukte import (bv. door een corrupte dataset) laat de bestaande data intact. |

---

### NF-07 — Exportformaat stabiel en gedocumenteerd

| ID | Status | Requirement |
|----|--------|-------------|
| NF-07 | — | Het JSON-exportformaat is versiegestuurd. Bij wijzigingen aan het formaat in toekomstige releases moet het versienummer worden verhoogd. De importfunctie (E8-08) moet bestanden van de huidige en vorige formatversie kunnen lezen. |

---

### NF-08 — Importvalidatie beschermt bestaande data

| ID | Status | Requirement |
|----|--------|-------------|
| NF-08 | — | De importoperatie is atomair: als een fout optreedt tijdens het schrijven naar de database, wordt de gehele import teruggedraaid en blijft de bestaande data ongewijzigd. |

---

### NF-09 — Cameratoegang voor barcode-scanner

| ID | Status | Requirement |
|----|--------|-------------|
| NF-09 | — | De barcode-scanner (E5-02) vraagt cameratoestemming op het moment dat de scanner voor het eerst wordt geopend, niet bij het starten van de app. Als de gebruiker toestemming weigert, toont het systeem een instructie om toestemming handmatig in te schakelen via de browserinstellingen. De rest van de app werkt volledig zonder cameratoestemming. |

---

## 5. Aanbeveling: volgorde voedingsmodule vs. trainingsmodule afronden

**Aanbeveling: Iteratie 1 eerst, dan Iteratie 2.**

**Onderbouwing:**

1. **Technische afhankelijkheid.** E8-04 (instellingen persistent opslaan) is een randvoorwaarde voor E8-03 (macrodoelen), dat op zijn beurt nodig is voor E6-04 (voortgang daglog t.o.v. doel). Door Iteratie 1 eerst te doen, is de instellingeninfrastructuur stabiel voordat de voedingsmodule erop bouwt. Dit voorkomt dat er tijdelijke oplossingen (bv. localStorage) worden gebouwd die later weer verwijderd moeten worden.

2. **Gebruikerservaring.** De app is primair een trainingstool. Gebruikers die nu dagelijks trainingen loggen, lopen tegen E4-06 (bewerken) en E3-10 (referentie) aan. Het afronden hiervan verhoogt de dagelijkse waarde van de bestaande kern zonder nieuw terrein te betreden.

3. **Risicospreiding.** De voedingsmodule (Epic 5 + 6) is de grootste ongeimplementeerde blok: barcode-scanner, externe API, receptberekening, daglog, weekoverzicht. Iteratie 1 is compact en voorspelbaar. Door eerst Iteratie 1 af te ronden, ontstaat een betrouwbaar fundament en een duidelijker beeld van de beschikbare bouwtijd voor Iteratie 2.

4. **Geen verloren werk.** De 1RM-formule- en spiergroeplogica bestaat al in de code. E8-01 en E8-02 zijn primair UI-werk. Dit zijn snelle winsten die de trainingsmodule afsluiten zonder grote refactoring.

**Uitzondering:** Als er een concrete externe deadline of gebruikersbehoefte is voor de voedingsmodule (bv. een dieetperiode die start), kan Iteratie 2 naar voren worden getrokken — op voorwaarde dat E8-04 als eerste taak binnen Iteratie 2 wordt opgepakt.

---

*Dit document is een iteratieplan en geen vervanging van requirements.md. Goedgekeurde requirements uit dit plan worden na implementatie verwerkt in requirements.md.*
