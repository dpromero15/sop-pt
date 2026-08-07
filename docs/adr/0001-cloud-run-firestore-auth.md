# ADR 0001 — Cloud Run + Firestore + Firebase Auth

## Status

Accepted for v2.0.0

## Context

v1 stores all data in `localStorage` with no team entity and no durable backend. v2 needs editable team details and cheap/free GCP storage. Options considered:

1. Firebase client SDK talking to Firestore directly
2. Cloud Run API + Firestore (frontend never hits DB)
3. Cloud Run + Cloud Storage JSON files

## Decision

Use **Cloud Run API + Cloud Firestore + Firebase Auth**:

- Frontend calls the API with a Firebase ID token
- API verifies tokens with Firebase Admin SDK and reads/writes Firestore
- Admin allowlist or `admin` custom claim gates mutations
- When API/auth is unavailable, the SPA falls back to separated local JSON blobs

## Consequences

### Positive

- Secrets and Firestore credentials stay off the client
- Fits GCP Always Free (Cloud Run 2M req/mo, Firestore 1 GiB)
- Clear path to harden auth and multi-team later

### Negative

- Requires deploying/running an API (local + Cloud Run)
- Blaze billing account may be needed for some Firebase features even when usage stays free
- Extra latency vs direct client SDK

### Rejected alternatives

- **Direct Firestore from client:** simpler, but exposes data access rules and complicates admin tooling
- **GCS JSON files as primary store:** matches “JSON blobs” literally but weaker concurrency/querying; Firestore docs still act as separated JSON blobs
