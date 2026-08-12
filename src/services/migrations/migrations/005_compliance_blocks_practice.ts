import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type {
  ComplianceRequirement,
  PlayerComplianceState,
} from '../../../types';
import { normalizeComplianceRequirement } from '../../../utils/normalizeCompliance';

const RED_CARD_SITOUT: ComplianceRequirement = {
  id: 'req_red_card_sitout',
  name: 'Red card sit-out',
  kind: 'disciplinary',
  blocksPlay: true,
  blocksPractice: false,
  description:
    'Flag after a red card; leave incomplete until the player has sat out the next match',
  sortOrder: 4,
};

function migrateRequirementsList(
  list: ComplianceRequirement[],
): { next: ComplianceRequirement[]; changed: boolean; seededRedCard: boolean } {
  let changed = false;
  let seededRedCard = false;
  const next = list.map((raw) => {
    const hadPractice = Object.prototype.hasOwnProperty.call(
      raw,
      'blocksPractice',
    );
    const normalized = normalizeComplianceRequirement(raw);
    if (!hadPractice || raw.kind !== normalized.kind) {
      changed = true;
    }
    return normalized;
  });

  if (!next.some((r) => r.id === RED_CARD_SITOUT.id)) {
    const maxOrder = next.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);
    next.push({
      ...RED_CARD_SITOUT,
      sortOrder: Math.max(maxOrder + 1, RED_CARD_SITOUT.sortOrder),
    });
    changed = true;
    seededRedCard = true;
  }

  return { next, changed, seededRedCard };
}

/**
 * When we seed the red-card sit-out, mark it complete for existing players so
 * the whole roster does not suddenly become match-ineligible.
 */
function clearRedCardForRoster(
  ctx: MigrationContext,
  complianceKey: string,
): boolean {
  const state = ctx.getJson<PlayerComplianceState>(complianceKey);
  if (state == null || typeof state !== 'object' || Array.isArray(state)) {
    return false;
  }
  const now = new Date().toISOString();
  let changed = false;
  const next: PlayerComplianceState = { ...state };
  for (const playerId of Object.keys(next)) {
    const playerState = { ...(next[playerId] ?? {}) };
    if (playerState[RED_CARD_SITOUT.id]?.complete === true) continue;
    playerState[RED_CARD_SITOUT.id] = {
      complete: true,
      completedAt: now,
      note: 'Cleared on disciplinary requirement seed',
    };
    next[playerId] = playerState;
    changed = true;
  }
  if (changed) ctx.setJson(complianceKey, next);
  return changed;
}

function migrateKey(
  ctx: MigrationContext,
  requirementsKey: string,
  complianceKey: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown>(requirementsKey);
  if (raw == null) {
    return { touched: false, note: `${requirementsKey}: absent` };
  }
  if (!Array.isArray(raw)) {
    return { touched: false, note: `${requirementsKey}: not an array` };
  }
  const { next, changed, seededRedCard } = migrateRequirementsList(
    raw as ComplianceRequirement[],
  );
  if (changed) {
    ctx.setJson(requirementsKey, next);
  }
  let cleared = false;
  if (seededRedCard) {
    cleared = clearRedCardForRoster(ctx, complianceKey);
  }
  if (!changed && !cleared) {
    return { touched: false, note: `${requirementsKey}: already current` };
  }
  const bits = [
    changed ? 'backfilled blocksPractice + disciplinary' : null,
    cleared ? 'cleared red-card for roster' : null,
  ].filter(Boolean);
  return {
    touched: true,
    note: `${requirementsKey}: ${bits.join('; ')}`,
  };
}

/**
 * v5 — Compliance: ensure `blocksPractice` exists; seed red-card sit-out.
 * Updates unscoped + active-team scoped blobs.
 */
export function migration005ComplianceBlocksPractice(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateKey(
    ctx,
    STORAGE_KEYS.COMPLIANCE_REQUIREMENTS,
    STORAGE_KEYS.PLAYER_COMPLIANCE,
  );
  if (unscoped.touched) changed = true;
  notes.push(unscoped.note);

  let teamId = '';
  try {
    teamId = (ctx.storage.getItem(ACTIVE_TEAM_KEY) ?? '').trim();
  } catch {
    teamId = '';
  }
  if (!teamId) {
    const team = ctx.getJson<{ id?: string }>(STORAGE_KEYS.TEAM);
    teamId = team?.id?.trim() ?? '';
  }

  if (teamId) {
    const scoped = migrateKey(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.COMPLIANCE_REQUIREMENTS),
      scopedStorageKey(teamId, STORAGE_KEYS.PLAYER_COMPLIANCE),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped compliance blob.');
  }

  if (!changed) {
    notes.push('No compliance blobs needed updates.');
  }
  ctx.log(`005: ${notes.join(' | ')}`);
  return { changed, notes };
}
