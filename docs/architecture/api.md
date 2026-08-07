# API contract

## What

Cloud Run HTTP API for team data. Frontend never accesses Firestore directly.

## Why

Keeps credentials server-side and centralizes authz (admin allowlist / claim).

## Base URL

Configured via `VITE_API_BASE_URL` (SPA) and deployed Cloud Run URL.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | Liveness |
| `GET` | `/v1/status` | admin | Auth + Firestore ping |
| `GET` | `/v1/teams/:teamId` | admin | Get team profile |
| `PUT` | `/v1/teams/:teamId` | admin | Upsert team profile |
| `GET` | `/v1/teams/:teamId/players` | admin | List players |
| `PUT` | `/v1/teams/:teamId/players` | admin | Replace players collection |
| `GET` | `/v1/teams/:teamId/sessions` | admin | List sessions |
| `PUT` | `/v1/teams/:teamId/sessions` | admin | Replace sessions |
| `GET` | `/v1/teams/:teamId/entries` | admin | List entries |
| `PUT` | `/v1/teams/:teamId/entries` | admin | Replace entries |
| `GET` | `/v1/teams/:teamId/config/:name` | admin | `metrics` \| `labels` \| `formula` |
| `PUT` | `/v1/teams/:teamId/config/:name` | admin | Upsert config blob |
| `POST` | `/v1/teams/:teamId/bootstrap` | admin | Upload full local snapshot |

### Auth

`Authorization: Bearer <Firebase ID token>`

Admin if token has `admin: true` custom claim **or** email is in `ADMIN_EMAIL_ALLOWLIST` (comma-separated).

### Deploy

```bash
cd services/api
npm install
npm run build
# gcloud run deploy sop-pt-api --source . --region us-central1
```

Local:

```bash
./scripts/run-api-local.sh
```
