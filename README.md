# SOP-PT · Systems of Play Player Tracker

Soccer team management app for registering players, sideline session logging (swipe attendance + player-card scoring), metric labels, configurable scoring rankings, editable team profile, and durable storage (local-first JSON with JIT Cloud Run + Firestore sync).

**Product:** SOP-PT (Player Tracker) — a **Systems of Play** product (SOP = System of Play).

**Version:** 2.13.1

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy env template (optional for cloud):
   `cp .env.example .env.local`
3. Run the app:
   `npm run dev`

### Tasks

- **run web (local)** — Vite SPA (`scripts/run-web-local.sh`)
- **run api (local)** — Cloud Run API (`scripts/run-api-local.sh`)

### API

```bash
cd services/api && npm install && npm run dev
```

See [docs/](docs/README.md) for OKRs, architecture, and API contracts.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Typecheck with `tsc --noEmit` |
| `npm run test` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run clean` | Remove `dist` |
