/**
 * Soccer positions with classic tactical numbers (“play a 9”, “play a 6”).
 * Stored value is the short code; UI shows {@link formatPlayerPosition}.
 * The team catalog is configurable; {@link DEFAULT_PLAYER_POSITIONS} is the seed.
 */

import type {
  PlayerRankingPool,
  PositionDefinition,
  PositionLine,
} from '../types';

const RANKING_POOLS = new Set<PlayerRankingPool>([
  'wingbacks',
  'center-defense',
  'central-midfield',
  'forwards',
  'goalkeepers',
]);

export type PlayerPositionCode = string;

const LINES = new Set<PositionLine>(['gk', 'def', 'mid', 'fwd']);

/** Combined CB kept only for existing squads until the coach reassigns L/R. */
const LEGACY_CB: PositionDefinition = {
  code: 'CB',
  name: 'CB',
  tacticalNumber: 4,
  tacticalNumberSecondary: 5,
  line: 'def',
  rankingPool: 'center-defense',
  sortOrder: 35,
};

export const DEFAULT_PLAYER_POSITIONS: PositionDefinition[] = [
  {
    code: 'GK',
    name: 'GK',
    tacticalNumber: 1,
    line: 'gk',
    rankingPool: 'goalkeepers',
    sortOrder: 10,
  },
  {
    code: 'RB',
    name: 'RB',
    tacticalNumber: 2,
    line: 'def',
    rankingPool: 'wingbacks',
    sortOrder: 20,
  },
  {
    code: 'RWB',
    name: 'RWB',
    tacticalNumber: 2,
    line: 'def',
    rankingPool: 'wingbacks',
    sortOrder: 21,
  },
  {
    code: 'RCB',
    name: 'RCB',
    tacticalNumber: 4,
    line: 'def',
    rankingPool: 'center-defense',
    sortOrder: 30,
  },
  {
    code: 'LCB',
    name: 'LCB',
    tacticalNumber: 5,
    line: 'def',
    rankingPool: 'center-defense',
    sortOrder: 31,
  },
  {
    code: 'LB',
    name: 'LB',
    tacticalNumber: 3,
    line: 'def',
    rankingPool: 'wingbacks',
    sortOrder: 40,
  },
  {
    code: 'LWB',
    name: 'LWB',
    tacticalNumber: 3,
    line: 'def',
    rankingPool: 'wingbacks',
    sortOrder: 41,
  },
  {
    code: 'WB',
    name: 'WB',
    tacticalNumber: 2,
    tacticalNumberSecondary: 3,
    line: 'def',
    rankingPool: 'wingbacks',
    sortOrder: 42,
  },
  {
    code: 'CDM',
    name: 'CDM',
    tacticalNumber: 6,
    line: 'mid',
    rankingPool: 'center-defense',
    sortOrder: 50,
  },
  {
    code: 'CM',
    name: 'CM',
    tacticalNumber: 8,
    line: 'mid',
    rankingPool: 'central-midfield',
    sortOrder: 51,
  },
  {
    code: 'CAM',
    name: 'CAM',
    tacticalNumber: 10,
    line: 'mid',
    rankingPool: 'central-midfield',
    sortOrder: 52,
  },
  {
    code: 'RM',
    name: 'RM',
    tacticalNumber: 7,
    line: 'mid',
    rankingPool: 'forwards',
    sortOrder: 53,
  },
  {
    code: 'LM',
    name: 'LM',
    tacticalNumber: 11,
    line: 'mid',
    rankingPool: 'forwards',
    sortOrder: 54,
  },
  {
    code: 'RW',
    name: 'RW',
    tacticalNumber: 7,
    line: 'fwd',
    rankingPool: 'forwards',
    sortOrder: 60,
  },
  {
    code: 'LW',
    name: 'LW',
    tacticalNumber: 11,
    line: 'fwd',
    rankingPool: 'forwards',
    sortOrder: 61,
  },
  {
    code: 'SS',
    name: 'SS',
    tacticalNumber: 10,
    line: 'fwd',
    rankingPool: 'central-midfield',
    sortOrder: 62,
  },
  {
    code: 'CF',
    name: 'CF',
    tacticalNumber: 9,
    line: 'fwd',
    rankingPool: 'central-midfield',
    sortOrder: 63,
  },
  {
    code: 'ST',
    name: 'ST',
    tacticalNumber: 9,
    line: 'fwd',
    rankingPool: 'central-midfield',
    sortOrder: 64,
  },
  {
    code: 'F9',
    name: 'False 9',
    tacticalNumber: 9,
    line: 'fwd',
    rankingPool: 'central-midfield',
    sortOrder: 65,
  },
];

