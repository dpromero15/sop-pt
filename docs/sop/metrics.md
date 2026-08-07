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

### Overall Rank vs Adjusted Rank

Standing scores are **squad pool percentiles** per metric (100 = best among players who have that metric logged) — **not** absolute min/max expected ranges (standards/benchmarks are deferred).

A global **Rankings** toggle (not part of Rank by) applies to every category and every formula / category standing:

| Mode | Behavior |
|---|---|
| **Overall Rank** | Pool place (1 = best) from scored metrics only. Unscored / missing / excused are **omitted** — they do not pull the average down |
| **Adjusted Rank** | Pool place from the adjusted standing score. By default, unscored / missing / excused count as **0** (gaps lower standing). Per-metric flags can change this (below). |

Formula label weights still mix categories into the standing score that is then ranked. Primary display on the board is the **pool place** (`#1`, `#2`…), with standing score as secondary detail.

**Rank by** only lists measurable metrics and calculated fields. With none selected, the board ranks by formula standing (All Categories) or category standing — using whichever Rankings mode is active. Tap a selected metric again to clear it.

#### Adjusted metric flags

On each measurable metric (Config → Measured Metrics):

| Flag | Default | Behavior |
|---|---|---|
| **Include in Adjusted total** (`includeInAdjustedTotal`) | on (`true`) | When **off**, the metric is excluded from Adjusted category / overall blend. Its own rankings still use logged values. Unobserved players are **not** gap-penalized in Adjusted because of this metric. |
| **Treat no score as 0** (`treatNoScoreAsZero`) | on (`true`) | Only applies when the metric is included in Adjusted. When **on**, missing / unscored counts as **0** in the Adjusted average. When **off**, missing is omitted from that metric’s contribution (no gap penalty). |

Exemption wins over gap-as-zero for the overall Adjusted blend: a metric with Include off never enters Adjusted, regardless of Treat no score as 0.

Legacy metrics missing these flags are migrated on load to `true`.

### Attendance

| Status | Value | Scoring |
|---|---|---|
| Present | 100 | Counted |
| Late | 50 | Counted |
| Absent | 0 | Counted (worst recorded) |
| Excused | −1 | **Unscored** — omitted from Overall; 0 in Adjusted |

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

Config → Measured Metrics: add or **edit** name, category, type, unit, direction, aggregation, expected min/max, and Adjusted flags (Include in Adjusted total / Treat no score as 0).  
Config → Calculated Fields: toggle each catalog field on/off.  
Config → Formula: Attendance category weight is system-locked (visible, not editable).

## Touchpoints

- Types: `src/types.ts`
- Aggregation: `src/utils/metricAggregation.ts`
- Calculated: `src/utils/calculatedFields.ts`
- Scoring: `src/utils/scoring.ts`
- UI: `ConfigView.tsx`, `RankingsView.tsx`, `PlayersView.tsx`, `PlayerProfileModal.tsx`
