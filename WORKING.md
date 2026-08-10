# Working ledger — release v2.8.1

| Field | Value |
|---|---|
| **Release** | `2.8.1` |
| **Branch** | `release/v2.8.1` |
| **Last updated** | 2026-08-10 (local debug mock + metrics repair) |

## Ready to ship

### Hosting build fails closed without Firebase web config
- **Status:** implemented (already on branch / prior commit)
- **Notes:** `scripts/check-hosting-env.mjs`; CI verify step; clearer AuthConfigMissing. **Still need GitHub Actions secrets** or the next merge deploy will fail the check until secrets are set.
- **Touchpoints:** `scripts/check-hosting-env.mjs`, hosting workflows, `LandingPage.tsx`, `package.json`

### Repair corrupt metrics localStorage (metrics.map crash)
- **Status:** implemented
- **Notes:** Migration 001 wrote `{ metrics, changed }` into `stm_metrics_v1` instead of an array. Fixed 001; schema v3 repair; hardened `migrateMetricsAggregation` / `getMetrics`.
- **Touchpoints:** `001_consolidate_legacy_shapes.ts`, `003_repair_metrics_blob.ts`, `metricAggregation.ts`, `localJsonAdapter.ts`

### Local debug mock auth (simulate Google without Firebase/API)
- **Status:** implemented
- **Notes:** With `VITE_DEV_SIMULATE_AUTH`, skip Firebase Auth init (no https↔http iframe noise); grant System Admin + mock U13/U15 teams without `/v1/me`. Production Google path unchanged when flag is off.
- **Touchpoints:** `firebase.ts`, `AccessProvider.tsx`, `LandingPage.tsx`, `App.tsx`

**Suggested PR Closes:**
```
(none)
```

## Agent notes

- Production blank was **Auth not configured** (CI built without `VITE_FIREBASE_*` secrets). Fixed via `npm run deploy:hosting` using `.env.firebase`.
- Set repo secrets: `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`, `VITE_INITIAL_ADMIN_EMAIL` (optional `VITE_API_BASE_URL`).
- QA 2026-08-10: `npm run lint` + `npm test` (127) passed before PR.
