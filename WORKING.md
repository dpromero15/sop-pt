# Working ledger — release v2.3.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.3.0` |
| **Branch** | `release/v2.3.0` |
| **Last updated** | 2026-08-07 |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### #58 — Metrics: edit definitions, aggregation mode, rankings raw value + optional calculated fields
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Edit metrics in Config; aggregation `sum`/`best`/`latest`; rankings show aggregated raw values; calculated fields catalog (avg / percentile / per-match) toggleable.
- **Touchpoints:** `types.ts`, `metricAggregation.ts`, `calculatedFields.ts`, `scoring.ts`, `ConfigView.tsx`, `RankingsView.tsx`, `rankingsFilter.ts`, storage, `docs/sop/metrics.md`

### Rankings — unscored / zero sort as worst
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Missing values always sort after any recorded score (including 0), including lower-is-better metrics. Leaderboard shows an **Unscored** divider + label for never-scored players at the bottom.
- **Touchpoints:** `rankingsFilter.ts`, `RankingsView.tsx`, `scoring.ts`, tests

### Rankings — Total Overall vs Weighted Total
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Global **Totals** toggle only (not in Rank by). Overall omits unscored/excused; Weighted treats them as 0. Rank by = metrics/calculated fields; default ranks by formula/category score under the active Totals mode.
- **Touchpoints:** `types.ts`, `scoring.ts`, `rankingsFilter.ts`, `RankingsView.tsx`, `PlayersView.tsx`, `PlayerProfileModal.tsx`, `docs/sop/metrics.md`

### #60 — Attendance: continue marks rest out + roster jump on swipe
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Incomplete **Continue to scoring** bulk-marks unmarked players absent; swipe deck has Roster panel + jersey strip to jump remaining players to front. Mark rest present unchanged.
- **Touchpoints:** `QuickInsertView.tsx`, `AttendanceSwipeDeck.tsx`, `docs/sop/session-logging.md`

**Suggested PR Closes:**
```
Closes #58
Closes #60
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
- v2.2.1 shipped via [PR #59](https://github.com/dpromero15/sop-pt/pull/59) (closed #53).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- Legacy metrics without `aggregationMode` migrate on load; calculated fields disabled by default.
- **Rankings no fake baselines:** Missing label/total/attendance scores are `null` (not 70/100). Empty category/metric views keep filters + Cucurella empty state; overall chips show `—`. Asset: `public/cucurella-cat.jpg`.
- **Rankings unscored:** `null` / missing sorts worst (after 0); UI section divider + primary label `Unscored` for never-scored players.
- **Overall vs Weighted:** `totalScore` / label `score` omit unscored; `weightedTotalScore` / label `weightedScore` count unscored as 0. Excused attendance is unscored.
- **Attendance #60:** Continue while incomplete → remaining unmarked = absent; complete review Continue is advance-only.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
