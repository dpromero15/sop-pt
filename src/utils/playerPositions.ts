/**
 * Soccer positions with classic tactical numbers (“play a 9”, “play a 6”).
 * Stored value is the short code; UI shows {@link formatPlayerPosition}.
 */

export const PLAYER_POSITIONS = [
  { code: 'GK', label: 'GK (1)' },
  { code: 'RB', label: 'RB (2)' },
  { code: 'RWB', label: 'RWB (2)' },
  { code: 'CB', label: 'CB (4/5)' },
  { code: 'LB', label: 'LB (3)' },
  { code: 'LWB', label: 'LWB (3)' },
  { code: 'WB', label: 'WB (2/3)' },
  { code: 'CDM', label: 'CDM (6)' },
  { code: 'CM', label: 'CM (8)' },
  { code: 'CAM', label: 'CAM (10)' },
  { code: 'RM', label: 'RM (7)' },
  { code: 'LM', label: 'LM (11)' },
  { code: 'RW', label: 'RW (7)' },
  { code: 'LW', label: 'LW (11)' },
  { code: 'SS', label: 'SS (10)' },
  { code: 'CF', label: 'CF (9)' },
  { code: 'ST', label: 'ST (9)' },
  { code: 'F9', label: 'False 9 (9)' },
] as const;

export type PlayerPositionCode = (typeof PLAYER_POSITIONS)[number]['code'];

const LABEL_BY_CODE: Record<PlayerPositionCode, string> = Object.fromEntries(
  PLAYER_POSITIONS.map((p) => [p.code, p.label]),
) as Record<PlayerPositionCode, string>;

const CODE_SET = new Set<string>(PLAYER_POSITIONS.map((p) => p.code));

/** All valid position codes (roster, CSV, specialty). */
export const PLAYER_POSITION_CODES: PlayerPositionCode[] = PLAYER_POSITIONS.map(
  (p) => p.code,
);

export const DEF_POSITIONS: PlayerPositionCode[] = [
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'WB',
];

export const MID_POSITIONS: PlayerPositionCode[] = [
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
];

export const FWD_POSITIONS: PlayerPositionCode[] = [
  'LW',
  'RW',
  'SS',
  'CF',
  'ST',
  'F9',
];

export function isPlayerPosition(value: string): value is PlayerPositionCode {
  return CODE_SET.has(value);
}

/** Display label with tactical number, e.g. `ST (9)` / `False 9 (9)`. */
export function formatPlayerPosition(code: string): string {
  if (isPlayerPosition(code)) return LABEL_BY_CODE[code];
  return code;
}