const DEFAULT_BY_CODE: Record<string, PositionDefinition> = Object.fromEntries(
  [...DEFAULT_PLAYER_POSITIONS, LEGACY_CB].map((p) => [p.code, p]),
);

const FALLBACK_POOL_BY_CODE: Record<string, PlayerRankingPool> = Object.fromEntries(
  [...DEFAULT_PLAYER_POSITIONS, LEGACY_CB].map((p) => [p.code, p.rankingPool]),
);

let activeCatalog: PositionDefinition[] | null = null;

export function setActivePositionCatalog(
  positions: PositionDefinition[] | null,
): void {
  activeCatalog = positions;
}

export function getActivePositionCatalog(): PositionDefinition[] {
  return activeCatalog ?? DEFAULT_PLAYER_POSITIONS;
}

export function cloneDefaultPlayerPositions(): PositionDefinition[] {
  return DEFAULT_PLAYER_POSITIONS.map((p) => ({ ...p }));
}

/** Display label with tactical number, e.g. `LCB (5)` / `WB (2/3)`. */
export function formatPositionLabel(position: PositionDefinition): string {
  if (
    position.tacticalNumberSecondary != null &&
    position.tacticalNumberSecondary !== position.tacticalNumber
  ) {
    return `${position.name} (${position.tacticalNumber}/${position.tacticalNumberSecondary})`;
  }
  return `${position.name} (${position.tacticalNumber})`;
}

/** Default catalog as `{ code, label }` for callers that have not loaded storage. */
export const PLAYER_POSITIONS = DEFAULT_PLAYER_POSITIONS.map((p) => ({
  code: p.code,
  label: formatPositionLabel(p),
}));

export const PLAYER_POSITION_CODES: string[] = DEFAULT_PLAYER_POSITIONS.map(
  (p) => p.code,
);

export function positionCodes(
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): string[] {
  return catalog.map((p) => p.code);
}

export function positionsForLine(
  line: PositionLine,
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): string[] {
  return catalog.filter((p) => p.line === line).map((p) => p.code);
}

export const DEF_POSITIONS: string[] = positionsForLine(
  'def',
  DEFAULT_PLAYER_POSITIONS,
);
export const MID_POSITIONS: string[] = positionsForLine(
  'mid',
  DEFAULT_PLAYER_POSITIONS,
);
export const FWD_POSITIONS: string[] = positionsForLine(
  'fwd',
  DEFAULT_PLAYER_POSITIONS,
);

export function normalizePositionCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function parseTacticalNumber(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 99) return fallback;
  return n;
}

function parsePositionRow(
  raw: unknown,
  fallbackSort: number,
): PositionDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const code = normalizePositionCode(String(row.code ?? ''));
  if (!code) return null;
  const seed = DEFAULT_BY_CODE[code];
  const nameRaw = typeof row.name === 'string' ? row.name.trim() : '';
  const name = nameRaw || seed?.name || code;
  const line: PositionLine = LINES.has(row.line as PositionLine)
    ? (row.line as PositionLine)
    : (seed?.line ?? 'mid');
  const rankingPool: PlayerRankingPool = RANKING_POOLS.has(
    row.rankingPool as PlayerRankingPool,
  )
    ? (row.rankingPool as PlayerRankingPool)
    : (seed?.rankingPool ?? 'central-midfield');
  const sortRaw = Math.floor(Number(row.sortOrder));
  const sortOrder =
    Number.isFinite(sortRaw) && sortRaw >= 0 ? sortRaw : (seed?.sortOrder ?? fallbackSort);
  const tacticalNumber = parseTacticalNumber(
    row.tacticalNumber,
    seed?.tacticalNumber ?? 1,
  );
  const secondaryRaw = row.tacticalNumberSecondary;
  let tacticalNumberSecondary: number | undefined;
  if (secondaryRaw != null && secondaryRaw !== '') {
    const parsed = parseTacticalNumber(secondaryRaw, tacticalNumber);
    if (parsed !== tacticalNumber) tacticalNumberSecondary = parsed;
  }
  const next: PositionDefinition = {
    code,
    name,
    tacticalNumber,
    line,
    rankingPool,
    sortOrder,
  };
  if (tacticalNumberSecondary != null) {
    next.tacticalNumberSecondary = tacticalNumberSecondary;
  }
  return next;
}

