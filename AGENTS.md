# Boundless Profit Explorer

A profitability calculator for Boundless ZK prover operators. Helps operators evaluate GPU configurations and understand break-even points across different ZKC price scenarios.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Charts**: Recharts
- **Icons**: lucide-react
- **Deploy**: Cloudflare Pages

## Features

- **Profit Explorer** — Horizontal bar charts showing profit per epoch at a selected ZKC price
- **Break-even** — Minimum ZKC price required to break even per GPU configuration
- **Scenarios** — Line charts showing profit vs ZKC price curves for each GPU config
- Editable GPU configuration table (inline add/delete/edit)
- POVW rate auto-computed from bundled epoch data (last N epochs, configurable)
- All calculations match the Boundless notebook model

## Dev Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check + production build
npm run build

# Preview production build
npm run preview
```

## Data

Epoch data is bundled at `src/data/epochs.json` (converted from CSV via `convert_epochs.py`).

POVW rate formula: `mean(mining_rewards_zkc / (total_cycles / 1e6))` over last N completed epochs.

## Deployment

Deployed to Cloudflare Pages on push to `main`. See `.github/workflows/deploy.yml`.
