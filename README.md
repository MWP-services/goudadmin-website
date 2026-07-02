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

- Teksten homepagina: `src/index.html`
- Privacyverklaring: `src/privacyverklaring/index.html`
- Kleuren, spacing en logoformaat: `src/styles.css`
- Logo en iconen: `src/assets/`
- SEO-indexering: `src/robots.txt` en `src/sitemap.xml`

De canonical URL's en sitemap gebruiken `https://goudadmin.nl`. Pas dit aan als `www.goudadmin.nl` het hoofddomein wordt.
