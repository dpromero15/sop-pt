# Storage contracts

## What

Runtime data is partitioned into separated JSON blobs / Firestore collections. A full backup export may combine them; runtime never uses one mega-document.

## Why

Isolates team config from high-churn entries, simplifies sync, and mirrors clean Firestore paths.

## Collections

| Collection | Shape | Local key | Firestore |
|---|---|---|---|
| `team` | single `Team` | `stm_team_v1` | `teams/{teamId}` |
| `players` | `Player[]` / docs | `stm_players_v1` | `teams/{teamId}/players/{playerId}` |
| `sessions` | `Session[]` / docs | `stm_sessions_v1` | `teams/{teamId}/sessions/{sessionId}` |
| `entries` | `MetricEntry[]` / docs | `stm_entries_v1` | `teams/{teamId}/entries/{entryId}` |
| `metrics` | `MetricDefinition[]` blob | `stm_metrics_v1` | `teams/{teamId}/config/metrics` |
| `labels` | `LabelDefinition[]` blob | `stm_labels_v1` | `teams/{teamId}/config/labels` |
| `formula` | `ScoringFormulaConfig` blob | `stm_formula_v1` | `teams/{teamId}/config/formula` |
| `calculatedFields` | `CalculatedFieldDefinition[]` blob | `stm_calculated_fields_v1` | `teams/{teamId}/config/calculatedFields` |

### Team fields

`id`, `name`, `shortName`, `season`, `ageGroup`, `clubName`, `homeVenue`, `primaryColor`, `secondaryColor`, `logoUrl?`, `coachName?`, `contactEmail?`, `timezone`, `notes?`, `updatedAt`

### Session fields

`id`, `date`, `time?`, `title`, `type`, `status`, `location?`, `opponent?`, `score?`, `notes?`, `metricIds`

- **`status`:** `open` | `closed`. New sessions default to `open`. Quick Insert only resumes open sessions. Completing a session in the logger sets `closed`. Closed sessions remain in Sessions history; **Reopen & Insert** sets them back to `open`.
- **Migration:** legacy sessions without `status` are treated as `open` so coaches can finish in-progress work.
- **`metricIds`:** ordered list of metric definition ids that apply to this session.
- Attendance metric id is always first and cannot be removed in the UI.
- On create, seed `metricIds = [attendanceMetricId]`. Match sessions may additionally suggest a default game pack (`m_goals`, `m_assists`, `m_tackles`).
- **Migration:** if a stored session lacks `metricIds`, derive the set from distinct `metricId` values in that session’s entries, ensure the attendance metric id is included first, then persist.
- **Versioned runner:** `src/services/migrations` (`stm_schema_version_v1`). Boot + Admin “Data migrations” + post-import/hydrate. See `.cursor/skills/data-migrations/SKILL.md`.

### Metric definition fields

`id`, `name`, `labelId`, `type`, `unit`, `higherIsBetter`, `aggregationMode`, `minExpectedValue?`, `maxExpectedValue?`, `description?`

- **`aggregationMode`:** `sum` | `best` | `latest` — how entries roll up for rankings (see [sop/metrics.md](../sop/metrics.md)).
- **Migration:** missing `aggregationMode` is filled on load (`time_seconds` → `best`, goals/assists/tackles → `sum`, else `latest`).

### Calculated fields

Pre-built derived stats (`average`, `per_session`, `percentile`) with `enabled` toggles. Not session-logged. See [sop/metrics.md](../sop/metrics.md).

### Write policy

- **Local adapter:** synchronous `localStorage` JSON
- **Cloud:** document-per-entity for players/sessions/entries; single config docs for metrics/labels/formula; team root doc for profile
