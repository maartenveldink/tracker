# Requirements — Google Health integratie
*Versie 1.0 | Datum: 2026-06-02*

---

## Inleiding

Dit document werkt de ruwe schets van Epic 7 (E7-01 t/m E7-04) uit tot implementeerbaar niveau voor de Google Health integratie. De Fitbit-variant uit de oorspronkelijke Epic 7-titel wordt in dit document buiten beschouwing gelaten; die vraagt een aparte uitwerking.

**Doel van de integratie:** De gebruiker kan optioneel gegevens uit Google Health (Android Health Connect of Google Fit) ophalen en weergeven naast zijn trainings- en voedingsdata, zodat hij verbanden kan leggen tussen herstel (slaap, hartfrequentie) en trainingsprestaties.

**Scope:** Autorisatie, slaapdata, aanvullende metrieken, foutafhandeling, privacymodel en koppeling met het voortgangs-dashboard (Epic 10). De koppeling is volledig optioneel — alle andere functies in de app werken zonder deze integratie.

**Aannames:**
- De app draait als PWA op Android (primair) en desktop/iOS (beperkte Google Health-ondersteuning).
- Op Android wordt de Health Connect REST API (Android 14+) als primaire bron gebruikt; op andere platforms wordt teruggevallen op de Google Fit REST API.
- Er is geen backend: OAuth-tokens worden uitsluitend lokaal opgeslagen (IndexedDB of localStorage met encryption-flag).
- Synchronisatie is pull-based en on-demand (geen push/webhook).
- De gebruiker heeft een Google-account en heeft Health Connect of Google Fit-data beschikbaar.

---

## Sectie 1 — Autorisatie (OAuth 2.0)

De koppeling verloopt via de Google OAuth 2.0 Authorization Code flow met PKCE, omdat er geen backend aanwezig is om een client secret veilig op te slaan. De app vraagt alleen de scopes op die daadwerkelijk worden gebruikt.

**Benodigde OAuth-scopes:**

| Scope | Doel |
|-------|------|
| `https://www.googleapis.com/auth/fitness.sleep.read` | Slaapdata via Google Fit |
| `https://www.googleapis.com/auth/fitness.activity.read` | Stappen en activiteitsdata |
| `https://www.googleapis.com/auth/fitness.heart_rate.read` | Hartfrequentiedata |

Voor Health Connect (Android) gelden equivalente Health Connect permission strings in plaats van Fit-scopes; de UX-flow is identiek.

| ID | Status | Requirement |
|----|--------|-------------|
| E7-05 | — | De gebruiker kan Google Health koppelen via een "Koppel Google Health" knop in het instellingenscherm (E8). De knop opent de Google OAuth-autorisatiepagina in een popup of redirect. De app gebruikt de Authorization Code flow met PKCE; er wordt geen client secret in de client opgeslagen. |
| E7-06 | — | De app vraagt uitsluitend de scopes op die daadwerkelijk worden gebruikt (slaap, stappen, hartfrequentie). De gebruiker ziet in het Google-autorisatiescherm welke data de app wil inzien. |
| E7-07 | — | Na succesvolle autorisatie worden het access token en refresh token versleuteld opgeslagen in IndexedDB. Tokens verlaten de app nooit via een netwerkverzoek naar een eigen server; alle API-aanroepen gaan rechtstreeks naar Google. |
| E7-08 | — | Het systeem vernieuwt het access token automatisch via het refresh token wanneer het is verlopen, zonder dat de gebruiker opnieuw hoeft in te loggen. Als het refresh token ongeldig is geworden (bv. door intrekking), toont het systeem een niet-blokkerende melding in de instellingen: "Google Health-koppeling verlopen — opnieuw koppelen." |
| E7-09 | — | Het instellingenscherm toont de koppelstatus: "Niet gekoppeld" of "Gekoppeld als [Google-accountnaam]" inclusief de datum van de laatste succesvolle synchronisatie. |
| E7-10 | — | De gebruiker kan de koppeling verwijderen via een "Ontkoppel"-knop in de instellingen. Bij ontkoppelen worden alle lokaal opgeslagen tokens en gesynchroniseerde Google Health-data gewist. De actie vereist bevestiging. |

