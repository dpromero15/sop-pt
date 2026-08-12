---
name: data-migrations
description: >-
  Versioned local (and import/hydrate) data migrations for SOP-PT. Use when
  changing Team/Player/Session/Metric shapes, localStorage keys, backup JSON,
  Firestore snapshot fields, or shipping a release that must adapt existing
  production browser/cloud data without errors. Covers adding migrations,
  bumping CURRENT_SCHEMA_VERSION, Admin repair UI, and boot-time runner.
---

# SOP-PT data migrations

Production users already have **localStorage** (and later Firestore) data.
Schema changes must ship with an **idempotent migration**, not a wipe.

## When this skill applies

- Adding/renaming/removing fields on stored domain types (`src/types.ts`)
- Changing `STORAGE_KEYS` or backup export shape
- Shipping UX that assumes new required fields (e.g. Team picker / header)
- Importing cloud snapshots or JSON backups that may be older than the app
- Any agent/human note like “existing users will break”

## Architecture (current)

| Layer | Path | Role |
|---|---|---|
| Version + types | `src/services/migrations/types.ts` | `CURRENT_SCHEMA_VERSION`, `SCHEMA_VERSION_KEY` |
| Registry | `src/services/migrations/registry.ts` | Ordered `MIGRATIONS` list |
| Runner | `src/services/migrations/runner.ts` | `runLocalMigrations`, `repairLocalMigrations`, `getMigrationStatus` |
| Steps | `src/services/migrations/migrations/NNN_*.ts` | One file per migration id |
| Boot | `src/main.tsx` | Runs migrations **before** React hydrate |
| Admin UI | `src/components/DataMigrationPanel.tsx` | Status + Run pending + Repair |
| After import | `hydrateCloudToLocal`, `importFullBackupJSON` | Reset version → re-run migrations |

Stored marker: localStorage key `stm_schema_version_v1` (JSON number).

## Hard rules

1. **Append only** — never reorder, renumber, or edit a shipped migration’s behavior in a breaking way. Fix with a **new** migration id.
2. **Idempotent** — re-running on already-migrated data must be safe (Repair button does this).
3. **No gaps** — migration ids are `1..N` contiguous; `CURRENT_SCHEMA_VERSION` must equal the last id.
4. **Boot-safe** — migrations must not depend on React, Firebase, or network.
5. **Prefer adapt over delete** — do not clear squads/entries to “fix” shapes.
6. **Document** — update `docs/architecture/storage.md` Migration notes when behavior changes.

## How to add a migration (checklist)

1. Implement `src/services/migrations/migrations/00N_short_name.ts` exporting `migration00N...(ctx) => MigrationResult`.
2. Append to `MIGRATIONS` in `registry.ts` with `id: N`.
3. Set `CURRENT_SCHEMA_VERSION = N` in `types.ts`.
4. Add/extend tests in `src/services/migrations/runner.test.ts` (and unit-test pure transforms).
5. Note the migration in `WORKING.md` Ready-to-ship / PR summary.
6. QA: load an **old** localStorage fixture (or Repair) and confirm UI has no runtime errors.

### Template

```ts
import type { MigrationContext, MigrationResult } from '../types';
import { STORAGE_KEYS } from '../../storage/storageKeys';

export function migration00NExample(ctx: MigrationContext): MigrationResult {
  const notes: string[] = [];
  let changed = false;
  // read → adapt → setJson when needed
  if (!changed) notes.push('Already current.');
  ctx.log(`00N: ${notes.join(' ')}`);
  return { changed, notes };
}
```

## Runtime UX

- **Automatic:** every page load runs pending migrations.
- **Admin → Data migrations:** shows stored vs expected version; **Run pending**; **Repair (re-run all)** with confirm.
- **Cloud hydrate / JSON import:** version reset to `0` then full migrate so imported legacy payloads adapt.

## Cloud / Firestore (follow-up contract)

Today the SPA is local-first; JIT Cloud Run sync hydrates/flushes the team snapshot (core collections + config blobs).
When changing cloud shapes:

1. Still add a **local** migration (hydrate writes local keys).
2. Prefer normalizing on API snapshot/bootstrap responses.
3. Optionally store `schemaVersion` on `teams/{teamId}` in a later release — do not invent a second local version scheme.

## Do not

- Put `VITE_DEV_SIMULATE_AUTH` or wipe scripts in migrations
- Bump `CURRENT_SCHEMA_VERSION` without a matching registry entry
- Rely only on lazy `getSessions()`-style fixes for release-critical shape changes (those remain as defense in depth; migrations are the durable path)
