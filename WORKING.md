# Working ledger — release v2.5.1

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.5.1` |
| **Branch** | `release/v2.5.1` |
| **Last updated** | 2026-08-09 (ship patch: bump ledger polish + coaches UX) |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### Patch — Adjusted bumps + Coaches Rank polish (post-#76)
- **Status:** implemented (shipping this PR)
- **Notes:** Coach-attributed bump transactions; my (green/red) vs others (slate/amber) avatar badges with hover transaction popout; list reorder uses effective adjusted score; per-player Clear; bump popout z-index above next row; Coaches Rank avg / individual coach; Statistical Rank label; related ranking/roster UX polish.
- **Touchpoints:** `adjustedBumps.ts`, RankingsView, CoachesRatingView, App, storage ledger, rankingsFilter, tests

**Suggested PR Closes:**
```
(none — polish follow-up to shipped #73 / #74; no new open issues)
```

---

## In progress

_None._

---

## Still open (not ready)

- **#75** — Auth & roles: Google login, coach identity, 4 access levels (**deferred** — do not implement on this patch line)
- **v2.6.0 backlog** — #77–#81 (wait until this patch ships, then bump to `2.6.0` / `release/v2.6.0`)

---

## Agent notes (do not lose)

- Do **not** `gh issue close` for finished work — close only via PR `Closes #N`.
- v2.5.0 shipped via [PR #76](https://github.com/dpromero15/sop-pt/pull/76) (closed #63, #65–#74).
- v2.4.0 shipped via [PR #64](https://github.com/dpromero15/sop-pt/pull/64) (closed #62).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- **#75 auth deferred** — Coaches Rating / bumps use local coach names until a later auth line.
- Do **not** open a PR until QA + explicit human approval (github-prs skill).
- **v2.6.0 backlog filed** (do not implement on this branch): #77 compliance/`blocksPlay`, #78 equipment inventory, #79 Adjusted eligible-only + Ineligible group, #80 cut lines 18/36, #81 specialty position re-rank.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
