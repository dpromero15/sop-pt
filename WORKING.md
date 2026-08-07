# Working ledger — release v2.5.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.5.0` |
| **Branch** | `release/v2.5.0` |
| **Last updated** | 2026-08-07 (Ready: #63, #65–#74; #75 deferred) |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### #63 — Post-score dense editor + metric adjusted-total exemptions + locked attendance formula
- **Status:** implemented (verify acceptance before PR)
- **Notes:** DenseScoreEditor when session has scores; `includeInAdjustedTotal` / `treatNoScoreAsZero`; Attendance formula weight locked; typed count input.
- **Touchpoints:** `DenseScoreEditor.tsx`, `QuickInsertView.tsx`, `scoring.ts`, `ConfigView.tsx`, SOP docs

### #65 — Rank screen: Rank by chips should wrap by screen size
- **Status:** implemented
- **Notes:** Rank-by chips use `flex-wrap`.
- **Touchpoints:** `RankingsView.tsx`

### #66 — Skill polygon radar: default unscored categories to hidden 20
- **Status:** implemented
- **Notes:** Unscored axes plot at 20; Category Breakdown still shows — / null.
- **Touchpoints:** `PlayerProfileModal.tsx`

### #67 — Category labels: edit/remove UI; Attendance system label view-only
- **Status:** implemented
- **Notes:** System flag on Attendance; edit/remove for custom; delete blocked if metrics reference label.
- **Touchpoints:** `ConfigView.tsx`, `types.ts`, storage label APIs

### #68 — Category labels should drive Category Label Weightings
- **Status:** implemented
- **Notes:** weightsMap syncs with labels; Attendance weight row read-only.
- **Touchpoints:** `ConfigView.tsx`, `addLabel` / `deleteLabel`

### #69 — Player roster: export CSV template and import players from CSV
- **Status:** implemented
- **Notes:** Template download + add-only import; duplicate jersey skipped with errors.
- **Touchpoints:** `playerCsv.ts`, `PlayersView.tsx`

### #70 — Config/roster: Clear all keeps only system-required items
- **Status:** implemented
- **Notes:** Clear labels → Attendance only; metrics → `m_attendance` (+ scrub sessions/calcs); roster clear-all.
- **Touchpoints:** storage clear helpers, ConfigView, PlayersView

### #71 — Session types: drop Fitness Testing — only Sessions and Matches
- **Status:** implemented
- **Notes:** `SessionType` is `session | match`; legacy `practice` / `fitness_test` → `session`.
- **Touchpoints:** `types.ts`, `sessionMetrics.ts`, Sessions/QI UI, adapter

### #72 — Quick Insert: delete incomplete (open) sessions next to Play
- **Status:** implemented
- **Notes:** Delete + confirm beside Continue; cascades entries.
- **Touchpoints:** `QuickInsertView.tsx`

### #73 — Coaches Rating: per-coach ordinal ranks + Coaches Totals
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Per-coach unique 1…N ballots; Coaches Totals from complete ballots (sum → competition rank, lower better). Local coach names (no auth).
- **Touchpoints:** `CoachesRatingView.tsx`, `coachesRating.ts`, Rankings `coaches` mode, storage

### #74 — Adjusted ranks: coach +1/−1 bumps with configurable budget and +x badge
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Team plus/minus budget; ±1 on Adjusted only; score offset + badge; Overall/Coaches untouched.
- **Touchpoints:** `adjustedBumps.ts`, RankingsView, Config budget, storage

**Suggested PR Closes:**
```
Closes #63
Closes #65
Closes #66
Closes #67
Closes #68
Closes #69
Closes #70
Closes #71
Closes #72
Closes #73
Closes #74
```

---

## In progress

_None._

---

## Still open (not ready)

- **#75** — Auth & roles: Google login, coach identity, 4 access levels (**deferred** this line — do not implement)

---

## Agent notes (do not lose)

- Do **not** `gh issue close` for finished work — close only via PR `Closes #N`.
- v2.4.0 shipped via [PR #64](https://github.com/dpromero15/sop-pt/pull/64) (closed #62).
- v2.3.0 shipped via [PR #61](https://github.com/dpromero15/sop-pt/pull/61) (closed #58, #60).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- **#75 auth deferred** on v2.5.0 — Coaches Rating uses local coach names only until a later auth line.
- **Standards / min-max age comparisons** deferred — not the engine for Overall/Adjusted ranks.
- Legacy rename (2.4.0): `weightedScore` / `weightedTotalScore` → `adjustedScore` / `adjustedTotalScore`; metric detail `normalizedScore` → `poolScore`.
- Do **not** open a PR until QA + explicit human approval (github-prs skill).

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
