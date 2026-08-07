# SOP — Session logging (sideline)

## What

Standard procedure for logging a practice, match, or fitness test on a phone.

## Why

Coaches need one-handed speed: take attendance without menus, then score only players who are here. Returning to a session that already has attendance should not force a full re-swipe. Quick Insert should only work with **open** sessions (or start a new one).

## How

### 1. Open Quick Insert (gate)

On entering Quick Insert (without a Sessions handoff):

1. List **open** sessions (status `open`). Closed sessions are not offered.
2. If any open sessions exist, choose **Continue** on one, or **Start new session**.
3. If none are open, **Start new session**.

**Start new session** creates an open practice session titled `New session - YYYY-MM-DD` (local calendar date) with today’s date and attendance-only `metricIds`.

From **Sessions → Insert Data**, an open session opens directly in the logger. A **closed** session uses **Reopen & Insert**, which sets status back to `open` then opens Quick Insert.

### 2. Create session (Sessions screen)

Create a session with date, time, title, and type (`practice` | `match` | `fitness_test`). New sessions are **open**.

On create, the session metric plan is seeded with **attendance only** (`metricIds` starts with the attendance metric id). Attendance cannot be removed.

### 3. Plan metrics

Optionally attach metrics from the team catalog:

- **Measured** — drills/times/ratings (e.g. 40m dash, juggling, coach rating)
- **Game** — match counts (e.g. goals, assists, tackles)

Match sessions may suggest a default game pack (goals / assists / tackles); the coach confirms or edits.

### 4. Take attendance

**Completeness** is based on stored attendance entries (`m_attendance` per active player), not in-memory defaults.

#### First take / unfinished (swipe deck)

When some or all active players are missing an attendance entry, work the remaining roster one card at a time:

| Gesture | Result | Stamp |
|---|---|---|
| Swipe right | Present | HERE |
| Swipe left | Absent | OUT |
| Swipe down | Excused | EXCUSED |
| Long-press (~400–500ms) on present | Late | LATE |
| Long-press on absent | Late (showed up late; scoreable) | LATE |
| Long-press on late | Clear late → present | — |
| Long-press on excused | No-op | — |

Also supported:

- Undo last action (including late toggles)
- Mark remaining present
- Visible fallback buttons for accessibility
- Each action persists immediately as a metric entry
- Partial re-entry only queues **unmarked** players (already-marked players are skipped)

Stored values: present=100, late=50, absent=0, excused=-1 (exempt from attendance rate).

#### Re-entry when attendance is complete (done state)

When every active player already has an attendance entry:

1. Do **not** open the swipe deck
2. Show attendance status for all players (maintenance list) so any status can be adjusted
3. Primary path: **Continue to scoring**

### 5. Score metrics (player cards)

For each non-attendance metric on the session:

1. Build the deck from **eligible** players only: `present` and `late`
2. Hide `absent` and `excused`
3. Show one player card; enter the value (controls depend on metric type)
4. Save → auto-advance to the next player
5. Skip allowed

### 6. Done / close session

Session summary shows attendance breakdown and per-metric coverage. **Complete & close session** sets status to `closed` and returns to the Quick Insert gate. Closed sessions stay in Sessions history but are not offered for resume until reopened.

Season rankings continue to use the existing scoring formula; excused attendance remains exempt.

## Session status

| Status | Meaning |
|---|---|
| `open` | In progress; Quick Insert can resume |
| `closed` | Finished; history only until reopened |

Legacy sessions without `status` migrate to `open`.

## Values reference

| Status | Value | Scoreable for session metrics |
|---|---|---|
| present | 100 | Yes |
| late | 50 | Yes |
| absent | 0 | No |
| excused | -1 | No |
