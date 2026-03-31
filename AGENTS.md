# Boundless Profit Explorer

A profitability calculator for Boundless ZK prover operators. Helps operators evaluate GPU configurations and understand break-even points across different ZKC price scenarios.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Charts**: Recharts
- **Icons**: lucide-react
- **API**: Cloudflare Pages Functions (in `functions/`)
- **Cache**: Cloudflare KV (`EPOCHS_CACHE` namespace)
- **Deploy**: Cloudflare Pages

## Features

- **Profit Explorer** — Horizontal bar charts showing profit per epoch at a selected ZKC price
- **Break-even** — Minimum ZKC price required to break even per GPU configuration
- **Scenarios** — Line charts showing profit vs ZKC price curves for each GPU config
- Editable GPU configuration table (inline add/delete/edit)
- POVW rate auto-computed from live epoch data fetched from `/api/epochs`
- All calculations match the Boundless notebook model

## Dev Commands

```bash
# Install dependencies
npm install

# Start dev server (no Pages Functions — falls back to bundled epochs.json)
npm run dev

# Start dev server WITH Pages Functions + KV (requires wrangler)
npx wrangler pages dev dist --kv EPOCHS_CACHE
# Note: run `npm run build` first to generate dist/, then serve with wrangler

# Type-check + production build
npm run build

# Preview production build (static only, no Functions)
npm run preview
```

## API

### `GET /api/epochs`

Returns a JSON array of epoch data normalised from `https://explorer.boundless.network/api/mining`.

Cached in KV for 2 hours. Returns `X-Cache: HIT | MISS | STALE` header.

```json
[
  {
    "epoch": 100,
    "timestamp": "2026-03-27T...",
    "zkc_price_usd": 0.072116,
    "total_cycles": 469379953098752,
    "mining_rewards_zkc": 289036.03
  }
]
```

Falls back to bundled `src/data/epochs.json` when the API is unavailable (e.g. local `npm run dev`).

## KV Setup

Create the KV namespaces once:

```bash
wrangler kv namespace create EPOCHS_CACHE
wrangler kv namespace create EPOCHS_CACHE --preview
```

Then set these GitHub Actions secrets:
- `CLOUDFLARE_KV_EPOCHS_CACHE_ID`
- `CLOUDFLARE_KV_EPOCHS_CACHE_PREVIEW_ID`

And update the placeholder IDs in `wrangler.toml`.

## Data

Epoch data is fetched live from `GET /api/epochs` (Pages Function).
Bundled fallback at `src/data/epochs.json` for local dev without wrangler.

POVW rate formula: `mean(mining_rewards_zkc / (total_cycles / 1e6))` over last N completed epochs.

## Deployment

Deployed to Cloudflare Pages on push to `main`. See `.github/workflows/deploy.yml`.

PR builds get preview deployments automatically.
