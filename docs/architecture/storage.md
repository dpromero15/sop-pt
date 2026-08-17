# Storage contracts

## What

Runtime data is partitioned into separated JSON blobs / Firestore collections. A full backup export may combine them; runtime never uses one mega-document.

## Why

Isolates team config from high-churn entries, simplifies sync, and mirrors clean Firestore paths.

## Collections

| Collection | Shape | Local key | Firestore |
|---|---|---|---|
| `team` | single `Team` | `stm_t/{teamId}/stm_team_v1` | `teams/{teamId}` |
| `players` | `Player[]` / docs | `stm_t/{teamId}/stm_players_v1` | `teams/{teamId}/players/{playerId}` |
| `sessions` | `Session[]` / docs | `stm_t/{teamId}/stm_sessions_v1` | `teams/{teamId}/sessions/{sessionId}` |
| `entries` | `MetricEntry[]` / docs | `stm_t/{teamId}/stm_entries_v1` | `teams/{teamId}/entries/{entryId}` |
| `metrics` | `MetricDefinition[]` blob | `stm_t/{teamId}/stm_metrics_v1` | `teams/{teamId}/config/metrics` |
| `labels` | `LabelDefinition[]` blob | `stm_t/{teamId}/stm_labels_v1` | `teams/{teamId}/config/labels` |
| `formula` | `ScoringFormulaConfig` blob | `stm_t/{teamId}/stm_formula_v1` | `teams/{teamId}/config/formula` |
| `calculatedFields` | `CalculatedFieldDefinition[]` blob | `stm_t/{teamId}/stm_calculated_fields_v1` | `teams/{teamId}/config/calculatedFields` |

Legacy unscoped `stm_*_v1` keys are copied onto the active team cache by migration **004**.

### JIT cloud sync (v2.9)

- Local write first. UI never waits on the network.
- Hydrate **once** on team enter (`GET /v1/teams/:id/snapshot`).
- Dirty collections flush after ~10s debounce, on `online`, or when the tab hides. One PUT per dirty collection. Empty squad clears (`players` / `sessions` / `entries` = `[]`) flush immediately; pending outbox also flushes at end of hydrate.
- Writes during an in-flight flush stay in the outbox and flush next (do not drop). Formula Save, bump budget Save, and Compliance manager Save call `flushNow`. Compliance board / manager have **Sync now**.
- Sync chip + Admin **System sync log** keep a local ring buffer (`stm_sync_log_v1`, last 80 events) of hydrate/flush/error/queued-dirty.
- `applySnapshot` persists empty arrays (so releasing `holdSeeds` does not reseed sample Thunder FC).
- Ranking cut lines: overall `primaryCut`/`secondaryCut` plus optional `categoryCuts` / `metricCuts` / `poolCuts` maps (resolved pool → specialty → metric → category → global). Pool lines default to Wingbacks 2/3, Center Defense 2/3, Central Midfield 2/3, Forwards 2/6, Goalkeepers 1/1.
- Position catalog: `stm_positions_v1` / `config/positions`. Each role has a code plus classic tactical number (RCB 4, LCB 5). Coaches can add/edit/reorder in Config.
- Sub-teams: `stm_sub_teams_v1` / `config/subTeams`. Varsity / JV / C-team (or any named groups). Players store `squadIds` (multi-membership). Rankings can filter groups Combined (one list) or Separated (own rank 1 per group).
- If cloud is empty and this device has a roster (e.g. JSON import), the first enter **pushes** that squad.
- Simulated auth / missing `VITE_API_BASE_URL` stays local-only.
- SPA never talks to Firestore; Cloud Run Admin SDK remains the write path.

### Team fields

`id`, `name`, `shortName`, `season`, `ageGroup`, `clubName`, `homeVenue`, `primaryColor`, `secondaryColor`, `logoUrl?`, `coachName?`, `contactEmail?`, `timezone`, `notes?`, `updatedAt`

### Player fields

`id`, `name`, `publicId?`, `jerseyNumber`, `position`, `positions?`, `rankingPool?`, `squadIds?`, `preferredFoot`, `avatarUrl?`, `birthYear?`, `grade?`, `joinedDate`, `status`, `notes?`, `rankingIneligible?`, `deletedAt?`

