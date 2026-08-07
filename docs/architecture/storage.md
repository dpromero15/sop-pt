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

### Team fields

`id`, `name`, `shortName`, `season`, `ageGroup`, `clubName`, `homeVenue`, `primaryColor`, `secondaryColor`, `logoUrl?`, `coachName?`, `contactEmail?`, `timezone`, `notes?`, `updatedAt`

### Write policy

- **Local adapter:** synchronous `localStorage` JSON
- **Cloud:** document-per-entity for players/sessions/entries; single config docs for metrics/labels/formula; team root doc for profile
