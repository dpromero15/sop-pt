# Working ledger — release v2.11.0

| Field | Value |
|---|---|
| **Release** | `2.11.0` |
| **Branch** | `release/v2.11.0` |
| **Last updated** | 2026-08-13 |

## In progress

_(none)_

## Ready to ship

### #149 — Printouts show average, latest, and all-time best for metrics
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Metric Rankings prints use Avg / Latest / Best columns; header has Team · Avg · Latest best · All-time. Rank order still follows the metric’s aggregation mode. Non-metric prints unchanged.
- **Touchpoints:** `src/utils/metricAggregation.ts`, `src/utils/rankingsPrint.ts`, `RankingsView.tsx`, `App.tsx`

**Suggested PR Closes:**
```
Closes #149
```

## Still open (this release)

_(none)_

## Deferred (later)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Parked for:** `v2.12.0` (backlog; not on the 2.11 line)

## Agent notes

- `2.10.0` shipped via [#138](https://github.com/dpromero15/sop-pt/pull/138) (includes #134 batch).
- `2.11.0` #139 shipped via [#141](https://github.com/dpromero15/sop-pt/pull/141).
- `2.11.0` #142 + #143 shipped via [#144](https://github.com/dpromero15/sop-pt/pull/144).
- `2.11.0` #140 + #145 + #146 + #147 shipped via [#148](https://github.com/dpromero15/sop-pt/pull/148).
- Label hierarchy: schema **v14** (`014_label_parent`); shared multi-parent: schema **v16** (`016_label_multi_parent`).
- Player public IDs: schema **v15** (`015_player_public_id`).
- Multi-category metrics: schema **v9** (`labelIds` + `primaryLabelId`; primary-only formula standing). Parent standing includes child primaries **only for that child’s primary parent** (shared folders do not triple-count).
- Ghost categories: schema **v10** (`010_prune_ghost_categories`).
- Soft delete: schema **v11** (`011_soft_delete_fields`).
- Compliance consequences: schema **v12** (`012_compliance_consequences`).
- Player birth year + grade: schema **v13** (`013_player_birth_year_grade`).
- GCP/Firebase project is **`sop-pt-2`**; follow gcp-firebase-changes skill for live cloud mutations.
- Attendance system category: schema **006** (formula weight) + **007** (label).
- Locked-sheet + tabs is the mobile density standard: `.cursor/skills/locked-sheet-tabs/SKILL.md` (player add/edit is the reference).
- **QA:** `npm run lint` + `npm test` (289 tests) 2026-08-13 — #149.
