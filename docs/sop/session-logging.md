# SOP — Session logging (sideline)

## What

Standard procedure for logging a practice, match, or fitness test on a phone.

## Why

Coaches need one-handed speed: take attendance without menus, then score only players who are here.

## How

### 1. Create session

Create a session with date, time, title, and type (`practice` | `match` | `fitness_test`).

On create, the session metric plan is seeded with **attendance only** (`metricIds` starts with the attendance metric id). Attendance cannot be removed.

### 2. Plan metrics

Optionally attach metrics from the team catalog:

- **Measured** — drills/times/ratings (e.g. 40m dash, juggling, coach rating)
- **Game** — match counts (e.g. goals, assists, tackles)

Match sessions may suggest a default game pack (goals / assists / tackles); the coach confirms or edits.

### 3. Take attendance (swipe deck)

Work the full roster one card at a time:

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

Stored values: present=100, late=50, absent=0, excused=-1 (exempt from attendance rate).

### 4. Score metrics (player cards)

For each non-attendance metric on the session:

1. Build the deck from **eligible** players only: `present` and `late`
2. Hide `absent` and `excused`
3. Show one player card; enter the value (controls depend on metric type)
4. Save → auto-advance to the next player
5. Skip allowed

### 5. Done

Session summary shows attendance breakdown and per-metric coverage. Season rankings continue to use the existing scoring formula; excused attendance remains exempt.

## Values reference

| Status | Value | Scoreable for session metrics |
|---|---|---|
| present | 100 | Yes |
| late | 50 | Yes |
| absent | 0 | No |
| excused | -1 | No |
