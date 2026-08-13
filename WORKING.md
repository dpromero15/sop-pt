# Working ledger — release v2.11.0

| Field | Value |
|---|---|
| **Release** | `2.11.0` |
| **Branch** | `release/v2.11.0` |
| **Last updated** | 2026-08-13 |

## In progress

_(none)_

## Ready to ship

### #140 — Keep working through transient sync failures without a refresh
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Network/timeout flush blips stay **Retrying…** with auto-backoff; chip refresh calls `flushNow()`. Auth/4xx still **Sync error**. Gateway URL stays in the system log only.
- **Touchpoints:** `src/services/storage/cloudSync.ts`, `src/services/storage/syncFailure.ts`, `src/components/SyncStatusChip.tsx`

### #147 — Shared subcategories can belong to multiple parents (count once in rankings)
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Subcategory `parentLabelIds` + `primaryParentLabelId` (schema **v16**). Browse under every parent; formula standing / overall count the metric once via the primary parent.
- **Touchpoints:** `src/utils/labelTree.ts`, `src/utils/scoring.ts`, `src/components/ConfigView.tsx`, `016_label_multi_parent.ts`

### #146 — Can't assign a metric to a subcategory
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Same-tree category chips stay clickable; picking a subcategory replaces the parent/sibling. Helper `toggleTreeMembership` in `labelTree.ts`.
- **Touchpoints:** `src/utils/labelTree.ts`, `src/utils/labelTree.test.ts`, `src/components/ConfigView.tsx`

### #145 — Enter on record/score card saves and advances to next player
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Card scoring form submits on Enter (same as Save & next) and refocuses the next player. Dense editor Enter saves the cell and moves down the metric column (skips ineligible).
- **Touchpoints:** `PlayerScoreCard.tsx`, `DenseScoreEditor.tsx`, `src/utils/scoreEntryNav.ts`

### #142 — Player public IDs on printouts plus team ID legend
- **Status:** implemented (verify acceptance before PR)
- **Notes:** 6-char `publicId` per player (schema **v15**); Rankings print menu (names / IDs / legend); Players roster Print ID legend; ID on cards + profile (copy).
- **Touchpoints:** `src/utils/playerPublicId.ts`, `rankingsPrint.ts`, `PlayersView.tsx`, `RankingsView.tsx`, `015_player_public_id.ts`

### #143 — Player edit sheet is too long on mobile — tab the locked form
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Add/edit player stays a locked viewport sheet; Info / Status / Compliance tabs; Save/Cancel pinned; Register New Player actually opens the sheet. Pattern captured in `locked-sheet-tabs` skill + component rule.
- **Touchpoints:** `src/components/PlayersView.tsx`, `src/App.tsx`, `.cursor/skills/locked-sheet-tabs/SKILL.md`, `.cursor/rules/locked-sheet-tabs.mdc`

**Suggested PR Closes:**
```
Closes #140
Closes #142
Closes #143
Closes #145
Closes #146
Closes #147
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
- **QA:** `npm run lint` + `npm test` (285 tests) 2026-08-13 — #140 + #142 + #143 + #145 + #146 + #147.
