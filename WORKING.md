# Working ledger — release v2.8.1

| Field | Value |
|---|---|
| **Release** | `2.8.1` |
| **Branch** | `release/v2.8.1` |
| **Last updated** | 2026-08-10 (admin entry + local squad picker) |

## Ready to ship

### Hosting build fails closed without Firebase web config
- **Status:** implemented (already on branch / prior commit)
- **Notes:** `scripts/check-hosting-env.mjs`; CI verify step; clearer AuthConfigMissing. GitHub `VITE_FIREBASE_*` secrets set 2026-08-10.
- **Touchpoints:** `scripts/check-hosting-env.mjs`, hosting workflows, `LandingPage.tsx`, `package.json`

### Repair corrupt metrics localStorage (metrics.map crash)
- **Status:** implemented
- **Notes:** Migration 001 wrote `{ metrics, changed }` into `stm_metrics_v1` instead of an array. Fixed 001; schema v3 repair; hardened `migrateMetricsAggregation` / `getMetrics`.
- **Touchpoints:** `001_consolidate_legacy_shapes.ts`, `003_repair_metrics_blob.ts`, `metricAggregation.ts`, `localJsonAdapter.ts`

### Local debug mock auth (simulate Google without Firebase/API)
- **Status:** implemented
- **Notes:** With `VITE_DEV_SIMULATE_AUTH`, skip Firebase Auth init; grant System Admin + mock U13/U15 teams without `/v1/me`.
- **Touchpoints:** `firebase.ts`, `AccessProvider.tsx`, `LandingPage.tsx`, `App.tsx`

### Fix System Admin empty-teams / Admin entry freeze
- **Status:** implemented
- **Notes:** Opening Admin with `teamId=null` no longer dead-ends on “No team access”. No-API System Admin sees the browser-local squad on the picker + create/rename. Admin entry prefers that squad id.
- **Touchpoints:** `App.tsx`, `AccessProvider.tsx`, `TeamPickerPage.tsx`

**Suggested PR Closes:**
```
(none)
```

## Still open (later release — do not mix into 2.8.1 unless patch-sized)

### System Admin team hub + shadow mode (attribution-first)
- **Status:** deferred (likely next MINOR after Cloud Run multi-team API)
- **Product rules:**
  - Admin lands on a screen of **all teams**, then enters a team.
  - Entering another team is **shadow mode**: admin never “becomes” another user.
  - Admins may make changes, but **every action is 100% tracked** to the signed-in admin identity (audit who did what).
  - No impersonation of coaches/members.

## Agent notes

- Production Google Auth works after enabling Authentication + Google provider in Firebase Console.
- Cloud Run API still not deployed — Hosting is local-fallback for team data until `VITE_API_BASE_URL` is set.
- QA 2026-08-10: `npm run lint` + `npm test` (127) passed before earlier PR push; re-run before next push.
