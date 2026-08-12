# Working ledger — release v2.10.0

| Field | Value |
|---|---|
| **Release** | `2.10.0` |
| **Branch** | `release/v2.10.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### #112 — Rankings shows Speed / Fitness even though they are not on the formula page
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Rankings tabs / Active Weights / Config share one category set; orphan formula weights hidden and pruned; no `'speed'` invention.
- **Touchpoints:** `formulaWeights.ts`, `metricLabels.ts`, `localJsonAdapter.ts`, `RankingsView.tsx`, `ConfigView.tsx`, `ScoringConfigModal.tsx`, `010_prune_ghost_categories.ts`

### #113 — Default categories/metrics ghost on Rankings; hidden or empty vs formula page
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Fresh teams seed Attendance-only (not Thunder FC catalog). Migration **010** drops unused sample labels, orphan metrics, and orphan weights.
- **Touchpoints:** same as #112; `docs/architecture/storage.md`

**Suggested PR Closes:**
```
Closes #112
Closes #113
```

## Still open (this release)

### #109 — Compliance: sort names, denser board, invert eligibility/red-card checks
- Name sort, compact board columns, inverted polarity for eligibility/disciplinary.
- **Label:** `v2.10.0`

### #114 — Soft delete sessions and players (restore + 90-day purge)
- Player/session delete flags `deletedAt` instead of hard remove; restore from trash; auto-purge after 90 days.
- **Label:** `v2.10.0`

## Deferred (next release)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Parked for:** `v2.11.0` (too large for remaining 2.10.0 batch; GitHub label retarget pending human approval)

## Agent notes

- `2.9.0` shipped via [#96](https://github.com/dpromero15/sop-pt/pull/96) + follow-up [#102](https://github.com/dpromero15/sop-pt/pull/102).
- First `2.10.0` batch shipped via [#106](https://github.com/dpromero15/sop-pt/pull/106) (`Closes #103 #104 #105`).
- Second `2.10.0` batch shipped via [#111](https://github.com/dpromero15/sop-pt/pull/111) (`Closes #107 #108 #110`).
- Calculated fields catalog cleared in schema **v8**; prefer metric `aggregationMode: 'average'`.
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing).
- Ghost categories: schema **v10** (`010_prune_ghost_categories`).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- **QA:** `npm run lint` + `npm test` pass (174 tests) 2026-08-12 — Phase 2 (#112+#113).
- Next: Phase 3 (#109 Compliance).
