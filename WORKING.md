# Working ledger — release v2.13.0

| Field | Value |
|---|---|
| **Release** | `2.13.0` |
| **Branch** | `release/v2.13.0` |
| **Last updated** | 2026-08-16 |

## In progress

_(none)_

## Ready to ship

### #158 — Player placement print: metric rank column and position-pool leaders
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Metrics “Squad standing” is a percentile (relabeled Percentile). New Rank column is Statistical place among players with that metric logged. Assigned-position Statistical cell shows top two first names, then this player if outside the top two (`1. Ryan  2. Paul  ···  5. Mark`). Adjusted / Coaches stay `#N of M`.
- **Touchpoints:** `src/utils/playerPlacementPrint.ts`, `src/utils/playerPlacementPrint.test.ts`

**Suggested PR Closes:**
```
Closes #158
```

## Still open (this release)

_(none)_

## Deferred (later)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Status:** parked to **`v3.0.0`** (major). Kept getting deferred on 2.x minor lines; do not pull into 2.13.0.

## Agent notes

- `2.10.0` shipped via [#138](https://github.com/dpromero15/sop-pt/pull/138) (includes #134 batch).
- `2.11.0` #139 shipped via [#141](https://github.com/dpromero15/sop-pt/pull/141).
- `2.11.0` #142 + #143 shipped via [#144](https://github.com/dpromero15/sop-pt/pull/144).
- `2.11.0` #140 + #145 + #146 + #147 shipped via [#148](https://github.com/dpromero15/sop-pt/pull/148).
- `2.11.0` #149 + #151 shipped via [#150](https://github.com/dpromero15/sop-pt/pull/150).
- `2.12.0` #152 shipped via [#153](https://github.com/dpromero15/sop-pt/pull/153).
- `2.12.0` #154 + #155 + #156 shipped via [#157](https://github.com/dpromero15/sop-pt/pull/157). Hosting + Cloud Run API both deployed on that merge (2026-08-16).
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
- **QA:** `npm run lint` + `npm test` (323 tests) 2026-08-16 — #158. API `npm run lint` in `services/api` (2.10.0). Hosting + Cloud Run deployed with PR #157.
