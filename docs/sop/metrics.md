# Metrics, aggregation, and calculated fields

## What

Measurable metrics are coach-defined stats logged in sessions. Each metric has a **direction** (higher vs lower is better) and an **aggregation mode** that controls how entries roll up for rankings. Optional **calculated fields** are pre-built derived stats (average, per-session rate, percentile) that can be toggled on without being logged.

## Why

Coaches need season totals for goals, all-time best times for combine tests, and the ability to optionally surface averages or rates without changing how the primary metric ranks.

## Aggregation modes

| Mode | Use when | Behavior |
|---|---|---|
| `sum` | Goals, assists, tackles | Add all logged values (season total) |
| `best` | 40m dash, shuttle, max juggles | Best value — **min** if lower-is-better, **max** if higher-is-better |
| `latest` | Ratings, latest % | Most recent entry by timestamp |

Legacy metrics without `aggregationMode` are migrated on load via `defaultAggregationMode` (time → `best`, goals/assists/tackles → `sum`, else `latest`).

## Rankings display

When a specific measurable metric tag is selected, the leaderboard shows the **aggregated raw value** with unit (e.g. `5.12s`, `14 goals`), sorted by that value and direction.

### Total Overall vs Weighted Total

A global **Totals** toggle (not part of Rank by) applies to every category and every formula / category score:

| Mode | Behavior |
|---|---|
| **Total Overall** | Unscored / missing / excused values are **omitted** — they do not pull the average down |
| **Weighted Total** | Unscored / missing / excused count as **0** against the full formula (or every metric in the category) |

**Rank by** only lists measurable metrics and calculated fields. With none selected, the board ranks by formula total (All Categories) or category score — using whichever Totals mode is active. Tap a selected metric again to clear it.

### Attendance

| Status | Value | Scoring |
|---|---|---|
| Present | 100 | Counted |
| Late | 50 | Counted |
| Absent | 0 | Counted (worst recorded) |
| Excused | −1 | **Unscored** — omitted from Overall; 0 in Weighted |

Attendance rate on cards uses Overall rules (present/late/absent only).

Never-scored players sort last under an **Unscored** divider when ranking by Overall (or any mode where the value is null).

## Calculated fields

Stored separately (`stm_calculated_fields_v1`). Catalog seeds include:

- **40m Average** (`average` of 40m entries)
- **40m Percentile** (share of squad with a worse aggregated 40m)
- **Goals per Match** (`sum` / distinct sessions with goals)

Rules:

- Not logged in Quick Insert / sessions
- Only **enabled** fields are computed
- Appear as optional ranking tags when enabled
- Primary base metric still uses its aggregation mode

## Config

Config → Measured Metrics: add or **edit** name, category, type, unit, direction, aggregation, expected min/max.  
Config → Calculated Fields: toggle each catalog field on/off.

## Touchpoints

- Types: `src/types.ts`
- Aggregation: `src/utils/metricAggregation.ts`
- Calculated: `src/utils/calculatedFields.ts`
- Scoring: `src/utils/scoring.ts`
- UI: `ConfigView.tsx`, `RankingsView.tsx`
