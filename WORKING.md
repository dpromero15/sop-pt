# Working ledger — release v2.13.1

| Field | Value |
|---|---|
| **Release** | `2.13.1` |
| **Branch** | `release/v2.13.1` |
| **Last updated** | 2026-08-16 |

## In progress

_(none)_

## Ready to ship

### #162 — Sessions list: newest-first sort and in-place expand
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Sessions & Matches is a single column, newest date first (same day later time first). Tap a row to expand details in place; tap again to collapse.
- **Touchpoints:** `src/components/SessionsView.tsx`, `src/services/storage/localJsonAdapter.ts`, `src/utils/sessionMetrics.ts`

### #163 — Grid attendance: set-all H/L/O/E
- **Status:** implemented (verify acceptance before PR)
- **Notes:** List attendance has an All H/L/O/E row above the player buttons; tap a status to set the whole roster, then flip exceptions. Swipe | List toggle so the grid is available without finishing swipe.
- **Touchpoints:** `src/components/logger/AttendanceMaintenanceList.tsx`, `src/components/QuickInsertView.tsx`, `src/utils/sessionMetrics.ts`

**Suggested PR Closes:**
```
Closes #162
Closes #163
```

## Still open (this release)

_(none)_

## Deferred (later)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Status:** parked to **`v3.0.0`** (major). Kept getting deferred on 2.x minor lines; do not pull into 2.13.1.

## Agent notes

- `2.10.0` shipped via [#138](https://github.com/dpromero15/sop-pt/pull/138) (includes #134 batch).
- `2.11.0` #139 shipped via [#141](https://github.com/dpromero15/sop-pt/pull/141).
- `2.11.0` #142 + #143 shipped via [#144](https://github.com/dpromero15/sop-pt/pull/144).
- `2.11.0` #140 + #145 + #146 + #147 shipped via [#148](https://github.com/dpromero15/sop-pt/pull/148).
- `2.11.0` #149 + #151 shipped via [#150](https://github.com/dpromero15/sop-pt/pull/150).
- `2.12.0` #152 shipped via [#153](https://github.com/dpromero15/sop-pt/pull/153).
- `2.12.0` #154 + #155 + #156 shipped via [#157](https://github.com/dpromero15/sop-pt/pull/157). Hosting + Cloud Run API both deployed on that merge (2026-08-16).
- `2.13.0` #158 + #160 shipped via [#161](https://github.com/dpromero15/sop-pt/pull/161).
- Position ranking is a **Rankings → Scope** chip (Squad / All positions / LCB…), not Coaches Rank → By position pool. **WB (2/3)** remains in the default catalog as a generic wingback; LCB/RCB replaced combined CB 4/5 only.
- #99 System Admin hub parked from 2.12.0 to **v3.0.0** (2026-08-16). Do not implement on this branch.
- Player ranking pools: schema **v17** (`017_player_ranking_pool`).
- Configurable positions: schema **v18** (`018_player_positions`). Default RCB (4) / LCB (5).
- Multi-position + position coach ballots: schema **v19** (`019_player_multi_positions`). `config/coachPositionBallots`.
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
- **QA:** `npm run lint` + `npm test` (328 tests) 2026-08-16 — #162 + #163.
