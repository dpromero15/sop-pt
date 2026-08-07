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
- If proposed work needs a **different** semver than the open release line and Ready-to-ship (or unreleased) work exists, **ship the current PR first** — do not mix next-version features onto the current branch (see working-files / github-prs skills).

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

## Cross-session working ledger

Root [`WORKING.md`](../../WORKING.md) is the handoff file across agent chats for the active release:

- Move finished issues to **Ready to ship** before ending a coding session.
- Release PRs batch every Ready-to-ship issue into one **Closes** section (see skills below).
- After merge, clear shipped rows and retarget the ledger if the release line changes.
- **Version boundary:** same-version work batches on the open line; work that needs the next MINOR/MAJOR (or a feature while a PATCH line is open) waits until the current Ready-to-ship PR ships.

Skills: [`.cursor/skills/working-files/SKILL.md`](../../.cursor/skills/working-files/SKILL.md), [`.cursor/skills/github-prs/SKILL.md`](../../.cursor/skills/github-prs/SKILL.md).

## Pull requests and closing issues

Follow [`.cursor/skills/github-prs/SKILL.md`](../../.cursor/skills/github-prs/SKILL.md):

- Read `WORKING.md` Ready to ship before `gh pr create`.
- Close completed issues **only** via PR merge keywords (`Closes #N`).
- Never `gh issue close` for work finished in a PR.
- Run QA (`npm run lint`, `npm test`, smoke) and get **explicit human approval** before opening the PR.
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
