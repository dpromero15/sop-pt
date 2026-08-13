# Working ledger — release v2.11.0

| Field | Value |
|---|---|
| **Release** | `2.11.0` |
| **Branch** | `release/v2.11.0` |
| **Last updated** | 2026-08-13 |

## In progress

_(none)_

## Ready to ship

### #139 — Category parents with subcategories (no double metric relation)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** One-level `parentLabelId`; parents hold metrics + children; tree uniqueness (prefer subcategory); parent-only formula weights; Rankings parent tabs + All/Direct/sub chips. Schema **v14**.
- **Touchpoints:** `src/utils/labelTree.ts`, `metricLabels.ts`, `formulaWeights.ts`, `scoring.ts`, `rankingsFilter.ts`, `ConfigView.tsx`, `RankingsView.tsx`, `014_label_parent.ts`

**Suggested PR Closes:**
```
Closes #139
```

## Still open (this release)

_(none)_

## Deferred (later)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Parked for:** `v2.12.0` (backlog; not on the 2.11 line)

## Agent notes

- `2.10.0` shipped via [#138](https://github.com/dpromero15/sop-pt/pull/138) (includes #134 batch).
- Label hierarchy: schema **v14** (`014_label_parent`).
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing). Parent standing now also includes child primaries.
- Ghost categories: schema **v10** (`010_prune_ghost_categories`).
- Soft delete: schema **v11** (`011_soft_delete_fields`).
- Compliance consequences: schema **v12** (`012_compliance_consequences`).
- Player birth year + grade: schema **v13** (`013_player_birth_year_grade`).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- **QA:** `npm run lint` + `npm test` (254 tests) 2026-08-13 — #139.
