# Working ledger — release v2.7.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.7.0` |
| **Branch** | `release/v2.7.0` |
| **Last updated** | 2026-08-10 (Firebase Hosting init + deploy workflows) |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### #75 — Auth & roles: Google login, coach identity, 4 access levels
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Google sign-in; allowlist → System Admin; Viewer/DataEntry/TeamAdmin/SystemAdmin matrix; Admin tab for teams/members; actor identity for bumps/coaches
- **Touchpoints:** `firebase.ts`, `AccessProvider`, `SignInGate`, `AdminPageView`, API auth/me/teams, `roles.ts`, Navigation, App gates

### #84 — Google sign-in + user upsert; allowlist → System Admin
- **Status:** implemented
- **Touchpoints:** `firebase.ts`, API `upsertAppUser`, `.env.example`

### #85 — Role helpers, signed-in gate, header identity/role
- **Status:** implemented
- **Touchpoints:** `roles.ts`, `SignInGate`, `AccessProvider`, Navigation

### #86 — Firestore memberships + requireTeamRole + team list/create API
- **Status:** implemented
- **Touchpoints:** `services/api/src/auth.ts`, `routes/teams.ts`, `routes/me.ts`

### #87 — Admin page: manage teams and assign members by email+role
- **Status:** implemented
- **Touchpoints:** `AdminPageView.tsx`, Admin tab

### #88 — Enforce capability matrix across UI + API
- **Status:** implemented
- **Touchpoints:** App/Navigation/Players/Sessions/Rankings/Config gates; API role middleware

### #89 — Attribute bumps and Coaches Rating to signed-in Google identity
- **Status:** implemented
- **Touchpoints:** `coachIdentity.ts`, App bump coach linking

**Suggested PR Closes:**
```
Closes #75
Closes #84
Closes #85
Closes #86
Closes #87
Closes #88
Closes #89
```

---

## In progress

_None._

---

## Still open (not ready)

_None._

---

## Agent notes (do not lose)

- Do **not** `gh issue close` for finished work — close only via PR `Closes #N`.
- v2.6.0 shipped via [PR #83](https://github.com/dpromero15/sop-pt/pull/83).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- Do **not** open a PR until QA + explicit human approval (github-prs skill).
- Cloud access tightened: team routes require membership (or System Admin); set `ADMIN_EMAIL_ALLOWLIST` + `VITE_INITIAL_ADMIN_EMAIL` to your Google email; enable Google provider in Firebase Console.
- Firebase **Hosting** (not Storage) configured: `firebase.json` public=`dist`; deploy via `npm run deploy:hosting` or GitHub Actions on merge to `main`. Prod SPA env: `.env.firebase` (gitignored); CI needs `VITE_*` + `FIREBASE_SERVICE_ACCOUNT_SOP_PT` secrets. Cloud Run API still separate; Hosting-only is SPA shell until `VITE_API_BASE_URL` points at Cloud Run. Firestore rules deny all client access (Admin SDK only).

### Firestore production rollout (stepped — do not block Hosting PR)

App already falls back to localStorage when `VITE_API_BASE_URL` is empty/unhealthy — Hosting-first will not blow up.

1. **Ship Hosting PR** — merge `release/v2.7.0` → `main`; SPA live; mode = local-fallback; Google Auth works if Firebase web config baked in.
2. **Enable Blaze** (if not already) — required for Cloud Run; Firestore free quota still applies.
3. **Deploy API to Cloud Run** — `gcloud run deploy sop-pt-api --source services/api --region us-central1` (or us-west1 to match Firestore) with env: `GOOGLE_CLOUD_PROJECT=sop-pt`, `ADMIN_EMAIL_ALLOWLIST=…`, `CORS_ORIGIN=https://sop-pt.web.app,https://sop-pt.firebaseapp.com`. Rely on default SA (no JSON key). Confirm `GET /health` and signed-in `GET /v1/status` → `firestoreReachable: true`.
4. **Wire SPA to API** — set `VITE_API_BASE_URL` in `.env.firebase` + GitHub secrets; `npm run deploy:hosting` (or merge a tiny follow-up). Add Hosting domain to Firebase Auth authorized domains.
5. **Verify cloud mode** — sign in as allowlisted admin; connection status = cloud; create team / bootstrap from local if needed; confirm data in Firestore console.
6. **Optional later** — Hosting rewrite `/api/**` → Cloud Run; CI job for API deploy; budget alerts.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
