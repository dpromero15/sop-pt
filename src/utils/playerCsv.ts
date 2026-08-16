import type { Player, PlayerPosition, PlayerRankingPool } from '../types';
import {
  birthYearFromAge,
  parseBirthYear,
  parsePlayerGrade,
} from './playerDemographics';
import {
  isPlayerPosition,
  playerPositionCodes,
} from './playerPositions';
import { normalizePublicId } from './playerPublicId';
import {
  PLAYER_RANKING_POOLS,
  defaultRankingPoolForPosition,
  isPlayerRankingPool,
} from './playerRankingPools';

export const PLAYER_CSV_HEADERS = [
  'name',
  'jerseyNumber',
  'position',
  'preferredFoot',
  'birthYear',
  'grade',
  'avatarUrl',
  'notes',
  'publicId',
  'rankingPool',
  'positions',
] as const;

const VALID_FEET = new Set(['Left', 'Right', 'Both']);

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((cell) => cell.trim());
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Headers plus one example row for coaches to fill in. */
export function buildPlayerCsvTemplate(): string {
  const example = [
    'Alex Example',
    '99',
    'CM',
    'Right',
    '2011',
    '10',
    '',
    'Sample player row — replace with your roster',
    '',
    'central-midfield',
    'CAM;ST',
  ];
  return (
    PLAYER_CSV_HEADERS.join(',') +
    '\n' +
    example.map(escapeCsvCell).join(',') +
    '\n'
  );
}

export type PlayerCsvImportRow = Omit<Player, 'id' | 'joinedDate'>;

