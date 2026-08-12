# Working ledger — release v2.10.0

| Field | Value |
|---|---|
| **Release** | `2.10.0` |
| **Branch** | `release/v2.10.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### #107 — Attendance always on Active Weights + formula score
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Season attendance rate feeds formula weight (006). Attendance system label always restored (007); Active Weights / Config always show Attendance first (always-on, not removable).
- **Touchpoints:** `formulaWeights.ts`, `scoring.ts`, `metricAggregation.ts`, `006_attendance_formula_weight.ts`, `007_attendance_label.ts`, `RankingsView.tsx`, `ConfigView.tsx`, `ScoringConfigModal.tsx`

### #108 — Drop calculated fields; average aggregation + team metric summary
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Catalog removed; `aggregationMode: 'average'`; Rankings team avg/best/scored strip; migration **008**.
- **Touchpoints:** `metricAggregation.ts`, `rankingsFilter.ts`, `RankingsView.tsx`, `ConfigView.tsx`, `008_clear_calculated_fields.ts`

### #110 — Metrics: multi-category membership (labelIds + primary)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `labelIds` + `primaryLabelId`; filters use membership; formula standing uses primary only; migration **009**; Attendance locked; Config multi-select + primary.
- **Touchpoints:** `metricLabels.ts`, `scoring.ts`, `rankingsFilter.ts`, `ConfigView.tsx`, `009_metric_multi_labels.ts`, `docs/sop/metrics.md`

**Suggested PR Closes:**
```
Closes #107
Closes #108
Closes #110
```

## Still open (this release)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Label:** `v2.10.0`

### #109 — Compliance: sort names, denser board, invert eligibility/red-card checks
- Name sort, compact board columns, inverted polarity for eligibility/disciplinary.
- **Label:** `v2.10.0`

## Agent notes

- `2.9.0` shipped via [#96](https://github.com/dpromero15/sop-pt/pull/96) + follow-up [#102](https://github.com/dpromero15/sop-pt/pull/102).
- First `2.10.0` batch shipped via [#106](https://github.com/dpromero15/sop-pt/pull/106) (`Closes #103 #104 #105`).
- Calculated fields catalog cleared in schema **v8**; prefer metric `aggregationMode: 'average'`.
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- **QA:** `npm run lint` + `npm test` pass (165 tests) 2026-08-12.
