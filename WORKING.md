# Working ledger — release v2.10.0

| Field | Value |
|---|---|
| **Release** | `2.10.0` |
| **Branch** | `release/v2.10.0` |
| **Last updated** | 2026-08-13 |

## In progress

_(none)_

## Ready to ship

### #133 — Allow editing saved session names
- **Status:** implemented
- **Notes:** Pencil on Sessions inspector and Quick Insert logger header renames via `updateSession`. Empty titles rejected.
- **Touchpoints:** `SessionTitleEditor.tsx`, `SessionsView.tsx`, `QuickInsertView.tsx`

### #135 — Inactive players stay in data but leave roster lists and averages
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `status: 'inactive'` hides the player from live lists, rankings, percentile pools, and team averages. Record + logs kept; Players → Inactive can reactivate.
- **Touchpoints:** `playerStatus.ts`, `scoring.ts`, `PlayersView.tsx`, `ComplianceBoardView.tsx`, `EquipmentConfigPanel.tsx`

### #136 — Player grade plus birth year instead of age
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `age` → `birthYear` via schema **v13**; optional grade 9–12 (Freshman–Senior). CSV accepts legacy `age` column.
- **Touchpoints:** `playerDemographics.ts`, `013_player_birth_year_grade.ts`, `PlayersView.tsx`, `playerCsv.ts`

### #137 — Fit rankings print sheet on one page
- **Status:** implemented
- **Notes:** Letter sheet is a fixed 8.5×11in box; type/padding tighten with roster size; 23+ players go two (or three) columns; leftover overflow scales to fit. Cut lines unchanged.
- **Touchpoints:** `src/utils/rankingsPrint.ts`, `src/utils/rankingsPrint.test.ts`

**Suggested PR Closes:**
```
Closes #133
Closes #135
Closes #136
Closes #137
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
- Attendance Statistical/Adjusted standing shipped via [#124](https://github.com/dpromero15/sop-pt/pull/124) (`Closes #123`).
- Grade Check default-cleared shipped via [#126](https://github.com/dpromero15/sop-pt/pull/126) (`Closes #125`).
- Rankings print + unlabeled breakouts shipped via [#128](https://github.com/dpromero15/sop-pt/pull/128) (`Closes #127`).
- Manual Adjusted ineligible shipped via [#130](https://github.com/dpromero15/sop-pt/pull/130) (`Closes #129`).
- Session logger cockpit shipped via [#132](https://github.com/dpromero15/sop-pt/pull/132) (`Closes #131`).
- Calculated fields catalog cleared in schema **v8**; prefer metric `aggregationMode: 'average'`.
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing).
- Ghost categories: schema **v10** (`010_prune_ghost_categories`).
- Soft delete: schema **v11** (`011_soft_delete_fields`).
- Compliance consequences: schema **v12** (`012_compliance_consequences`).
- Player birth year + grade: schema **v13** (`013_player_birth_year_grade`).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- **QA:** `npm run lint` + `npm test` (236 tests) 2026-08-13 — #133 #135 #136 #137.
