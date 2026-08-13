# Working ledger — release v2.10.0

| Field | Value |
|---|---|
| **Release** | `2.10.0` |
| **Branch** | `release/v2.10.0` |
| **Last updated** | 2026-08-12 |

## In progress

_(none)_

## Ready to ship

### #109 — Compliance: sort names, denser board, invert eligibility/red-card checks
- **Status:** implemented — open [PR #116](https://github.com/dpromero15/sop-pt/pull/116)
- **Notes:** Name A–Z / Z–A / jersey sort. Compact board. Flag checkboxes invert in UI only.
- **Touchpoints:** `eligibility.ts`, `ComplianceBoardView.tsx`, `PlayersView.tsx`, `ComplianceConfigPanel.tsx`, `initialData.ts`

### #114 — Soft delete sessions and players (restore + 90-day purge)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `deletedAt` flag; restore from Recently deleted; 90-day boot purge; snapshots keep tombstones. `clearAllPlayers` stays permanent.
- **Touchpoints:** `softDelete.ts`, `localJsonAdapter.ts`, `PlayersView.tsx`, `SessionsView.tsx`, `QuickInsertView.tsx`, `011_soft_delete_fields.ts`, `main.tsx`

**Suggested PR Closes:**
```
Closes #109
Closes #114
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
- Compliance + soft delete on [#116](https://github.com/dpromero15/sop-pt/pull/116) (`Closes #109 #114`).
- Calculated fields catalog cleared in schema **v8**; prefer metric `aggregationMode: 'average'`.
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing).
- Ghost categories: schema **v10** (`010_prune_ghost_categories`).
- Soft delete: schema **v11** (`011_soft_delete_fields`).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- **QA:** `npm run lint` + `npm test` pass (184 tests) 2026-08-12 — Phase 4 (#114).