---

## Sectie 2 — Slaapdata

Slaapdata is de primaire reden voor de Google Health-integratie: de gebruiker wil kunnen zien of slechte slaap samenvalt met tegenvallende trainingsprestaties.

**Beschikbare datavelden via Google Fit Sleep Sessions API:**
- Slaapduur (begin- en eindtijdstip van de slaapsessie)
- Slaapfasen: licht (1), diep (2), REM (3), wakker (4) — indien beschikbaar via de gebruikte tracker

| ID | Status | Requirement |
|----|--------|-------------|
| E7-11 | — | Na koppeling haalt het systeem slaapdata op voor de afgelopen 90 dagen (éénmalig bij eerste koppeling) en daarna dagelijks bij het openen van de app als er een actieve internetverbinding is. Synchronisatie is on-demand; er is geen achtergrond-sync. |
| E7-12 | — | Per dag toont het systeem de totale slaapduur (in uren en minuten) en, indien beschikbaar, de verdeling over slaapfasen (licht, diep, REM) als een visuele staaf. De weergave is zichtbaar op het dashboard (Epic 10) als een derde datareeks naast 1RM en voedingsdata. |
| E7-13 | — | Slaapdata wordt opgeslagen in IndexedDB per datum. Als voor een dag meerdere slaapsessies beschikbaar zijn (bv. een dutje), worden ze samengevoegd tot één dagsom voor slaapduur; de langste aaneengesloten sessie bepaalt de slaapfaseverdeling. |

---

## Sectie 3 — Overige metrieken

Naast slaap zijn er aanvullende metrieken die aansluiten bij de focus van de app (krachtontwikkeling en herstel).

**Beschikbaarheid en relevantie:**

| Metriek | Google API | Relevantie |
|---------|-----------|------------|
| Dagelijkse stappen | Fit / Health Connect | Matige correlatie met herstel; nuttig als activiteitsindicator |
| Hartfrequentie in rust (RHR) | Fit / Health Connect | Sterke herstelmarker; hoge RHR = mogelijk onderherstel |
| HRV (Heart Rate Variability) | Alleen Health Connect (Android 14+) | Beste herstelmarker, maar beperkte beschikbaarheid |

HRV is buiten scope voor v1 vanwege beperkte beschikbaarheid; stappen en RHR worden wel opgenomen.

| ID | Status | Requirement |
|----|--------|-------------|
| E7-14 | — | Het systeem haalt dagelijkse stapdata op via de Google Fit Steps API (of Health Connect equivalent) voor dezelfde periode als slaapdata. Stappen worden per dag opgeslagen als geheel getal. |
| E7-15 | — | Het systeem haalt de hartfrequentie in rust (RHR) op per dag via de Google Fit Heart Rate API. Als de API meerdere metingen per dag levert, gebruikt het systeem de laagste waarde van die dag als dagwaarde voor RHR. |
| E7-16 | — | Op het dashboard (Epic 10) kan de gebruiker naast calorieën/macros ook Google Health-metrieken kiezen als tweede Y-as: slaapduur (uren), stappen (aantal) of hartfrequentie in rust (bpm). De dropdown (E10-04) wordt uitgebreid met deze opties zodra een koppeling actief is. |

---

## Sectie 4 — Foutafhandeling

