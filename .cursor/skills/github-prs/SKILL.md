---
name: github-prs
description: >-
  GitHub pull request conventions for this repo, including linking and
  auto-closing issues, batching Ready-to-ship work from WORKING.md, version
  boundaries (ship before bumping), QA, and human approval before create. Use
  when creating a PR with gh pr create, shipping a release, finishing a backlog
  of GitHub issues, or when new work needs a different semver than the open
  release line. Never use gh issue close for completed work — close issues by
  PR strictly.
---

# GitHub PRs and issue closing

## Strict rule: close issues by PR only

Completed issues must be closed **by the pull request**, not separately.

- **Never** run `gh issue close` (or close in the GitHub UI) for backlog work finished in a PR.
- **Always** put GitHub closing keywords in the PR body so **merge** closes the issues.
- If the Closes section is missing, fix it on the **open** PR with `gh pr edit` before merge. Do not batch-close with the CLI after the fact.

## Hard rule: no PR until QA + human approval

After finishing issue work, **stop**. Do **not** run `gh pr create`, and do **not** push solely to open a PR, until the pre-PR gate below is complete.

Finishing implementation ≠ permission to open a PR.

### Pre-PR gate checklist (required order)

Copy and complete:

```
Pre-PR gate:
- [ ] 1. QA evidence — npm run lint + npm test (pass); smoke Ready-to-ship acceptance; note results for the human
- [ ] 2. WORKING.md sync — Ready to ship + Suggested PR Closes match what will close
- [ ] 3. Version sync — VERSION.md + package.json + README Version: all match the release (and WORKING.md Release / branch)
- [ ] 4. Ask human — explicitly request approval to open the PR; wait for a clear yes
- [ ] 5. Only then — push if needed + gh pr create with Summary / Test plan / Closes
```

If the human has not approved, **do not** create the PR.

## Batch shipping from WORKING.md

Cross-session context lives in repo-root [`WORKING.md`](../../../WORKING.md). Full maintenance rules: [working-files skill](../working-files/SKILL.md).

Canonical version: [`VERSION.md`](../../../VERSION.md).

When opening a release / feature PR:

1. **Read `WORKING.md` first** (Ready to ship + Suggested PR Closes).
2. Treat every **Ready to ship** issue as in-scope for this PR unless the human explicitly drops some.
3. You may also `gh issue list` / check labels, but **do not omit** a Ready-to-ship issue without asking.
4. After merge (or when asked to clean up), update `WORKING.md`: remove shipped rows, refresh Suggested PR Closes / header; keep `VERSION.md` accurate.

This is how multiple enhancements from different chats ship in one PR without lost context.

## Version boundary → recommend PR first

If the user wants to start work that **does not fit** the active release version (see working-files **Version boundary**):

1. **Stop** — do not implement the new-version work on the current release branch.
2. **Recommend** shipping the current line first when Ready to ship (or unreleased work) exists: run this skill’s pre-PR gate, then open the release PR after human approval.
3. After merge (or explicit human decision to park current work), retarget version / branch / `WORKING.md` / `VERSION.md`, then start the new work on the new line.

Same-version features batch into one PR via Ready to ship. Next MINOR/MAJOR (or a MINOR while a PATCH line is open) waits until the current PR ships.

## Required: close linked issues from the PR

When a PR completes one or more GitHub issues, the PR body **must** include closing keywords.

Use one of: `Closes`, `Fixes`, or `Resolves` (case-insensitive).

### Checklist before `gh pr create`

1. Complete the **Pre-PR gate checklist** above (QA → WORKING.md → VERSION sync → human approval).
2. Confirm with human if any Ready-to-ship issue should be excluded; add any extras they want.
3. Add a **Closes** section with every finished issue number.
4. Do not create the PR until the Closes section is complete.
5. Do not close those issues yourself after opening or merging the PR.

### PR body template

```markdown
## Summary
- …

## Test plan
- [ ] …

## Closes
Closes #12
Closes #13
Closes #14
```

Prefer one `Closes #N` per line (matches WORKING.md Suggested PR Closes).

Epics and child stories that are fully done in the same PR should all be listed.

## Before merge

If the PR is still open and the Closes section is missing or incomplete:

```bash
gh pr edit <pr-number> --body "$(cat <<'EOF'
…full body including ## Closes …
EOF
)"
```

Verify with `gh pr view <pr-number> --json body -q .body` that every finished issue appears under **Closes**.

## After merge

1. Update `WORKING.md`: clear shipped **Ready to ship** entries; fix **Still open** / header if needed.
2. Confirm `VERSION.md` still matches what shipped (or retarget for the next line).
3. Never batch-close issues with `gh issue close`.
4. Only then start work that required the next version bump.

## Do not

- Run `gh issue close` for work finished by a PR
- Open a PR because “implementation is done” without QA evidence **and** explicit human approval
- Ship a release/feature PR that implements backlog issues without a **Closes** section
- Open a PR without reading `WORKING.md` when Ready-to-ship entries exist
- Ship with mismatched `VERSION.md` / `package.json` / README **Version:**
- Start next-version feature work on the current release branch while Ready-to-ship work is still unshipped — recommend PR first
- Assume labels alone will close issues
- Close issues that are only partially done — leave those open or note follow-ups in the PR / WORKING.md **In progress**
