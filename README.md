# Savings Pocket

A local-first PWA for tracking savings (EUR/USD/RUB, cash or card, by location),
crypto holdings (live USD/EUR conversion), and daily spending on a calendar.

All data lives in the browser (IndexedDB) — there is no backend and nothing is
sent anywhere except live price lookups to the CoinGecko API. Use **Settings →
Export backup** regularly to keep a copy of your data.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Deploy to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and publishes `dist/` to
GitHub Pages automatically on every push to `main`. In the repo settings,
set **Settings → Pages → Source** to "GitHub Actions" once, and pushes will
deploy from then on. The Vite config uses a relative base path, so it works
whether the repo is a project page (`username.github.io/repo-name/`) or the
root of a user/org page.

## Data & backup

- Storage: IndexedDB via [Dexie](https://dexie.org/), scoped to the origin
  the app is served from — a different domain/path means a separate database.
- Backup: Settings → Export backup downloads a JSON snapshot of everything
  (savings, crypto, spending, categories, history). Import restores from that
  file, replacing all current data.