export function normalizePlayerPositions(raw: unknown): PositionDefinition[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return cloneDefaultPlayerPositions();
  }
  const seen = new Set<string>();
  const out: PositionDefinition[] = [];
  raw.forEach((row, index) => {
    const parsed = parsePositionRow(row, (index + 1) * 10);
    if (!parsed || seen.has(parsed.code)) return;
    seen.add(parsed.code);
    out.push(parsed);
  });
  if (out.length === 0) return cloneDefaultPlayerPositions();
  return out.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

/** Keep codes still on the roster so leftover CB (etc.) remain selectable. */
export function ensureCatalogCoversCodes(
  catalog: PositionDefinition[],
  codes: Iterable<string>,
): PositionDefinition[] {
  const next = catalog.map((p) => ({ ...p }));
  const have = new Set(next.map((p) => p.code));
  let extraSort = Math.max(0, ...next.map((p) => p.sortOrder)) + 1;
  for (const raw of codes) {
    if (typeof raw !== 'string') continue;
    const code = normalizePositionCode(raw);
    if (!code || have.has(code)) continue;
    const seed = DEFAULT_BY_CODE[code];
    next.push(
      seed
        ? { ...seed, sortOrder: extraSort }
        : {
            code,
            name: code,
            tacticalNumber: 1,
            line: 'mid',
            rankingPool: 'central-midfield',
            sortOrder: extraSort,
          },
    );
    have.add(code);
    extraSort += 1;
  }
  return next.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

export function findPosition(
  code: string,
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): PositionDefinition | undefined {
  const normalized = normalizePositionCode(code);
  return catalog.find((p) => p.code === normalized) ?? DEFAULT_BY_CODE[normalized];
}

export function isPlayerPosition(
  value: string,
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): boolean {
  const code = normalizePositionCode(value);
  if (!code) return false;
  if (catalog.some((p) => p.code === code)) return true;
  return code in DEFAULT_BY_CODE;
}

export function defaultRankingPoolForPositionCode(
  position: string,
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): PlayerRankingPool {
  const found = findPosition(position, catalog);
  if (found) return found.rankingPool;
  return FALLBACK_POOL_BY_CODE[normalizePositionCode(position)] ?? 'central-midfield';
}

/** Display label with tactical number, e.g. `ST (9)` / `LCB (5)`. */
export function formatPlayerPosition(
  code: string,
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): string {
  const found = findPosition(code, catalog);
  if (found) return formatPositionLabel(found);
  return code;
}

/** Unique role codes a player can play, primary first. */
export function playerPositionCodes(player: {
  position?: unknown;
  positions?: unknown;
}): string[] {
  const extras = Array.isArray(player.positions)
    ? player.positions.map((value) =>
        typeof value === 'string' ? normalizePositionCode(value) : '',
      )
    : [];
  const primary =
    typeof player.position === 'string'
      ? normalizePositionCode(player.position)
      : '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of [primary, ...extras]) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function playerHasPosition(
  player: { position?: unknown; positions?: unknown },
  code: string,
): boolean {
  const target = normalizePositionCode(code);
  return target !== '' && playerPositionCodes(player).includes(target);
}

export function formatPlayerPositions(
  player: { position?: unknown; positions?: unknown },
  catalog: PositionDefinition[] = getActivePositionCatalog(),
): string {
  const codes = playerPositionCodes(player);
  if (codes.length === 0) return '';
  return codes.map((code) => formatPlayerPosition(code, catalog)).join(' · ');
}

export function assignPlayerPositionList(
  row: Record<string, unknown>,
): { row: Record<string, unknown>; changed: boolean } {
  const codes = playerPositionCodes(row);
  const primary = codes[0];
  if (!primary) return { row, changed: false };
  const samePrimary = row.position === primary;
  const sameList =
    Array.isArray(row.positions) &&
    row.positions.length === codes.length &&
    row.positions.every((value, i) => value === codes[i]);
  if (samePrimary && sameList) return { row, changed: false };
  return {
    changed: true,
    row: { ...row, position: primary, positions: codes },
  };
}

export function assignDefaultPlayerPositions(
  rows: Record<string, unknown>[],
): { rows: Record<string, unknown>[]; changed: boolean } {
  let changed = false;
  const next = rows.map((row) => {
    const result = assignPlayerPositionList(row);
    changed ||= result.changed;
    return result.row;
  });
  return { rows: next, changed };
}
