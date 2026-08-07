# Working ledger — release v2.2.0

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.2.0` |
| **Branch** | `release/v2.2.0` |
| **Last updated** | 2026-08-07 |

---

## Ready to ship

Implemented on the release branch; include in the next PR **Closes** section.

### #54 — Re-entering session with attendance: done state + maintenance edit
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Completeness from stored `m_attendance` entries; swipe only for unmarked; review/maintenance list when complete.
- **Touchpoints:** `QuickInsertView.tsx`, `AttendanceSwipeDeck.tsx`, `AttendanceMaintenanceList.tsx`, `sessionMetrics.ts`, `docs/sop/session-logging.md`

### #55 — Quick Insert: choose new session or resume open (unclosed) session
- **Status:** implemented (verify acceptance before PR)
- **Notes:** `Session.status` `open` \| `closed`; Quick Insert gate; new title `New session - YYYY-MM-DD`; Complete & close on summary; Sessions reopen handoff.
- **Touchpoints:** `types.ts`, `sessionMetrics.ts`, `localJsonAdapter.ts`, `QuickInsertView.tsx`, `SessionsView.tsx`, `App.tsx`, storage docs + SOP

### #56 — Rankings: category filter should scope metric tags
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Category tabs scope metric tags; label composite vs specific metric sort via `rankingsFilter.ts`.
- **Touchpoints:** `RankingsView.tsx`, `rankingsFilter.ts`, `rankingsFilter.test.ts`

**Suggested PR Closes:**
```
Closes #54
Closes #55
Closes #56
```

---

## In progress

_None._

---

## Still open (not ready)

| Issue | Title | Notes |
|---|---|---|
| #53 | VERSION tracking file + strict QA/human approval gate before PRs | github-prs skill now has QA + human-approval gate + WORKING.md batching; root `VERSION` file still outstanding |

---

## Agent notes (do not lose)

- Do **not** `gh issue close` for finished work — close only via PR `Closes #N`.
- Demo seed sessions (`sess_1`–`sess_3`) are **closed** so Quick Insert starts at the gate.
- Legacy sessions without `status` migrate to **open**.
- Uncommitted / mixed work may already be on `release/v2.2.0` — run `npm run lint` + `npm test` before PR.
- After the release PR merges, move shipped items out of **Ready to ship** (or clear the section) and bump this ledger for the next release line.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `gh issue view N`; confirm the issue’s version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version (next MINOR/MAJOR, or feature while on a PATCH line) and Ready to ship is non-empty → ship the current PR first; do not mix versions.
3. **Finish an issue in a session** — move it to **Ready to ship** (or **In progress** if partial) with short notes; set **Last updated**.
4. **Ship a PR** — follow github-prs skill: QA → ask human → PR body Closes = every **Ready to ship** issue (plus any extras human confirms).
5. **After merge** — clear shipped rows; update release/branch header if starting a new line.