export function parseAndValidatePlayerCsv(
  csvText: string,
  existingJerseyNumbers: Set<number>,
  existingPublicIds: Set<string> = new Set(),
): { ok: PlayerCsvImportRow[]; errors: string[]; skipped: number } {
  const ok: PlayerCsvImportRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    errors.push('CSV is empty.');
    return { ok, errors, skipped };
  }

  const headerCells = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex = (name: string) => headerCells.indexOf(name.toLowerCase());

  const nameIdx = colIndex('name');
  const jerseyIdx = colIndex('jerseyNumber');
  const positionIdx = colIndex('position');
  const rankingPoolIdx = colIndex('rankingPool');
  const footIdx = colIndex('preferredFoot');
  const birthYearIdx = colIndex('birthYear');
  const ageIdx = colIndex('age');
  const gradeIdx = colIndex('grade');
  const avatarIdx = colIndex('avatarUrl');
  const notesIdx = colIndex('notes');
  const publicIdIdx = colIndex('publicId');
  const extrasIdx = colIndex('positions');

  if (nameIdx < 0 || jerseyIdx < 0 || positionIdx < 0) {
    errors.push(
      'CSV must include name, jerseyNumber, and position header columns.',
    );
    return { ok, errors, skipped };
  }

  const seenJerseys = new Set(existingJerseyNumbers);
  const seenPublicIds = new Set<string>();
  for (const id of existingPublicIds) {
    const normalized = normalizePublicId(id);
    if (normalized) seenPublicIds.add(normalized);
  }
  const asOfYear = new Date().getFullYear();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cells = parseCsvLine(lines[i]);
    const name = (cells[nameIdx] || '').trim();
    const jerseyRaw = (cells[jerseyIdx] || '').trim();
    const positionRaw = (cells[positionIdx] || '').trim().toUpperCase();

    if (!name && !jerseyRaw && !positionRaw) {
      continue;
    }

    if (!name) {
      errors.push(`Row ${rowNum}: missing name.`);
      skipped += 1;
      continue;
    }

    const jerseyNumber = Number(jerseyRaw);
    if (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99) {
      errors.push(`Row ${rowNum}: invalid jerseyNumber "${jerseyRaw}".`);
      skipped += 1;
      continue;
    }

    if (seenJerseys.has(jerseyNumber)) {
      errors.push(
        `Row ${rowNum}: duplicate jersey number ${jerseyNumber} — skipped.`,
      );
      skipped += 1;
      continue;
    }

    if (!isPlayerPosition(positionRaw)) {
      errors.push(`Row ${rowNum}: invalid position "${positionRaw}".`);
      skipped += 1;
      continue;
    }

    let extraCodes: string[] = [];
    if (extrasIdx >= 0) {
      extraCodes = (cells[extrasIdx] || '')
        .split(/[;|,]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((code) => {
          if (isPlayerPosition(code)) return true;
          errors.push(
            `Row ${rowNum}: skipped unknown extra position "${code}".`,
          );
          return false;
        });
    }
    const positions = playerPositionCodes({
      position: positionRaw,
      positions: extraCodes,
    });

    let rankingPool: PlayerRankingPool =
      defaultRankingPoolForPosition(positionRaw);
    if (rankingPoolIdx >= 0) {
      const raw = (cells[rankingPoolIdx] || '').trim().toLowerCase();
      const byLabel = PLAYER_RANKING_POOLS.find(
        (pool) => pool.label.toLowerCase() === raw,
      )?.id;
      if (raw && !isPlayerRankingPool(raw) && !byLabel) {
        errors.push(
          `Row ${rowNum}: invalid rankingPool "${cells[rankingPoolIdx]}" — using position default.`,
        );
      } else if (isPlayerRankingPool(raw)) {
        rankingPool = raw;
      } else if (byLabel) {
        rankingPool = byLabel;
      }
    }

    let preferredFoot: Player['preferredFoot'] = 'Right';
    if (footIdx >= 0) {
      const footRaw = (cells[footIdx] || '').trim();
      if (footRaw) {
        const normalized =
          footRaw.charAt(0).toUpperCase() + footRaw.slice(1).toLowerCase();
        const both =
          footRaw.toLowerCase() === 'both' ? 'Both' : normalized;
        if (!VALID_FEET.has(both)) {
          errors.push(
            `Row ${rowNum}: invalid preferredFoot "${footRaw}" — using Right.`,
          );
        } else {
          preferredFoot = both as Player['preferredFoot'];
        }
      }
    }

    let birthYear: number | undefined;
    if (birthYearIdx >= 0) {
      const raw = (cells[birthYearIdx] || '').trim();
      if (raw) {
        const parsed = parseBirthYear(raw, asOfYear);
        if (parsed === undefined) {
          errors.push(`Row ${rowNum}: invalid birthYear "${raw}" — omitted.`);
        } else {
          birthYear = parsed;
        }
      }
    }
    if (birthYear === undefined && ageIdx >= 0) {
      const ageRaw = (cells[ageIdx] || '').trim();
      if (ageRaw) {
        const parsed = Number(ageRaw);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) {
          errors.push(`Row ${rowNum}: invalid age "${ageRaw}" — omitted.`);
        } else {
          birthYear = birthYearFromAge(parsed, asOfYear);
        }
      }
    }

    let grade: Player['grade'];
    if (gradeIdx >= 0) {
      const raw = (cells[gradeIdx] || '').trim();
      if (raw) {
        const parsed = parsePlayerGrade(raw);
        if (parsed === undefined) {
          errors.push(`Row ${rowNum}: invalid grade "${raw}" — omitted.`);
        } else {
          grade = parsed;
        }
      }
    }

    const avatarUrl =
      avatarIdx >= 0 ? (cells[avatarIdx] || '').trim() || undefined : undefined;
    const notes =
      notesIdx >= 0 ? (cells[notesIdx] || '').trim() || undefined : undefined;

    let publicId: string | undefined;
    if (publicIdIdx >= 0) {
      const raw = (cells[publicIdIdx] || '').trim();
      if (raw) {
        const parsed = normalizePublicId(raw);
        if (!parsed) {
          errors.push(
            `Row ${rowNum}: invalid publicId "${raw}" — will auto-assign.`,
          );
        } else if (seenPublicIds.has(parsed)) {
          errors.push(
            `Row ${rowNum}: duplicate publicId "${parsed}" — will auto-assign.`,
          );
        } else {
          publicId = parsed;
          seenPublicIds.add(parsed);
        }
      }
    }

    seenJerseys.add(jerseyNumber);
    ok.push({
      name,
      jerseyNumber,
      position: positionRaw as PlayerPosition,
      positions,
      rankingPool,
      preferredFoot,
      birthYear,
      grade,
      avatarUrl,
      notes,
      publicId,
      status: 'active',
    });
  }

  return { ok, errors, skipped };
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
