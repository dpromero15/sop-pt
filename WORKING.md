# Working ledger — release v2.10.0

| Field | Value |
|---|---|
| **Release** | `2.10.0` |
| **Branch** | `release/v2.10.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### #103 — Ranking cut lines: overall vs category/metric modes
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Config mode switch All rankings vs By category/metric. Stored `categoryCuts` / `metricCuts`. Rankings resolves specialty → metric → category → global Adjusted. Calculated Fields copy confirms average option.
- **Touchpoints:** `RankingBoundariesPanel.tsx`, `rankingBoundaries.ts`, `RankingsView.tsx`, `types.ts`, `localJsonAdapter.ts`, Config copy

### #104 — Compliance: blocks practice + disciplinary (red card sit-out)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `blocksPractice` + `disciplinary` kind; migration 005 seeds red-card sit-out; roster/board show practice eligibility.
- **Touchpoints:** `normalizeCompliance.ts`, `005_compliance_blocks_practice.ts`, `ComplianceConfigPanel.tsx`, `eligibility.ts`

### #105 — Players Compliance pane: triage + dense board
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Players → Compliance pane with Out of compliance (who/why + quick mark) and Board (squad × requirements grid, column mark-complete). Config still defines requirements; per-player edit checklist kept as secondary.
- **Touchpoints:** `ComplianceBoardView.tsx`, `PlayersView.tsx`, `eligibility.ts` (`missingRequirements`)

### Attendance always on Active Weights + formula score
- **Status:** implemented; **needs GitHub issue** before PR (`gh auth refresh -h github.com`, then file + label `v2.10.0`)
- **Notes:** Season attendance rate feeds formula weight (006). Attendance system label always restored (007); Active Weights / Config always show Attendance first (always-on, not removable). Scoring uses absolute season rate for Attendance category.
- **Touchpoints:** `formulaWeights.ts`, `scoring.ts`, `metricAggregation.ts`, `006_attendance_formula_weight.ts`, `007_attendance_label.ts`, `RankingsView.tsx`, `ConfigView.tsx`, `ScoringConfigModal.tsx`, `localJsonAdapter.ts`
- **QA:** `npm run lint` + `npm test` pass (158 tests) 2026-08-12

**Suggested PR Closes:**
```
Closes #103
Closes #104
Closes #105
Closes #N   <!-- replace after filing Attendance issue -->
```

## Still open (this release)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Label:** `v2.10.0`

## Agent notes

- `2.9.0` shipped via [#96](https://github.com/dpromero15/sop-pt/pull/96) + follow-up [#102](https://github.com/dpromero15/sop-pt/pull/102).
- Yes: calculated fields include **average** (`kind: 'average'`, e.g. 40m Average) under Config → Calculated Fields.
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label). HEAD already has ranking/compliance + attendance scoring; pending commit is Active Weights label UI follow-up.
- **Pre-PR gate:** lint/test OK; VERSION 2.10.0 synced. Blocked on filing Attendance issue until `gh auth refresh -h github.com`. Do not open PR until human approval.
