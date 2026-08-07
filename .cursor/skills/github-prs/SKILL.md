---
name: github-prs
description: >-
  GitHub pull request conventions for this repo, including linking and
  auto-closing issues. Use when creating a PR with gh pr create, shipping a
  release, or finishing a backlog of GitHub issues. Never use gh issue close
  for completed work — close issues by PR strictly.
---

# GitHub PRs and issue closing

## Strict rule: close issues by PR only

Completed issues must be closed **by the pull request**, not separately.

- **Never** run `gh issue close` (or close in the GitHub UI) for backlog work finished in a PR.
- **Always** put GitHub closing keywords in the PR body so **merge** closes the issues.
- If the Closes section is missing, fix it on the **open** PR with `gh pr edit` before merge. Do not batch-close with the CLI after the fact.

## Required: close linked issues from the PR

When a PR completes one or more GitHub issues, the PR body **must** include closing keywords.

Use one of: `Closes`, `Fixes`, or `Resolves` (case-insensitive).

### Checklist before `gh pr create`

1. List issues this PR finishes (`gh issue list`, labels, or conversation context).
2. Add a **Closes** section to the PR body with every finished issue number.
3. Do not create the PR until the Closes section is complete.
4. Do not close those issues yourself after opening or merging the PR.

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

For many issues, list them explicitly (preferred) or group:

```markdown
## Closes
Closes #2, closes #3, closes #4
```

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

## Do not

- Run `gh issue close` for work finished by a PR
- Ship a release/feature PR that implements backlog issues without a **Closes** section
- Assume labels alone will close issues
- Close issues that are only partially done — leave those open or note follow-ups in the PR
