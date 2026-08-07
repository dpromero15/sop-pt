import type { Player, PlayerPosition } from '../types';

export const PLAYER_CSV_HEADERS = [
  'name',
  'jerseyNumber',
  'position',
  'preferredFoot',
  'age',
  'avatarUrl',
  'notes',
] as const;

const VALID_POSITIONS = new Set<PlayerPosition>([
  'GK',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CM',
  'CAM',
  'LW',
  'RW',
  'ST',
]);

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
    '15',
    '',
    'Sample player row — replace with your roster',
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
  const footIdx = colIndex('preferredFoot');
  const ageIdx = colIndex('age');
  const avatarIdx = colIndex('avatarUrl');
  const notesIdx = colIndex('notes');

  if (nameIdx < 0 || jerseyIdx < 0 || positionIdx < 0) {
    errors.push(
      'CSV must include name, jerseyNumber, and position header columns.',
    );
    return { ok, errors, skipped };
  }

  const seenJerseys = new Set(existingJerseyNumbers);

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

    if (!VALID_POSITIONS.has(positionRaw as PlayerPosition)) {
      errors.push(`Row ${rowNum}: invalid position "${positionRaw}".`);
      skipped += 1;
      continue;
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

    let age: number | undefined;
    if (ageIdx >= 0) {
      const ageRaw = (cells[ageIdx] || '').trim();
      if (ageRaw) {
        const parsed = Number(ageRaw);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) {
          errors.push(`Row ${rowNum}: invalid age "${ageRaw}" — omitted.`);
        } else {
          age = Math.round(parsed);
        }
      }
    }

    const avatarUrl =
      avatarIdx >= 0 ? (cells[avatarIdx] || '').trim() || undefined : undefined;
    const notes =
      notesIdx >= 0 ? (cells[notesIdx] || '').trim() || undefined : undefined;

    seenJerseys.add(jerseyNumber);
    ok.push({
      name,
      jerseyNumber,
      position: positionRaw as PlayerPosition,
      preferredFoot,
      age,
      avatarUrl,
      notes,
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
