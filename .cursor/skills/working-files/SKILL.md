---
name: working-files
description: >-
  Maintains WORKING.md as the cross-session outstanding-work ledger for the
  active release. Use when finishing an issue, ending a chat after coding,
  starting work on a labeled release issue, handing off between agents,
  deciding whether new work fits the current version or needs a bump, or
  preparing a multi-issue PR so Ready-to-ship context is not lost.
---

# Working files (cross-session handoff)

## Source of truth

Repo root [`WORKING.md`](../../../WORKING.md) tracks outstanding / ready-to-ship work for the current release branch. Chat history is ephemeral; **this file is not**.

Read it at the start of release work. Update it before the user closes the chat when issue status changed.

## Version boundary (ship before bumping)

One release line at a time. Before implementing anything new, classify the work against the **active** release in `WORKING.md` / `package.json` / `release/vX.Y.Z`.

| Semver | Belongs on active line when… |
|---|---|
| **PATCH** | Active line is that same `x.y.Z` (hotfix) |
| **MINOR** | Active line is that same `x.Y.0` feature release |
| **MAJOR** | Active line is that same `X.0.0` |

**Fits active version** (same `vX.Y.Z` label / same bump class as the open release) → implement on the current branch; update `WORKING.md`.

**Needs a different version** (new feature that should be the *next* MINOR/MAJOR, wrong label, or MINOR/MAJOR while a PATCH line is open) → **do not start coding**.

1. Tell the user the work needs a version bump / new release line (cite current vs proposed version).
2. If **Ready to ship** is non-empty (or the branch has unreleased release work), **recommend closing out**: QA → human-approved PR for the current line (see [github-prs](../github-prs/SKILL.md)) **before** continuing.
3. Only after that PR is approved/merged (or the human explicitly parks/discards current work) may you retarget `WORKING.md`, bump version/branch/label, and start the new work.

Do not mix two semver targets on one release branch. Do not silently bump `package.json` mid-cycle to absorb unrelated next-version features.

## When to update (required)

Update `WORKING.md` when any of these happen:

1. An issue is **fully implemented** in this session → move to **Ready to ship** (with notes + touchpoints).
2. Work is **partial** → put or keep under **In progress** with what’s done / what’s left.
3. New follow-ups appear → add under **Still open** or **Agent notes**.
4. User is about to **end the chat** after coding → ensure the ledger matches reality (do not leave Ready-to-ship stale).
5. A release PR **merges** → remove shipped issues from Ready to ship; refresh header if the release line changes.
6. Version boundary triggered → note under **Agent notes** that next work waits on shipping `vX.Y.Z` (optional).

Also set **Last updated** (ISO date) on every edit.

## Section rules

| Section | Meaning |
|---|---|
| **Ready to ship** | Implemented on the release branch; must appear in the next PR `Closes` list |
| **In progress** | Started but not acceptance-complete |
| **Still open** | Backlog for this release (or deferred) — not implemented |
| **Agent notes** | Durable context other sessions need (migrations, caveats, QA gaps, version-boundary waits) |

Keep entries short. Prefer issue number + title + bullets over essays.

## Template for a Ready-to-ship entry

```markdown
### #N — <issue title>
- **Status:** implemented (verify acceptance before PR)
- **Notes:** <1–3 bullets: behavior shipped>
- **Touchpoints:** `<paths>`
```

Keep the **Suggested PR Closes** fenced block in sync with every Ready-to-ship issue:

```markdown
**Suggested PR Closes:**
\`\`\`
Closes #N
Closes #M
\`\`\`
```

## Starting a session

1. Read `WORKING.md`.
2. Confirm branch matches the ledger (`git branch --show-current` vs **Branch** field) and `package.json` version.
3. If the user names an issue, `gh issue view <N>` and check its version label vs **Release**.
4. Run the **Version boundary** check. If the work needs a bump and Ready-to-ship (or open release work) exists → recommend ship PR first; do not implement yet.
5. Prefer picking up **In progress** or implementing **Still open** on the *same* version over redoing Ready-to-ship items.

## Ending a session (checklist)

Before stopping after issue work:

- [ ] `WORKING.md` sections reflect current truth
- [ ] New implementations are under **Ready to ship** (or **In progress** if incomplete)
- [ ] **Suggested PR Closes** lists every Ready-to-ship issue
- [ ] **Last updated** bumped
- [ ] Do **not** `gh issue close` — issues close only via PR (see github-prs skill)

## Relationship to PRs

When the user asks to open a PR / ship the release, follow [github-prs](../github-prs/SKILL.md). That skill **must** read `WORKING.md` and close every **Ready to ship** issue in the PR body unless the human explicitly excludes some.
