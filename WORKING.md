# Working ledger — release v2.8.0

Cross-session handoff for agents and humans. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.8.0` |
| **Branch** | `release/v2.8.0` |
| **Last updated** | 2026-08-10 (landing, auth sim, data migrations tool + skill) |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### Google-only auth gate + SOP landing, team picker, profile menu + data migrations
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Landing for Systems of Play / SOP-PT; Google sign-in; post-login team picker; header ProfileMenu; local-only auth simulate; versioned `src/services/migrations` runner + Admin Data migrations panel + skill
- **Touchpoints:** `LandingPage.tsx`, `TeamPickerPage.tsx`, `ProfileMenu.tsx`, `AccessProvider.tsx`, `migrations/*`, `DataMigrationPanel.tsx`, `.cursor/skills/data-migrations/SKILL.md`

**Suggested PR Closes:**
```
(none — no GitHub issue yet)
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
- v2.7.0 shipped via [PR #91](https://github.com/dpromero15/sop-pt/pull/91). Hosting: https://sop-pt.web.app
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- Do **not** open a PR until QA + explicit human approval (github-prs skill).
- **Hosting CI:** set GitHub secrets `VITE_FIREBASE_*` (+ `VITE_INITIAL_ADMIN_EMAIL`) or production shows AuthConfigMissing.
- Firestore / Cloud Run rollout still pending.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
