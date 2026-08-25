# Savings Pocket

A local-first PWA for tracking savings, money lent to people, crypto holdings,
and daily spending on a calendar — installable on mobile as a PWA and usable
in any desktop browser.

- **Savings**: track cash/card balances by location and currency, plus a
  "Lent out" tab for money owed to you by name. Every amount change is logged
  to a per-entry history with a comment explaining why. A "Total net worth"
  card converts savings + crypto + loans into one currency of your choice; an
  "Exchange rates" screen shows the live rates behind that conversion.
- **Crypto**: track holdings in popular coins (or any CoinGecko-listed coin),
  converted live into your chosen fiat currencies.
- **Spending**: manually-created categories, a monthly calendar to log
  expenses per day (in any currency, mixed per day if needed), and a
  category breakdown for the month.
- **Currencies**: EUR, USD, RUB, JPY, and CNY are supported everywhere.
  Settings → Currencies lets you choose which ones are enabled for Savings,
  Crypto, and Spending independently — totals only show enabled currencies,
  though existing entries in a disabled currency are never hidden or deleted.

All data lives in the browser (IndexedDB) — there is no backend and nothing is
sent anywhere except live rate lookups to CoinGecko (crypto prices) and
open.er-api.com (fiat exchange rates). Use **Settings → Export backup**
regularly to keep a copy of your data.

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
  (savings, loans, crypto, spending, categories, history). Import restores
  from that file, replacing all current data.
