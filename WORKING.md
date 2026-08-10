# Working ledger — release v2.7.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.7.0` |
| **Branch** | `release/v2.7.0` |
| **Last updated** | 2026-08-09 (implemented #75 / #84–#89) |

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

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
