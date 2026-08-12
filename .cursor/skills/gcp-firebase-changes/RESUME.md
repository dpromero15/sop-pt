# Resume: API Gateway front door (new chat)

Start prompt for next session:

> Gateway Phases A–E are in the `release/v2.9.0` tree (docs included). Read `WORKING.md`. Prefer shipping the v2.9.0 PR; do not run cloud mutations unless the human names a new phase.

## Process

- Skill: [SKILL.md](./SKILL.md)
- Rule: `../../rules/gcp-firebase-changes.mdc`
- One human-named phase per turn; ~10m cloud wait cap
- **Terminal gating:** propose command groups; wait for approve parts/all before running

## Done (do not redo)

- `sop-pt-2` Cloud Run `sop-pt-api` (us-west1); invoker `api-gateway@sop-pt-2.iam.gserviceaccount.com`
- OpenAPI + `scripts/deploy-api-gateway.sh` (gateway **us-central1**)
- Auth: `X-Apigateway-Api-Userinfo` in `services/api/src/auth.ts`
- API config `sop-pt-api-20260811213531` ACTIVE
- Gateway `sop-pt-gateway` **ACTIVE** — `https://sop-pt-gateway-bl0d02si.uc.gateway.dev`
- Phase C smoke: `/health` 200; `/v1/me` no token 401; raw Run 403
- Phase D: Hosting→Run rewrites removed; `VITE_API_BASE_URL` = gateway (`.env.firebase` + GitHub secret); Hosting redeployed; site 200; dist embeds gateway host

## Human QA (please)

- Sign in at https://sop-pt-2.web.app → enter a team → confirm header **Synced**

## Phase E — docs (done in tree)

- `docs/architecture/api.md` + overview: SPA → Gateway → Cloud Run
- WORKING.md Ready-to-ship includes Gateway A–E; human browser **Synced** check still requested
