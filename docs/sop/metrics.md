# Metrics, aggregation, and categories

## What

Measurable metrics are coach-defined stats logged in sessions. Each metric has a **direction** (higher vs lower is better), an **aggregation mode** that controls how entries roll up for rankings, and one or more **category labels**.

## Why

Coaches need season totals for goals, all-time best times for combine tests, season averages (e.g. mean 40m) without a separate calculated-fields catalog, and the ability to show the same metric under multiple category tabs without double-counting it in the overall formula.

## Categories (multi-membership)

| Field | Role |
|---|---|
| `labelIds` | Categories where the metric appears (Rankings filters, Config) |
| `primaryLabelId` | Category that owns **formula standing** (must be in `labelIds`) |

Secondary categories are browse/org only. Example: 40m under Speed **and** Fitness appears on both tabs, but only the primary feeds formula standing.

Attendance is locked to the Attendance system label.

## Subcategories (schema v14 + v16)

Parent categories may have **one level** of subcategories (`LabelDefinition.parentLabelIds`) and may also hold metrics directly. A subcategory may belong to **multiple** root parents (e.g. Endurance under Offense, Defense, and Midfield).

| Rule | Behavior |
|---|---|
| Depth | Parent → child only. No sub-subcategories. Attendance cannot be a parent or child. |
| Formula | One weight per **parent**. Subcategories are folders, not extra sliders. |
| Primary parent | `primaryParentLabelId` — when a metric’s primary is the subcategory, only this parent receives formula standing. Other parents are browse-only so overall rank does not count the metric three times. |
| Parent standing | Includes metrics whose primary is the parent **or** a child whose primary parent is this label. |
| Tree uniqueness | Inside one parent tree a metric appears at most once (on the parent **or** in one subcategory). |
| Cross-tree | The same metric may still belong to multiple unrelated parents (e.g. Speed / Acceleration **and** Fitness). |

Config groups the metric picker under each parent. Rankings keeps parent tabs and adds All / Direct / subcategory chips when children exist.

## Aggregation modes

| Mode | Use when | Behavior |
|---|---|---|
| `sum` | Goals, assists, tackles | Add all logged values (season total) |
| `best` | 40m dash, shuttle, max juggles | Best value — **min** if lower-is-better, **max** if higher-is-better |
| `average` | Mean across logged entries (e.g. 40m average) | Arithmetic mean of valid entries |
| `latest` | Ratings, latest % | Most recent entry by timestamp |

Legacy metrics without `aggregationMode` are migrated on load via `defaultAggregationMode` (time → `best`, goals/assists/tackles → `sum`, else `latest`).

Set aggregation under Config → Measured Metrics → **How to use (aggregation)**.

## Rankings display

When a specific measurable metric tag is selected, the leaderboard shows the **aggregated raw value** with unit (e.g. `5.12s`, `14 goals`), sorted by that value and direction. An informational **Team** strip shows squad average, best, and how many players have scored that metric.

**Print (single metric):** Rankings print sheets show **Avg**, **Latest** (most recent entry), and **Best** (all-time min/max by direction) per player, plus a team rollup line (`Team · Avg · Latest best · All-time`). Rank order still follows the metric’s configured aggregation mode. Formula / category / coaches prints stay single-value.

### Statistical Rank vs Adjusted Rank

Standing scores are **squad pool percentiles** per metric (100 = best among players who have that metric logged) — **not** absolute min/max expected ranges (standards/benchmarks are deferred).

A global **Rankings** toggle (not part of Rank by) applies to every category and every formula / category standing:

| Mode | Behavior |
|---|---|
| **Statistical Rank** | Pool place (1 = best) from scored metrics only. Unscored / missing / excused are **omitted** — they do not pull the average down |
| **Adjusted Rank** | Pool place from the adjusted standing score. By default, unscored / missing / excused count as **0** (gaps lower standing). Per-metric flags can change this (below). Optional ±1 coach bumps apply here. |
| **Coaches Rank** | Average of complete coach ordinal ballots (lower average = better), or an individual coach’s ballot. Entered under Players → Coaches Rating. |

Formula label weights still mix categories into the standing score that is then ranked. Primary display on the board is the **pool place** (`#1`, `#2`…), with standing score as secondary detail.

**Rank by** lists measurable metrics only. With none selected, the board ranks by formula standing (All Categories) or category standing — using whichever Rankings mode is active. Tap a selected metric again to clear it.

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
| Excused | −1 | **Unscored** — omitted from Statistical; 0 in Adjusted |

Attendance **aggregates as a season rate** (mean of present/late/absent). That rate (0–100) feeds the Attendance category in the weighted formula directly — not a squad pool percentile — so the Attendance weight reflects reliability.

Attendance rate on cards uses the same Statistical rules (present/late/absent only).

Never-scored players sort last under an **Unscored** divider when ranking by Statistical Rank (or any mode where the value is null).

## Config

Config → Measured Metrics: add or **edit** name, **categories** (grouped parent + subcategory checkboxes) + **primary** category, type, unit, direction, aggregation, expected min/max, and Adjusted flags (Include in Adjusted total / Treat no score as 0).  
Config → Formula: Attendance stays **always on** as a system default (cannot disable); coaches can change its weight percent. Subcategories do not get their own formula slider.

Calculated fields were removed (schema v8); use aggregation mode **average** instead of a separate “40m Average” field. Multi-category metrics use schema v9 (`labelIds` / `primaryLabelId`). Subcategories use schema v14 (`parentLabelId`) and v16 (`parentLabelIds` + `primaryParentLabelId`).

## Touchpoints

- Types: `src/types.ts`
- Labels helpers: `src/utils/metricLabels.ts`
- Aggregation: `src/utils/metricAggregation.ts`
- Scoring: `src/utils/scoring.ts`
- Rankings filter / team summary: `src/utils/rankingsFilter.ts`
- Rankings print (Avg / Latest / Best): `src/utils/rankingsPrint.ts`
- UI: `ConfigView.tsx`, `RankingsView.tsx`
