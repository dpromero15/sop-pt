# Working ledger — release v2.2.1

Cross-session handoff for agents and humans. **Update this file before ending a chat** when issue work progresses. The [working-files skill](.cursor/skills/working-files/SKILL.md) and [github-prs skill](.cursor/skills/github-prs/SKILL.md) read this when continuing work or opening a PR.

| Field | Value |
|---|---|
| **Release** | `2.2.1` |
| **Branch** | `release/v2.2.1` |
| **Last updated** | 2026-08-07 |

Canonical version file: [`VERSION.md`](VERSION.md) (must match `package.json` + README).

---

## Ready to ship

### #53 — Add VERSION tracking file + strict QA/human approval gate before PRs
- **Status:** implemented (verify acceptance before PR)
- **Notes:** Root `VERSION.md`; bump checklist includes VERSION + package.json + README; github-prs hard pre-PR gate (QA → ask human → wait → create); SOP/rules updated.
- **Touchpoints:** `VERSION.md`, `docs/sop/version-control.md`, `.cursor/rules/version-control.mdc`, `.cursor/skills/github-prs/SKILL.md`, `WORKING.md`

**Suggested PR Closes:**
```
Closes #53
```

---

## In progress

_None._

---

## Still open (not ready)

| Issue | Title | Notes |
|---|---|---|
| #58 | Metric edit + aggregation + calculated fields | Labeled **v2.3.0** — next MINOR; do not implement on this PATCH line |

---

## Agent notes (do not lose)

- Do **not** `gh issue close` for finished work — close only via PR `Closes #N`.
- v2.2.0 shipped via [PR #57](https://github.com/dpromero15/sop-pt/pull/57) (closed #54–#56).
- On every version bump update **all three**: `VERSION.md`, root `package.json`, `README.md` **Version:**
- Version boundary: #58 waits for `release/v2.3.0` after this patch ships.

---

## How to use

1. **Start of chat / “work issue #N”** — read this file + `VERSION.md` + `gh issue view N`; confirm version label matches **Release**.
2. **Version boundary** — if the work needs a *new* version and Ready to ship is non-empty → ship the current PR first.
3. **Finish an issue** — move to **Ready to ship**; bump **Last updated**.
4. **Ship a PR** — github-prs: QA → ask human → `Closes` = Ready to ship.
5. **After merge** — clear shipped rows; retarget header / `VERSION.md` for the next line.