| ID | Status | Requirement |
|----|--------|-------------|
| E7-17 | — | Wanneer een API-aanroep naar Google mislukt vanwege geen internetverbinding, toont het systeem geen foutmelding maar toont het de laatst gesynchroniseerde data met een subtiele indicator "Laatste sync: [datum/tijd]". De app blijft volledig bruikbaar. |
| E7-18 | — | Wanneer Google een 403-foutcode teruggeeft (scope geweigerd of ingetrokken), toont het systeem een melding in de instellingen: "Toegang geweigerd — controleer de Google Health-machtigingen in je Google-accountinstellingen." De melding bevat een directe link naar de Google-accountpagina voor app-toegang. |
| E7-19 | — | Als de Google API gedurende meer dan 7 dagen geen succesvolle synchronisatie heeft kunnen uitvoeren (bv. door aanhoudende fouten), toont het systeem een persistente waarschuwing in de instellingen en verbergt het de Google Health-datareeksen op het dashboard totdat de synchronisatie is hersteld. |

---

## Sectie 5 — Privacy en data

| ID | Status | Requirement |
|----|--------|-------------|
| E7-20 | — | Alle Google Health-data (slaap, stappen, hartfrequentie) wordt uitsluitend lokaal opgeslagen in IndexedDB. Er worden geen Google Health-gegevens doorgestuurd naar externe servers, ook niet bij gebruik van de export-functie (E8-07): de JSON-export bevat geen Google Health-data tenzij de gebruiker dit expliciet aanvinkt. |
| E7-21 | — | Bij het ontkoppelen van Google Health (E7-10) worden alle opgehaalde gezondheidsgegevens direct en onomkeerbaar uit IndexedDB gewist. Het systeem toont na ontkoppeling een bevestiging dat de data is verwijderd. |
| E7-22 | — | De app toont in de instellingen een beknopte privacytoelichting: welke data wordt opgehaald, dat deze lokaal blijft en hoe de gebruiker de koppeling kan intrekken. De toelichting bevat een link naar de Google Health privacy policy. |

---

## Sectie 6 — Dashboard-integratie (relatie met Epic 10)

De Google Health-data is het meest waardevol in combinatie met trainingsprestaties. Epic 10 definieert al een gecombineerd lijndiagram met twee Y-assen (1RM en voedingsmetriek). Deze sectie breidt dat uit voor gezondheidsdata.

| ID | Status | Requirement |
|----|--------|-------------|
| E7-23 | — | De tweede Y-as dropdown op het dashboard (E10-04) wordt uitgebreid met Google Health-opties (slaapduur, stappen, RHR) zodra een actieve koppeling aanwezig is. Als geen koppeling actief is, zijn deze opties niet zichtbaar in de dropdown. |
| E7-24 | — | Slaapduurdata op het dashboard wordt weergegeven als staafdiagram (niet als lijn) op de gedeelde tijdlijn, zodat het visueel onderscheiden is van de 1RM-lijn. Stappen en RHR worden als lijnen weergegeven op de tweede Y-as. |
| E7-25 | — | Als de gebruiker slaapduur of RHR als tweede metriek kiest, toont het dashboard in de samenvattingskaarten (E10-07) aanvullend: gemiddelde slaapduur of gemiddelde RHR voor de geselecteerde periode, naast de bestaande 1RM- en voedingssamenvattingen. |

---

## Open vragen

- **Health Connect vs. Google Fit:** Health Connect is de toekomst op Android maar vereist Android 14+ en specifieke Play Store-goedkeuring voor apps die gezondheidsdata opvragen. Google Fit is deprecated maar breder beschikbaar. Beslissing over primaire API-keuze vereist afstemming op targetplatform.
- **iOS-ondersteuning:** Google Health is niet beschikbaar op iOS. Apple Health Connect is een aparte integratie. Bepaal of iOS-gebruikers een placeholder zien of de sectie volledig verborgen blijft.
- **PKCE-implementatie in PWA:** Verificeer dat de gekozen OAuth-library (bv. `@badgateway/oauth2-client`) PKCE correct ondersteunt in een service worker-context.

---

*Dit document is een levend artefact. Requirements met status `—` zijn nog niet geïmplementeerd en hebben geen prioritering toegewezen gekregen.*
