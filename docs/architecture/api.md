# API contract

## What

Cloud Run HTTP API for team data. Frontend never accesses Firestore directly.

## Why

Keeps credentials server-side and centralizes authz (allowlist System Admin + per-team membership).

## Base URL

Configured via `VITE_API_BASE_URL` (SPA). Production path:

```
SPA ──► API Gateway (sop-pt-gateway) ──► Cloud Run (sop-pt-api) ──► Firestore
```

| Layer | Value |
|---|---|
| Hosting | `https://sop-pt-2.web.app` (static SPA only; no API rewrites) |
| Gateway | `https://sop-pt-gateway-bl0d02si.uc.gateway.dev` (set as `VITE_API_BASE_URL`) |
| Cloud Run | `sop-pt-api` in `us-west1` — private; invoker SA `api-gateway@sop-pt-2.iam.gserviceaccount.com` |

Cloud Run is **not** public: invoker IAM **on**, no `allUsers`, no `--no-invoker-iam-check`. Raw `*.run.app` returns 403 without IAM. Gateway validates the Firebase JWT and forwards identity via `X-Apigateway-Api-Userinfo`; the API also accepts `Authorization: Bearer` for local/dev.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | Liveness |
| `GET` | `/v1/me` | signed-in | User + teams + membership |
| `GET` | `/v1/status` | systemAdmin | Auth + Firestore ping |
| `GET` | `/v1/teams` | signed-in | Teams the user can see |
| `POST` | `/v1/teams` | systemAdmin | Create team |
| `GET` | `/v1/teams/:teamId` | viewer+ | Get team profile |
| `PUT` | `/v1/teams/:teamId` | teamAdmin+ | Upsert team profile |
| `GET/PUT` | `/v1/teams/:teamId/members` | teamAdmin+ | Membership |
| `GET` | `/v1/teams/:teamId/players` | viewer+ | List players |
| `PUT` | `/v1/teams/:teamId/players` | dataEntry+ | Replace players |
| `GET/PUT` | `/v1/teams/:teamId/sessions` | viewer / dataEntry+ | Sessions |
| `GET/PUT` | `/v1/teams/:teamId/entries` | viewer / dataEntry+ | Metric entries |
| `GET/PUT` | `/v1/teams/:teamId/config/:name` | viewer / teamAdmin or dataEntry | Config blobs |
| `GET` | `/v1/teams/:teamId/snapshot` | viewer+ | Full team snapshot (hydrate) |
| `POST` | `/v1/teams/:teamId/bootstrap` | teamAdmin+ | Upload full local snapshot |

Config `:name` includes `metrics`, `labels`, `formula`, `calculatedFields`, `coaches`, `coachBallots`, `bumpTransactions`, `bumpBudget`, `complianceRequirements`, `playerCompliance`, `equipmentGroups`, `equipmentItems`, `rankingBoundaries`.

### Auth

`Authorization: Bearer <Firebase ID token>`

System Admin if email is in `ADMIN_EMAIL_ALLOWLIST`. Otherwise membership on `teams/{id}/members`.

### Deploy

```bash
./scripts/deploy-api.sh          # Cloud Run
./scripts/deploy-api-gateway.sh  # API Gateway config (OpenAPI)
# Keep GitHub Actions secret VITE_API_BASE_URL = gateway hostname
# Merge to main so Hosting rebuilds with that URL baked in
```

Local:

```bash
./scripts/run-api-local.sh
```
