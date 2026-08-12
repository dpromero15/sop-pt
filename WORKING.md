# Working ledger — release v2.9.0

| Field | Value |
|---|---|
| **Release** | `2.9.0` |
| **Branch** | `release/v2.9.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### Firestore JIT sync (login anywhere, offline-first)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Per-team local cache (migration 004). Hydrate on team enter. Dirty outbox + 10s debounce / online / tab-hide flush via Cloud Run. First enter pushes a local roster if cloud is empty. Sync chip in the header. SPA still never talks to Firestore.
- **Touchpoints:** `localJsonAdapter.ts`, `cloudSync.ts`, `apiAdapter.ts`, `AccessProvider.tsx`, `SyncStatusChip.tsx`, `services/api`, `docs/architecture/storage.md`

### API Gateway front door (Phases A–E)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Gateway ACTIVE `https://sop-pt-gateway-bl0d02si.uc.gateway.dev`; Hosting→Run rewrites removed; `VITE_API_BASE_URL` → gateway; Cloud Run private (invoker SA). Auth via Gateway `X-Apigateway-Api-Userinfo` + Bearer. Docs: SPA → Gateway → Run. Human should confirm header **Synced** while signed in.
- **Touchpoints:** `services/api`, `openapi-gateway.yaml`, `scripts/deploy-api*.sh`, `firebase.json`, Hosting workflows, `docs/architecture/api.md`, `docs/architecture/overview.md`, `.cursor/skills/gcp-firebase-changes/`

**Suggested PR Closes:**
```
(none — no GitHub issues filed for this line; add Closes if you want any linked)
```

## Still open (later release)

### System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.

## Agent notes

- `2.8.3` shipped via PR #95.
- GCP/Firebase project is **`sop-pt-2`** (org `sop-network.com` / `682388225675`); operate as `dromero@sop-network.com`. Old project `sop-pt` is left up for rollback only.
- Org policy blocks SA JSON keys and Cloud Run `allUsers`. CI uses Workload Identity Federation. Prefer API Gateway + Firebase JWT; do not use `--no-invoker-iam-check` / `allUsers`.
- Cloud Run `sop-pt-api` (us-west1): invoker IAM on; invoker SA `api-gateway@sop-pt-2.iam.gserviceaccount.com`; max instances 3. Raw `*.run.app` must stay private to IAM.
- API Gateway `sop-pt-gateway` (us-central1): **ACTIVE**; hostname `https://sop-pt-gateway-bl0d02si.uc.gateway.dev`. Phases A–E done in tree (docs included). SPA `VITE_API_BASE_URL` = gateway; no Hosting→Run rewrites.
- Follow [gcp-firebase-changes skill](.cursor/skills/gcp-firebase-changes/SKILL.md) — one phase per human approval; terminal/cloud commands only after explicit step approval.
- Terminal gating: propose command groups; wait for human approve parts/all before running.
- After import on web: wait for **Synced**, then open the same Google account on mobile and pick the same team.
- Pre-PR QA (2026-08-12): `npm run lint` + `npm test` — 129 tests passed.
