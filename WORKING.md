# Working ledger — release v2.4.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.4.0` |
| **Branch** | `release/v2.4.0` |
| **Last updated** | 2026-08-07 |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### #62 — Overall Rank and Adjusted Rank (pool-first scoring)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Totals toggle → **Overall Rank** / **Adjusted Rank**. Standing scores from squad pool percentiles (not absolute min/max); competition pool places (1…N). Overall omits gaps; Adjusted treats gaps as 0. Primary UI shows `#place` (+ standing score secondary).
- **Touchpoints:** `types.ts`, `scoring.ts`, `rankingsFilter.ts`, `RankingsView.tsx`, `PlayersView.tsx`, `PlayerProfileModal.tsx`, `docs/sop/metrics.md`, tests

**Suggested PR Closes:**
```
Closes #62
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
- v2.3.0 shipped via [PR #61](https://github.com/dpromero15/sop-pt/pull/61) (closed #58, #60).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- **Standards / min-max age comparisons** deferred — not the engine for Overall/Adjusted ranks.
- Legacy rename: `weightedScore` / `weightedTotalScore` → `adjustedScore` / `adjustedTotalScore`; metric detail `normalizedScore` → `poolScore`.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
