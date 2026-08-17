# Working ledger — release v2.14.0

| Field | Value |
|---|---|
| **Release** | `2.14.0` |
| **Branch** | `release/v2.14.0` |
| **Last updated** | 2026-08-17 |

## In progress

_(none)_

## Ready to ship

### #166 — Sub-teams (Varsity / JV / C-team) with combined and separated rankings
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Config adds/renames/reorders/deletes groups (quick-add Varsity / JV / C-Team). Players can belong to 0..N groups. Rankings Groups chips filter the pool; Combined is one list (dual-rostered once); Separated gives each group its own rank 1 (dual-rostered in both). Schema v20 empty catalog; existing programs unchanged until groups are added.
- **Touchpoints:** `src/utils/subTeams.ts`, `src/components/SubTeamsConfigPanel.tsx`, `src/components/RankingsView.tsx`, `src/components/PlayersView.tsx`, `src/services/migrations/migrations/020_sub_teams.ts`, storage + API `config/subTeams`

**Suggested PR Closes:**
```
Closes #166
```

## Still open (this release)

_(none)_

## Deferred (later)

### #99 — System Admin team hub + shadow mode (attribution-first)
- Admin lands on all teams, enters in shadow mode (never as another user); every change tracked to signed-in admin.
- **Status:** parked to **`v3.0.0`** (major). Do not pull into 2.14.0.

## Agent notes

- `2.13.1` shipped via [#164](https://github.com/dpromero15/sop-pt/pull/164) + [#165](https://github.com/dpromero15/sop-pt/pull/165) (2026-08-17). #162 + #163 closed by those PRs.
- #166 Sub-teams: schema **v20** (`020_sub_teams`). Catalog blob `stm_sub_teams_v1` / `config/subTeams`. Player field `squadIds`.
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
- **QA:** `npm run lint` + `npm test` (338 tests) + `services/api` lint 2026-08-17 — #166.
