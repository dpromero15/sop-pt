---
name: working-files
description: >-
  Maintains WORKING.md as the cross-session outstanding-work ledger for the
  active release. Use when finishing an issue, ending a chat after coding,
  starting work on a labeled release issue, handing off between agents,
  deciding whether new work fits the current version or needs a bump, or
  preparing a multi-issue PR so Ready-to-ship context is not lost. Requires
  every tracked work item to have a GitHub issue before it stays in WORKING.md.
---

# Working files (cross-session handoff)

## Source of truth

Repo root [`WORKING.md`](../../../WORKING.md) tracks outstanding / ready-to-ship work for the current release branch. Chat history is ephemeral; **this file is not**.

GitHub **issues** are the durable backlog the human sees in the UI. `WORKING.md` is the agent handoff ledger — it must **mirror** issues, not replace them.

Read both at the start of release work. Update `WORKING.md` before the user closes the chat when issue status changed.

## Hard rule: capture work in GitHub issues

**No orphan ledger rows.** Every item under **Ready to ship**, **In progress**, or **Still open** must have a real GitHub issue (`#N`) with:

- A clear title matching the ledger heading
- Acceptance criteria (or notes) in the issue body
- The correct version label (`vX.Y.Z`) for the release line that will ship it
- `enhancement` / `bug` / etc. as appropriate

### When to file (or reuse) an issue

| Moment | Required action |
|---|---|
| Starting new work with no issue | **Create** the issue + version label **before** coding (or in the same turn before the first commit) |
| Discovering follow-up work mid-session | **Create** an issue, then add it under Still open / In progress |
| Implementing without an issue (legacy / chat-only) | **Create** issues retrospectively **before** marking Ready to ship or opening a PR |
| Parking work for a later release | Issue stays **open**; label the **future** `vX.Y.Z`; list under Still open |
| Shipping | PR `Closes #N` (never `gh issue close` for PR-bound work) |

### Do not

- Leave Ready-to-ship / In progress / Still open entries as title-only bullets without `#N`
- Write `Suggested PR Closes: (none)` when Ready to ship is non-empty — that means issues are missing; **file them first**
- Rely on chat history or Agent notes alone for backlog the human should see on GitHub
- Close finished issues with `gh issue close` — close via PR only ([github-prs](../github-prs/SKILL.md))

### Labels

- Ensure label `vX.Y.Z` exists (`gh label create vX.Y.Z --description "Release vX.Y.Z" --color 0E8A16`) before filing if missing
- One primary version label per issue; do not mix two release lines on one issue

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
3. File/label the deferred work as an issue on the **future** version (Still open) so it is visible while waiting.
4. Only after that PR is approved/merged (or the human explicitly parks/discards current work) may you retarget `WORKING.md` / `VERSION.md`, bump version/branch/label, and start the new work.

Do not mix two semver targets on one release branch. Do not silently bump `package.json` mid-cycle to absorb unrelated next-version features. When the release line changes, update **`VERSION.md` + `package.json` + README Version:** together.

## When to update (required)

Update `WORKING.md` when any of these happen:

1. An issue is **fully implemented** in this session → move to **Ready to ship** (with `#N`, notes + touchpoints).
2. Work is **partial** → put or keep under **In progress** with what’s done / what’s left (must include `#N`).
3. New follow-ups appear → **create GitHub issue first**, then add under **Still open** or **Agent notes**.
4. User is about to **end the chat** after coding → ensure the ledger matches reality **and** every row has `#N` (do not leave Ready-to-ship stale or untracked).
5. A release PR **merges** → remove shipped issues from Ready to ship; refresh header if the release line changes.
6. Version boundary triggered → note under **Agent notes** that next work waits on shipping `vX.Y.Z` (optional); keep future work as open issues.

Also set **Last updated** (ISO date) on every edit.

## Section rules

| Section | Meaning |
|---|---|
| **Ready to ship** | Implemented on the release branch; must appear in the next PR `Closes` list |
| **In progress** | Started but not acceptance-complete |
| **Still open** | Backlog for this or a later release — not implemented; still an open GitHub issue |
| **Agent notes** | Durable context other sessions need (migrations, caveats, QA gaps, version-boundary waits) |

Keep entries short. Prefer **`#N — title`** + bullets over essays.

## Template for a Ready-to-ship entry

```markdown
### #N — <issue title>
- **Status:** implemented (verify acceptance before PR)
- **Notes:** <1–3 bullets: behavior shipped>
- **Touchpoints:** `<paths>`
```

Same heading shape for **In progress** and **Still open** (`### #N — title`).

Keep the **Suggested PR Closes** fenced block in sync with every Ready-to-ship issue:

```markdown
**Suggested PR Closes:**
\`\`\`
Closes #N
Closes #M
\`\`\`
```

If Ready to ship is empty, Suggested PR Closes may be omitted or show an empty fence. If Ready to ship is **non-empty**, Suggested PR Closes **must** list those issue numbers (never `(none)`).

## Starting a session

1. Read `WORKING.md` and `VERSION.md`.
2. Confirm branch matches the ledger (`git branch --show-current` vs **Branch** field) and that `VERSION.md` / `package.json` / README agree.
3. `gh issue list --state open --label vX.Y.Z` (active release) and reconcile any open issues missing from the ledger (and any ledger rows missing `#N`).
4. If the user names an issue, `gh issue view <N>` and check its version label vs **Release**.
5. Run the **Version boundary** check. If the work needs a bump and Ready-to-ship (or open release work) exists → recommend ship PR first; do not implement yet.
6. Prefer picking up **In progress** or implementing **Still open** on the *same* version over redoing Ready-to-ship items.

## Ending a session (checklist)

Before stopping after issue work:

- [ ] Every Ready / In progress / Still open row has `### #N — title`
- [ ] Matching GitHub issues exist, are open (unless closed by a merged PR), and have the right `vX.Y.Z` label
- [ ] `WORKING.md` sections reflect current truth
- [ ] New implementations are under **Ready to ship** (or **In progress** if incomplete)
- [ ] **Suggested PR Closes** lists every Ready-to-ship issue (no `(none)` while Ready is non-empty)
- [ ] **Last updated** bumped
- [ ] Do **not** `gh issue close` — issues close only via PR (see github-prs skill)

## Relationship to PRs

When the user asks to open a PR / ship the release, follow [github-prs](../github-prs/SKILL.md). That skill **must** read `WORKING.md` and close every **Ready to ship** issue in the PR body unless the human explicitly excludes some. If Ready-to-ship rows lack issue numbers, **file issues and update the PR Closes before asking to merge**.
