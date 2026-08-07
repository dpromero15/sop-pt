# Version control SOP

Keep releases, branches, labels, and docs aligned so every version is traceable.

## Semantic versioning

Use **MAJOR.MINOR.PATCH** on the SPA (`package.json` root).

| Bump | When | Examples |
|---|---|---|
| **MAJOR** (`X.0.0`) | Breaking data/API contracts or a large product rewrite | Storage model redesign |
| **MINOR** (`x.Y.0`) | New features that stay backward-compatible | Session logger, team management |
| **PATCH** (`x.y.Z`) | Bug fixes, docs, small UX polish with no feature scope | Attendance queue not advancing |

Rules:

- One release line at a time (finish or park `release/vX.Y.Z` before starting the next).
- Patch releases fix the **latest** minor (e.g. `2.1.1` after `2.1.0`).
- Bump the root SPA version for user-facing app changes.
- Bump `services/api/package.json` only when the API contract or service behavior changes.
- Keep `README.md` **Version:** in sync with the root `package.json`.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable shipped history (merge via PR only) |
| `release/vX.Y.Z` | All work for that version until the release PR merges |
| `fix/…` or `chore/…` | Optional short-lived branches off the active release branch |

Conventions:

- Name the release branch exactly `release/vX.Y.Z` matching the version you are shipping.
- Do feature/fix work on that release branch (or a short branch merged into it).
- Never force-push `main` or shared release branches unless explicitly requested.
- Do not commit secrets (`.env`, credentials).

## GitHub labels and issues

- Create a version label (`vX.Y.Z`) for every release cycle.
- Tag every issue and PR for that cycle with the version label.
- Use `epic` for grouping epics; stories/bugs get `enhancement`, `bug`, or `documentation`.
- Plan MINOR/MAJOR work with OKRs under `docs/okrs/` before opening the backlog.

## Pull requests and closing issues

Follow [`.cursor/skills/github-prs/SKILL.md`](../../.cursor/skills/github-prs/SKILL.md):

- Close completed issues **only** via PR merge keywords (`Closes #N`).
- Never `gh issue close` for work finished in a PR.
- Release PRs include Summary, Test plan, and **Closes** for every finished issue.

### Release PR checklist

1. Version bumped in root `package.json` (and API package if needed).
2. `README.md` version line updated.
3. Docs/OKRs updated when the cycle introduced planned work.
4. `npm run lint` and `npm test` pass.
5. PR title like `Release vX.Y.Z — short reason`.
6. PR body has **Closes** for every finished issue (bugs included).

## Commit messages

- Imperative, concise, explain **why** when not obvious.
- Prefer one logical change per commit on release branches when practical.
- Examples: `Fix attendance swipe queue reset after save.`, `Release v2.1.1 attendance advance fix.`

## Patch hotfix flow (example: v2.1.1)

1. Branch `release/v2.1.1` from the shipped `release/v2.1.0` (or `main` if already merged).
2. Fix the bug; add/update tests when logic is extractable.
3. Bump version to `2.1.1`; update README.
4. Open PR → `main` (or into the integration branch your team uses) with `Closes #<bug>`.
5. Merge; label leftover follow-ups for the next minor if needed.
