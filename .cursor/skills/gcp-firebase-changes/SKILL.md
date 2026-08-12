---
name: gcp-firebase-changes
description: >-
  Gated, low-risk process for GCP and Firebase production changes in SOP-PT
  (Cloud Run, API Gateway, Hosting, IAM, Firestore, secrets, gcloud, firebase
  deploy). Use when enabling APIs, changing IAM/ingress, deploying API/Hosting,
  rotating secrets, cutting over Firebase projects, or any live cloud mutation.
  Prefer code + tests first; one cloud mutation per human-approved phase.
---

# GCP / Firebase changes (gated)

Live cloud is **not** a debug loop. Prefer repo changes + tests; mutate
`sop-pt-2` only in **named phases** the human approves.

Read [`WORKING.md`](../../../WORKING.md) Agent notes before any cloud step.

## Hard rules

1. **No chain deploys** — do not enable APIs + IAM + Cloud Run + Gateway + Hosting in one turn.
2. **One cloud mutation per phase** — then stop, smoke, wait for human “Phase N+1”.
3. **Timeout budget** — if a cloud op exceeds **~10 minutes** without a clear terminal state, stop waiting; report status; do not start unrelated mutations.
4. **Never** without explicit human ask: `--no-invoker-iam-check`, `allUsers` / `allAuthenticatedUsers` as `run.invoker`, disabling auth, or opening Firestore client rules.
5. **Code before cloud** — OpenAPI, scripts, Express auth, unit tests land and pass **before** deploying them.
6. **Secrets** — do not print API keys, SA JSON, or ID tokens in chat; set secrets via stdin/`gh secret set` without echoing values.
7. **WORKING.md** — after each phase, update Agent notes (what changed, URLs, blockers).

## Phase model (required)

Copy and fill; do not skip ahead.

```
Phase gate:
- [ ] 0 Design — plan + file list; no cloud writes
- [ ] 1 Repo — code/scripts/docs; npm test / lint as applicable
- [ ] 2 Human — user names the next phase to run (e.g. “Phase 3: deploy API”)
- [ ] 3 One cloud write — single script or single gcloud/firebase concern
- [ ] 4 Smoke — fixed checklist; record pass/fail
- [ ] 5 Stop — ask before Phase N+1
```

If the user says “implement the plan” for a large infra plan, **still** execute only Phase 0→1, then ask which cloud phase to run — unless they explicitly name a cloud phase.

## Default order for API front door (this repo)

| Phase | Work | Smoke |
|---|---|---|
| A | Repo: OpenAPI, `deploy-api*.sh`, auth gateway userinfo, docs | `npm test`, lint |
| B | Cloud Run deploy only (`./scripts/deploy-api.sh`) | Direct `*.run.app` still IAM-denied without token |
| C | API Gateway create/update only (`./scripts/deploy-api-gateway.sh`) | `GET {gw}/health` 200; `GET {gw}/v1/me` no token → 401 |
| D | Secrets + Hosting (`VITE_API_BASE_URL` = gateway; no Hosting→Run rewrites) | Site loads; signed-in hydrate/Synced |
| E | WORKING.md + architecture docs sync | Human review |

Gateway region for this project: **`us-central1`** (not us-west1). Cloud Run stays **us-west1**.

## Security baselines (sop-pt-2)

- Cloud Run: invoker IAM **on**; invoker = API Gateway SA only (`api-gateway@sop-pt-2.iam.gserviceaccount.com`) when gateway is the front door
- No Hosting rewrites to Cloud Run for `/v1` (Hosting cannot mint Run IAM)
- SPA `VITE_API_BASE_URL` = **gateway** hostname, never raw `*.run.app`
- App `requireAuth` remains defense in depth (Bearer local; `X-Apigateway-Api-Userinfo` behind gateway)
- CI: Workload Identity Federation (org blocks SA JSON keys)

## Allowed without a new phase

- Read-only: `gcloud … describe/list`, `firebase use`, `curl` smoke, `gh secret list` (names only)
- Local: `npm run dev`, `npm test`, `npm run lint`

## Handoff

End of chat / phase: update `WORKING.md` Agent notes with project, gateway state, last smoke, and **next approved phase**. Next session starts at that phase — no re-doing prior mutations “to be sure” unless human asks.
