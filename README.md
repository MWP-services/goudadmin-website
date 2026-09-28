# GoudAdmin website

Statische basiswebsite voor GoudAdmin.

## Build

```bash
npm run build
```

De build-output staat in `dist`.

## Azure Static Web Apps

Gebruik bij deployment:

- App/source folder: `/`
- Build command: `npm run build`
- Output folder: `dist`

De Azure Static Web Apps-config staat in `src/staticwebapp.config.json` en wordt meegebouwd naar `dist/staticwebapp.config.json`.

## Aanpassen

### Klantbeheer: foto en diensten

De klant gebruikt `/beheer/` om de profielfoto te kiezen en de titel, korte
beschrijving en toelichting van de vier bestaande dienstenkaartjes aan te passen.
De velden hebben lengtelimieten; foto's worden in de browser verkleind naar JPEG
(maximaal 1200 pixels). Het voorbeeld verandert direct. Alleen **Publiceren op
website** slaat wijzigingen op voor alle bezoekers. **Wijzigingen herstellen**
zet het formulier terug naar de laatst geladen/gepubliceerde inhoud.

Andere websiteonderdelen zijn niet via deze beheerpagina of de schrijf-API te
wijzigen. Er zijn geen technische handelingen nodig voor de klant.

#### Eenmalige inrichting door de websitebeheerder

1. Maak in Azure een Storage Account en daarin een **private** blobcontainer
   `website-content`. Activeer blobversiebeheer voor herstel van eerdere publicaties.
2. Voeg in de Azure Static Web App de applicatie-instelling
   `CONTENT_STORAGE_CONNECTION_STRING` toe met de connection string van dat
   Storage Account. Bewaar deze uitsluitend in Azure, nooit in frontendcode of Git.
   Een andere containernaam kan via `CONTENT_STORAGE_CONTAINER` worden ingesteld.
3. Deploy de repository met de bijgewerkte GitHub Actions-workflow. Deze bouwt
   `src` naar `dist` en deployt de API uit `api`. De Node-runtime is `node:20`.
4. Nodig het Microsoft-account van de klant uit via **Role management** in de
   Static Web App, met de aangepaste rol **content_editor** en provider Microsoft
   Entra ID. Laat de klant de uitnodiging accepteren. Alleen inloggen is niet
   voldoende om te mogen publiceren.
5. Controleer op de gedeployde site: aanmelden als klant, een tekst/foto publiceren,
   de homepage in een aparte browsersessie verversen en uitloggen. Controleer ook
   dat een account zonder de rol niets kan publiceren. Deel daarna `/beheer/`.

De API gebruikt één privaat JSON-blob voor teksten en foto samen. Versiecontrole
(ETag) voorkomt ongemerkt overschrijven vanuit twee bewerksessies. Voor herstel
kan de websitebeheerder een eerdere blobversie terugzetten in Azure Storage.
Gebruik voor een aparte testomgeving een eigen container/account zodat
testpublicaties de live inhoud niet wijzigen.

De openbare pagina laadt de gepubliceerde inhoud bij openen. Bij een onbereikbare
API blijft de oorspronkelijke HTML beschikbaar; dan kunnen bezoekers tijdelijk
de oorspronkelijke foto/teksten zien. De oorspronkelijke inhoud staat ook in
`src/content.json`; de build kopieert die naar `api/default-content.json` voor de
eerste publicatie. Deze defaults wijzigen geen al gepubliceerde blob.

#### Lokaal bekijken en controleren

Met `npm run dev` is `/beheer/` een expliciet lokaal voorbeeld: foto kiezen,
teksten bewerken en herstellen werken; publiceren is uitgeschakeld en wijzigingen
worden niet bewaard. Dit is geen lokale login of omzeiling van de API-beveiliging.
De API controleert altijd de door Azure aangeleverde `content_editor`-rol.
Host deze API uitsluitend als beheerde Static Web Apps API, zodat Azure de
identiteitsheader controleert; stel de Function niet los openbaar beschikbaar.

```bash
npm ci
npm ci --prefix api
npm run build
npm test
```

Bronnen voor de inrichting: [Azure-aanmelding en rollen](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization)
en [beheerde Functions API](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions).

- Teksten homepagina: `src/index.html`
- Privacyverklaring: `src/privacyverklaring/index.html`
- Kleuren, spacing en logoformaat: `src/styles.css`
- Logo en iconen: `src/assets/`
- SEO-indexering: `src/robots.txt` en `src/sitemap.xml`

De canonical URL's en sitemap gebruiken `https://goudadmin.nl`. Pas dit aan als `www.goudadmin.nl` het hoofddomein wordt.
