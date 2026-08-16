# Working ledger — release v2.12.0

| Field | Value |
|---|---|
| **Release** | `2.12.0` |
| **Branch** | `release/v2.12.0` |
| **Last updated** | 2026-08-16 |

## In progress

_(none)_

## Ready to ship

### #154 — Configurable positions with LCB/RCB tactical numbers
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Positions are a team catalog (Config). Defaults split CB 4/5 into **RCB (4)** and **LCB (5)**. Coaches can add/edit/reorder and change numbers. Leftover `CB` on a roster is kept until reassigned.
- **Migration:** schema **v18** (`018_player_positions`). Cloud snapshot/bootstrap includes `positions` (API 2.10.0 — deploy separately).
- **Touchpoints:** `playerPositions.ts`, `PositionsConfigPanel.tsx`, `PlayersView.tsx`, `RankingsView.tsx`, `localJsonAdapter.ts`, `cloudSync.ts`, `services/api/src/routes/teams.ts`

### #155 — Multi-position players and per-position coach rankings
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Players can have extra roles (`Also plays`). Rankings scope is Squad / All positions / one role; Stat, Adjusted, and **position Coaches Rank** stay independent. Position ballots are a separate 1…N per role (Players → Coaches Rating → By position), not a slice of overall 1–40. All-positions view + print packet.
- **Migration:** schema **v19** (`019_player_multi_positions`). Cloud blob `coachPositionBallots` (API 2.10.0 — deploy separately).
- **Touchpoints:** `playerPositions.ts`, `positionRankings.ts`, `coachesRating.ts`, `CoachesRatingView.tsx`, `RankingsView.tsx`, `PlayersView.tsx`, `rankingsPrint.ts`, `playerCsv.ts`

### #156 — Player placement printout (overall + position ranks)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Two-page letter sheet per player: squad Stat/Adj/Coach ranks plus each assigned position’s Stat/Adj/Coach ranks, category profile, and metric avg/latest/best. Print from the player profile or bulk from Players (current roster filter).
- **Touchpoints:** `playerPlacementPrint.ts`, `PlayerProfileModal.tsx`, `PlayersView.tsx`, `App.tsx`

**Suggested PR Closes:**
```
Closes #154
Closes #155
Closes #156
```

## Still open (this release)

_(none)_

## Deferred (later)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Status:** parked to **`v3.0.0`** (major). Kept getting deferred on 2.x minor lines; do not pull into 2.12.0.

## Agent notes

- `2.10.0` shipped via [#138](https://github.com/dpromero15/sop-pt/pull/138) (includes #134 batch).
- `2.11.0` #139 shipped via [#141](https://github.com/dpromero15/sop-pt/pull/141).
- `2.11.0` #142 + #143 shipped via [#144](https://github.com/dpromero15/sop-pt/pull/144).
- `2.11.0` #140 + #145 + #146 + #147 shipped via [#148](https://github.com/dpromero15/sop-pt/pull/148).
- `2.11.0` #149 + #151 shipped via [#150](https://github.com/dpromero15/sop-pt/pull/150).
- `2.12.0` #152 shipped via [#153](https://github.com/dpromero15/sop-pt/pull/153).
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
- **QA:** `npm run lint` + `npm test` (319 tests) + `npm run build` 2026-08-15 — #152 + #154 + #155 + #156. API `npm run lint` in `services/api` (2.10.0). Cloud Run API deploy still needed for `config/positions` and `config/coachPositionBallots` snapshot/bootstrap.
