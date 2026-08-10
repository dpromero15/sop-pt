# Working ledger — release v2.8.1

| Field | Value |
|---|---|
| **Release** | `2.8.1` |
| **Branch** | `release/v2.8.1` |
| **Last updated** | 2026-08-10 (Hosting env guard; prod redeploy with Firebase config) |

## Ready to ship

### Hosting build fails closed without Firebase web config
- **Status:** implemented
- **Notes:** `scripts/check-hosting-env.mjs`; CI verify step; clearer AuthConfigMissing. Live site redeployed locally with `.env.firebase` so Google sign-in works. **Still need GitHub Actions secrets** or the next merge deploy will fail the check (good) until secrets are set.
- **Touchpoints:** `scripts/check-hosting-env.mjs`, hosting workflows, `LandingPage.tsx`, `package.json`

**Suggested PR Closes:**
```
(none)
```

## Agent notes

- Production blank was **Auth not configured** (CI built without `VITE_FIREBASE_*` secrets). Fixed via `npm run deploy:hosting` using `.env.firebase`.
- Set repo secrets: `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`, `VITE_INITIAL_ADMIN_EMAIL` (optional `VITE_API_BASE_URL`).