- **`position`:** Short code from the team position catalog (`LCB`, `RCB`, `ST`, …). Display includes the classic tactical number (`LCB (5)`). Schema **v18** seeds the catalog (RCB 4 / LCB 5 instead of combined CB 4/5) and keeps leftover `CB` rows still on the roster.
- **`positions`:** All roles the player can play, primary first. Schema **v19** backfills `[position]` when missing. Rankings Stat/Adj/Coach-by-position include anyone assigned the role, not only the primary.
- **`squadIds`:** Sub-team membership (0..N). Empty/missing = unassigned. Schema **v20** seeds an empty catalog (`stm_sub_teams_v1` / `config/subTeams`). Rankings Groups chips filter Combined (union, one place) or Separated (each group has its own rank 1; dual-rostered players appear in both).
- **Position coach ballots:** `stm_coach_position_ballots_v1` / `config/coachPositionBallots`. Independent 1…N ranks per catalog role (not a slice of the squad coaches ballot). Complete when every active player assigned that role has a unique ordinal.

- **`birthYear`:** Calendar year of birth. Replaces legacy `age` (schema **v13** converts `age` → `asOfYear - age` and drops `age`).
- **`grade`:** Current school grade `9` | `10` | `11` | `12` (Freshman–Senior). Optional; not inferred from birth year.
- **`deletedAt`:** ISO timestamp when the player was soft-deleted. Unset = live. `getPlayers()` excludes these; snapshots/backups keep them so cloud replace-collection does not wipe trash. Restore clears the flag. Records older than **90 days** are hard-deleted on boot (bumps, compliance, equipment assignment cascade).
- **`status`:** `active` | `injured` | `inactive`. Inactive (cut) players stay in storage with their logs but are omitted from live roster lists, rankings, percentile pools, team averages, logger, compliance, and equipment assign. Reactivate from Players → Inactive. Injured remains on the live roster.
- **`rankingIneligible`:** Coach-set flag. `true` excludes the player from Adjusted Rank (bottom of the list). Missing/false = included. Compliance checklist badges are informational and do not change Adjusted place.
- **`rankingPool`:** Editable Coaches Rank comparison pool. Defaults from `position`; schema **v17** backfills existing local and hydrated players without replacing a valid coach override.

### Session fields

`id`, `date`, `time?`, `title`, `type`, `status`, `location?`, `opponent?`, `score?`, `notes?`, `metricIds`, `deletedAt?`

