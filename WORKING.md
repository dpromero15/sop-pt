# Working ledger — release v2.10.0

| Field | Value |
|---|---|
| **Release** | `2.10.0` |
| **Branch** | `release/v2.10.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### #123 — Attendance still empty on Statistical Rank and Adjusted Rank
- **Status:** implemented — open [PR #124](https://github.com/dpromero15/sop-pt/pull/124)
- **Notes:** Scoring always includes the Attendance label/metric so session logs feed Statistical + Adjusted standing. Attendance category / metric views treat `attendanceRate` as data (not empty-cat).
- **Touchpoints:** `scoring.ts`, `rankingsFilter.ts`, `RankingsView.tsx`

**Suggested PR Closes:**
```
Closes #123
```

## Still open (this release)

_(none)_

## Deferred (next release)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Parked for:** `v2.11.0` (too large for remaining 2.10.0 batch; GitHub label retarget pending human approval)

## Agent notes

- `2.9.0` shipped via [#96](https://github.com/dpromero15/sop-pt/pull/96) + follow-up [#102](https://github.com/dpromero15/sop-pt/pull/102).
- First `2.10.0` batch shipped via [#106](https://github.com/dpromero15/sop-pt/pull/106) (`Closes #103 #104 #105`).
- Second `2.10.0` batch shipped via [#111](https://github.com/dpromero15/sop-pt/pull/111) (`Closes #107 #108 #110`).
- Ghost categories shipped via [#115](https://github.com/dpromero15/sop-pt/pull/115) (`Closes #112 #113`).
- Compliance invert + soft delete shipped via [#116](https://github.com/dpromero15/sop-pt/pull/116) (`Closes #109 #114`).
- Compliance consequences shipped via [#118](https://github.com/dpromero15/sop-pt/pull/118) (`Closes #117`).
- JIT Save + sync log + attendance board shipped via [#122](https://github.com/dpromero15/sop-pt/pull/122) (`Closes #119 #120 #121`).
- Calculated fields catalog cleared in schema **v8**; prefer metric `aggregationMode: 'average'`.
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing).
- Ghost categories: schema **v10** (`010_prune_ghost_categories`).
- Soft delete: schema **v11** (`011_soft_delete_fields`).
- Compliance consequences: schema **v12** (`012_compliance_consequences`).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- **QA:** `npm run lint` + `npm test` (208 tests) 2026-08-12 — #119/#120/#121/#123.
