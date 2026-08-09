# Working ledger — release v2.6.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.6.0` |
| **Branch** | `release/v2.6.0` |
| **Last updated** | 2026-08-09 (implemented #77–#81) |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### #77 — Compliance requirements: paperwork/fees/eligibility with blocksPlay
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Config CRUD; per-player checklist in edit modal; roster Ineligible badge; `eligibility.ts` util; storage + snapshot.
- **Touchpoints:** `ComplianceConfigPanel.tsx`, `PlayersView.tsx`, `eligibility.ts`, storage, `types.ts`

### #78 — Equipment inventory: groups, assignable items, return to stock
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Groups + items; assign/return; delete group cascades items; player delete frees assignments.
- **Touchpoints:** `EquipmentConfigPanel.tsx`, storage

### #79 — Adjusted ranks: eligible-only + Ineligible bottom group
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `applyEligibilityToAdjustedRanks` after bumps; Ineligible divider; Statistical unchanged.
- **Touchpoints:** `App.tsx`, `eligibility.ts`, `RankingsView.tsx`, `rankingsFilter.ts`

### #80 — Rankings: configurable cut lines (default 18 / 36)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Config panel; violet Cut @ N dividers on Adjusted total sort.
- **Touchpoints:** `RankingBoundariesPanel.tsx`, `RankingsView.tsx`, storage

### #81 — Specialty rankings: re-rank within position pool (GK cut 4)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Specialty chips; `specialtyAdjustedRankings`; GK specialty cut default 4.
- **Touchpoints:** `RankingsView.tsx`, `eligibility.ts`

**Suggested PR Closes:**
```
Closes #77
Closes #78
Closes #79
Closes #80
Closes #81
```

---

## In progress

_None._

---

## Still open (not ready)

- **#75** — Auth & roles (**deferred** — do not implement this line)

---

## Agent notes (do not lose)

- Do **not** `gh issue close` for finished work — close only via PR `Closes #N`.
- v2.5.1 shipped via [PR #82](https://github.com/dpromero15/sop-pt/pull/82).
- v2.5.0 shipped via [PR #76](https://github.com/dpromero15/sop-pt/pull/76).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- **#75 auth deferred** — Coaches Rating / bumps use local coach names until a later auth line.
- Do **not** open a PR until QA + explicit human approval (github-prs skill).
- Existing localStorage without compliance keys seeds default requirements; sample roster compliance completes blocking paperwork so Adjusted still ranks until coaches edit.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
