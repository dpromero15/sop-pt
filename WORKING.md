# Working ledger — release v2.9.0

| Field | Value |
|---|---|
| **Release** | `2.9.0` |
| **Branch** | `release/v2.9.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### #101 — Fix cleared roster resurrecting after Synced hydrate
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `applySnapshot` persists empty arrays. Hydrate overlays all dirty buckets, writes empty squad before releasing holdSeeds, and flushes pending outbox immediately. Clear-all players triggers `flushNow` / empty-squad priority flush. Ignore storage events while flushing so mid-flush reads cannot re-dirty.
- **Touchpoints:** `localJsonAdapter.ts`, `cloudSync.ts`, `PlayersView.tsx`, tests

### #100 — Use Cucurella cat meme as default player avatars
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Seed + missing-avatar defaults use a pool of 8 black-outline soccer-cat SVGs (incl. Cucurella silhouette) via `defaultAvatarFor(seed)`. Rankings empty state still uses the photo meme `/cucurella-cat.jpg`.
- **Touchpoints:** `src/constants/avatars.ts`, `public/avatars/*.svg`, `initialData.ts`, `PlayersView.tsx`, `PlayerProfileModal.tsx`, `RankingsView.tsx`, `CoachesRatingView.tsx`

### #97 — JIT per-team cloud sync (offline-first hydrate + flush)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Per-team local cache (migration 004). Hydrate on team enter. Dirty outbox + 10s debounce / online / tab-hide flush via Cloud Run. First enter pushes a local roster if cloud is empty. Sync chip in the header. SPA still never talks to Firestore.
- **Touchpoints:** `localJsonAdapter.ts`, `cloudSync.ts`, `apiAdapter.ts`, `AccessProvider.tsx`, `SyncStatusChip.tsx`, `services/api`, `docs/architecture/storage.md`

### #98 — API Gateway front door for private Cloud Run
- **Status:** implemented (verify acceptance before PR) — **CORS fix live**; confirm admin picker / **Synced** in browser
- **Notes:** Gateway ACTIVE `https://sop-pt-gateway-bl0d02si.uc.gateway.dev` (config `sop-pt-api-20260811220730`). Hosting→Run rewrites removed; `VITE_API_BASE_URL` → gateway; Run private (invoker SA). Cross-origin OPTIONS was **405** (empty admin picker); fixed with OpenAPI `allowCors` + unauthenticated `OPTIONS` (smoke OPTIONS **204** + ACAO). Auth: Gateway userinfo + Bearer.
- **Touchpoints:** `services/api`, `openapi-gateway.yaml`, `scripts/deploy-api*.sh`, `firebase.json`, Hosting workflows, `docs/architecture/api.md`, `docs/architecture/overview.md`, `.cursor/skills/gcp-firebase-changes/`

**Suggested PR Closes:**
```
Closes #101
Closes #100
Closes #97
Closes #98
```

## Still open (later release)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Label:** `v2.10.0` (do not start until v2.9.0 ships)

## Agent notes

- `2.8.3` shipped via PR #95. **v2.9.0** core sync/gateway shipped via [#96](https://github.com/dpromero15/sop-pt/pull/96) (issues #97/#98 filed after merge — close via follow-up PR). Follow-up Ready-to-ship: #100 avatars, #101 clear/hydrate fix.
- **Issue capture rule:** every Ready-to-ship / In progress / Still open row must have a GitHub issue + version label before the work is considered tracked (see working-files skill).
- GCP/Firebase project is **`sop-pt-2`** (org `sop-network.com` / `682388225675`); operate as `dromero@sop-network.com`. Old project `sop-pt` is left up for rollback only.
- Org policy blocks SA JSON keys and Cloud Run `allUsers`. CI uses Workload Identity Federation. Prefer API Gateway + Firebase JWT; do not use `--no-invoker-iam-check` / `allUsers`.
- Cloud Run `sop-pt-api` (us-west1): invoker IAM on; invoker SA `api-gateway@sop-pt-2.iam.gserviceaccount.com`; max instances 3. Raw `*.run.app` must stay private to IAM.
- API Gateway `sop-pt-gateway` (us-central1): **ACTIVE**; host `https://sop-pt-gateway-bl0d02si.uc.gateway.dev`; config `sop-pt-api-20260811220730` (CORS OPTIONS). SPA `VITE_API_BASE_URL` = gateway; no Hosting→Run rewrites. Please hard-refresh and confirm admin/**Synced**.
- Follow [gcp-firebase-changes skill](.cursor/skills/gcp-firebase-changes/SKILL.md) — one phase per human approval; terminal/cloud commands only after explicit step approval.
- Terminal gating: propose command groups; wait for human approve parts/all before running.
- After import on web: wait for **Synced**, then open the same Google account on mobile and pick the same team.
- Pre-PR QA (2026-08-12): `npm run lint` + `npm test` — 129 tests passed.
