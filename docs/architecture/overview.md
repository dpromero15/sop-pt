# Architecture overview

## What

Soccer Team Manager SPA (Vite + React) with optional Cloud Run API backed by Firestore. Local separated JSON blobs are the offline default.

## Why

v2 focuses on editable team identity and durable storage without requiring the frontend to talk to the database directly.

## How

```
SPA ──► StorageRepository
          ├─ LocalJsonAdapter (always available)
          └─ ApiAdapter (when healthy + signed-in admin)
                │
                ▼
           Cloud Run API ──► Firestore
                ▲
         Firebase Auth (ID token)
```

### Modes

| Mode | When |
|---|---|
| `cloud` | API `/health` OK, user signed in, not force-local |
| `local-fallback` | Otherwise |

### Packages

| Path | Role |
|---|---|
| `src/` | Vite React SPA |
| `services/api/` | Cloud Run TypeScript microservice |
| `docs/` | OKRs, ADRs, contracts |
