# Resume: API Gateway front door (new chat)

Start prompt for next session:

> Gateway + CORS are live on `release/v2.9.0` (PR #96, issues #97/#98). Read `WORKING.md`. Prefer human **Synced**/admin confirmation and merge; do not run cloud mutations unless the human names a new phase.

## Process

- Skill: [SKILL.md](./SKILL.md)
- Rule: `../../rules/gcp-firebase-changes.mdc`
- One human-named phase per turn; ~10m cloud wait cap
- **Terminal gating:** propose command groups; wait for approve parts/all before running

## Done (do not redo)

- Cloud Run `sop-pt-api` (us-west1); invoker `api-gateway@…`; ADMIN_EMAIL_ALLOWLIST includes `dromero@sop-network.com`
- Gateway ACTIVE `https://sop-pt-gateway-bl0d02si.uc.gateway.dev`
- Hosting: no Run rewrites; `VITE_API_BASE_URL` = gateway
- **CORS fix:** config `sop-pt-api-20260811220730` — OPTIONS `/v1/me` → 204 + ACAO for `https://sop-pt-2.web.app`
- Phase E docs in tree: SPA → Gateway → Cloud Run (`docs/architecture/api.md` + overview)

## Human QA (please)

- Hard-refresh https://sop-pt-2.web.app → sign in as admin → create/enter team → **Synced**

## Tracking

- Closes via PR #96: #97 (JIT sync), #98 (Gateway)
- Deferred: #99 System Admin hub + shadow mode (`v2.10.0`)
