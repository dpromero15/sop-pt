import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type { ComplianceRequirement } from '../../../types';
import { normalizeComplianceRequirement } from '../../../utils/normalizeCompliance';
import { RECOMMENDED_COMPLIANCE_REQUIREMENTS } from '../../../utils/complianceConsequences';

const LEGACY_DEFAULT_NAMES: Record<string, string[]> = {
  req_sports_physical: ['Sports Physical', 'Physical'],
  req_grade_check: ['Grade Check'],
  req_crhs_policy: ['CRHS Policy'],
  req_chssaa_policy: ['CHSSAA Policy'],
  req_season_fee: ['Season Fee', 'Team fee'],
};

function adaptRequirement(row: ComplianceRequirement): ComplianceRequirement {
  let item = normalizeComplianceRequirement(row);
  const rec = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find((x) => x.id === item.id);
  if (rec) {
    const knownNames = LEGACY_DEFAULT_NAMES[rec.id] ?? [rec.name];
    const rename = knownNames.includes(item.name);
    item = {
      ...item,
      name: rename ? rec.name : item.name,
      kind: rec.kind,
      blocksPlay: rec.blocksPlay,
      blocksPractice: rec.blocksPractice,
      blocksEquipment: rec.blocksEquipment,
      description: rec.description ?? item.description,
    };
  } else if (/grade\s*check/i.test(item.name) && item.kind !== 'eligibility') {
    item = { ...item, kind: 'eligibility', blocksPlay: true };
  }
  return item;
}

function migrateRequirementsKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<ComplianceRequirement[] | null>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  if (!Array.isArray(raw)) {
    return { touched: false, note: `${key}: invalid` };
  }

  const next = raw.map(adaptRequirement);
  const have = new Set(next.map((r) => r.id));
  let maxOrder = next.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);
  for (const rec of RECOMMENDED_COMPLIANCE_REQUIREMENTS) {
    if (have.has(rec.id)) continue;
    maxOrder += 1;
    next.push({ ...rec, sortOrder: maxOrder });
  }

  if (JSON.stringify(next) === JSON.stringify(raw)) {
    return { touched: false, note: `${key}: already current` };
  }

  ctx.setJson(key, next);
  return { touched: true, note: `${key}: consequences + recommended items` };
}

/**
 * v12 — Compliance consequences (blocksEquipment) and CRHS recommended set.
 * Converts Grade Check-named items to eligibility (inverted flag).
 */
export function migration012ComplianceConsequences(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateRequirementsKey(
    ctx,
    STORAGE_KEYS.COMPLIANCE_REQUIREMENTS,
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
    const scoped = migrateRequirementsKey(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.COMPLIANCE_REQUIREMENTS),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped blob.');
  }

  if (!changed) {
    notes.push('No compliance blobs needed updates.');
  }
  ctx.log(`012: ${notes.join(' | ')}`);
  return { changed, notes };
}