- **`status`:** `open` | `closed`. New sessions default to `open`. Quick Insert only resumes open sessions. Completing a session in the logger sets `closed`. Closed sessions remain in Sessions history; **Reopen & Insert** sets them back to `open`.
- **Migration:** legacy sessions without `status` are treated as `open` so coaches can finish in-progress work.
- **`metricIds`:** ordered list of metric definition ids that apply to this session.
- Attendance metric id is always first and cannot be removed in the UI.
- On create, seed `metricIds = [attendanceMetricId]`. Match sessions may additionally suggest a default game pack (`m_goals`, `m_assists`, `m_tackles`).
- **Migration:** if a stored session lacks `metricIds`, derive the set from distinct `metricId` values in that session’s entries, ensure the attendance metric id is included first, then persist.
- **Versioned runner:** `src/services/migrations` (`stm_schema_version_v1`). Boot + Admin “Data migrations” + post-import/hydrate. See `.cursor/skills/data-migrations/SKILL.md`.
- **Compliance (v5):** requirements gain `blocksPractice` (default false) and may include `kind: 'disciplinary'` (e.g. red-card sit-out). Migration backfills missing `blocksPractice` and seeds `req_red_card_sitout` when absent.
- **Formula (v6):** Attendance is always enabled in the scoring formula with a positive weight (default 20% if missing/disabled). Season attendance rate feeds that weight directly.
- **Labels (v7):** Attendance category label is always restored as `system: true` so Active Weights and Config always show it.
- **Calculated fields (v8):** Stored calculated-fields catalog cleared; use metric `aggregationMode: 'average'` instead.
- **Metrics (v9):** `labelId` → `labelIds[]` + `primaryLabelId` (multi-category membership; primary owns formula standing).
- **Ghost categories (v10):** Unused Thunder FC sample labels (Speed, Fitness, …) with no metrics are removed; orphan formula weights and metrics pointing at missing labels are pruned so Rankings tabs / Active Weights match Config. Fresh teams seed Attendance-only labels/metrics/formula (not the full demo catalog).
- **Soft delete (v11):** Optional `deletedAt` on players and sessions. Single delete is restoreable for 90 days; `clearAllPlayers` stays a permanent wipe. Purge runs after migrations on boot.
- **Compliance consequences (v12):** `blocksEquipment` (default false). Recommended CRHS set: Physical = No practice; Grade Check = eligibility kind (inverted checkbox, **Ineligible**); CRHS Policy + CHSSAA Policy = No play; Team fee = No play + No equipment. Config **Compliance manager** can apply that set and toggle consequences. Equipment assign is blocked when a No equipment item is incomplete.
- **Player demographics (v13):** `age` → `birthYear` (`asOfYear - age`); optional `grade` 9–12. Repair re-run drops leftover `age`.
- **Label parents (v14):** Optional `parentLabelId` on labels (max depth 1). Invalid parents are cleared; metric `labelIds` keep at most one id per parent tree (prefer subcategory); subcategory formula weights are dropped.
- **Player public ID (v15):** Short stable `publicId` (6 Crockford-like chars, unique per team) for printouts and the team ID legend. Distinct from internal `id`. Assigned on create; migration backfills existing squads. Rankings print can show IDs instead of names.
- **Shared subcategories (v16):** `parentLabelIds[]` + `primaryParentLabelId` (legacy `parentLabelId` mirrored as the primary). A folder like Endurance can sit under several roots; only the primary parent receives formula standing so overall rank does not triple-count.
- **Player ranking pool (v17):** Assigns the editable Coaches Rank pool from each player's position. Repair is idempotent and preserves existing valid assignments.
- **Player positions (v18):** Seeds a team-configurable position catalog (`stm_positions_v1` / `config/positions`) with **RCB (4)** and **LCB (5)** instead of combined CB 4/5. Codes still on the roster (including leftover `CB`) are kept so existing players keep displaying.
- **Multi-position (v19):** Backfills `positions[]` from primary `position`. Extra assigned codes missing from the catalog are added so Config still lists them.
- **Sub-teams (v20):** Seeds empty `stm_sub_teams_v1` catalog. Coaches add Varsity / JV / C-team (or any names) in Config. Player `squadIds` stay empty until assigned.

### Metric definition fields

`id`, `name`, `labelIds`, `primaryLabelId`, `type`, `unit`, `higherIsBetter`, `aggregationMode`, `minExpectedValue?`, `maxExpectedValue?`, `description?`

Labels store optional `parentLabelIds` / `primaryParentLabelId` (subcategory of one or more root labels; `parentLabelId` is the legacy primary mirror).

- **`labelIds`:** Categories where the metric appears in Rankings / Config filters (non-empty). At most one id from each parent tree.
- **`primaryLabelId`:** Category that receives formula standing contribution (must be in `labelIds`). Secondary memberships are browse-only. A subcategory primary rolls into **that child’s primary parent** only.
- **`aggregationMode`:** `sum` | `best` | `latest` | `average` — how entries roll up for rankings (see [sop/metrics.md](../sop/metrics.md)). Attendance always averages present/late/absent regardless of stored mode.
- **Migration:** missing `aggregationMode` is filled on load (`time_seconds` → `best`, goals/assists/tackles → `sum`, else `latest`). Legacy `labelId` is mapped to `labelIds` / `primaryLabelId` on load and via schema v9.

### Calculated fields

Legacy catalog cleared in schema v8. Prefer metric aggregation modes (including `average`) instead of separate calculated-field definitions.

### Write policy

- **Local adapter:** synchronous `localStorage` JSON, namespaced per team
- **Cloud:** document-per-entity for players/sessions/entries; config docs for metrics/labels/formula plus coaches/bumps/compliance/equipment; team root doc for profile. JIT flush via Cloud Run, not the client SDK.
