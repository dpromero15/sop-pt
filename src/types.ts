import type { PlayerPositionCode } from './utils/playerPositions';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  season: string;
  ageGroup: string;
  clubName: string;
  homeVenue: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  coachName?: string;
  contactEmail?: string;
  timezone: string;
  notes?: string;
  updatedAt: string;
}

export type MetricCategory = 
  | 'attendance'
  | 'speed'
  | 'agility'
  | 'technical'
  | 'offense'
  | 'defense'
  | 'fitness'
  | 'character'
  | string;

export interface LabelDefinition {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind color name like 'emerald', 'blue', 'amber', 'purple', 'rose', 'indigo', 'cyan'
  badgeBg: string;
  badgeText: string;
  iconName?: string;
  /** Built-in labels (e.g. attendance) cannot be deleted or cleared. */
  system?: boolean;
  /**
   * Root parents when this label is a subcategory (max depth 1).
   * Empty/absent = root category. A child may belong to multiple roots
   * (e.g. Endurance under Offense, Defense, and Midfield).
   * Attendance cannot be a parent or child.
   */
  parentLabelIds?: string[];
  /**
   * Parent that receives formula standing when a metric’s primary is this
   * subcategory. Must be in `parentLabelIds`. Other parents are browse-only
   * so the same metric is not counted multiple times in overall rank.
   */
  primaryParentLabelId?: string;
  /**
   * @deprecated Legacy single parent. Normalized to `parentLabelIds` +
   * `primaryParentLabelId`; still written as the primary parent for older readers.
   */
  parentLabelId?: string;
}

export type MetricType = 'time_seconds' | 'count' | 'percentage' | 'rating_10' | 'attendance';

/** How session entries roll up for rankings / label scoring. */
export type MetricAggregationMode = 'sum' | 'best' | 'latest' | 'average';

export interface MetricDefinition {
  id: string;
  name: string; // e.g. "40m Sprint Dash", "Juggling Count", "Attendance Status"
  /**
   * Category labels this metric appears under (rankings filters / Config).
   * Must be non-empty. Attendance is always `['attendance']`.
   */
  labelIds: string[];
  /**
   * Category that owns formula standing contribution (must be in `labelIds`).
   * Secondary memberships are browse-only and do not double-count overall.
   */
  primaryLabelId: string;
  type: MetricType;
  unit: string; // "s", "reps", "goals", "%", "/10"
  higherIsBetter: boolean; // e.g. Sprint time: false (lower seconds is better); Juggling: true
  /** How logged entries aggregate for rankings (defaults applied on load if missing). */
  aggregationMode: MetricAggregationMode;
  /** When false, metric is excluded from Adjusted category/overall blend (default true). */
  includeInAdjustedTotal?: boolean;
  /** When true and included in Adjusted, missing/unscored counts as 0 (default true). */
  treatNoScoreAsZero?: boolean;
  minExpectedValue?: number; // for normalization scaling
  maxExpectedValue?: number; // for normalization scaling
  description?: string;
}

/**
 * @deprecated Removed from product UI. Kept for backup / API snapshot compat.
 * Aggregation mode `average` replaces derived average fields.
 */
export type CalculatedFieldKind = 'average' | 'per_session' | 'percentile';

/** @deprecated Removed from product UI; snapshots may still carry an empty array. */
export interface CalculatedFieldDefinition {
  id: string;
  name: string;
  kind: CalculatedFieldKind;
  baseMetricId: string;
  enabled: boolean;
  higherIsBetter: boolean;
  unit: string;
}

/** Short position code; display with tactical number via `formatPlayerPosition`. */
export type PlayerPosition = PlayerPositionCode;

/** US high-school grade. */
export type PlayerGrade = 9 | 10 | 11 | 12;

/** Coach-defined comparison pool used by Coaches Rank. */
export type PlayerRankingPool =
  | 'wingbacks'
  | 'center-defense'
  | 'central-midfield'
  | 'forwards'
  | 'goalkeepers';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface Player {
  id: string;
  name: string;
  /**
   * Short stable code for printouts / anonymous sheets (6 Crockford-like chars).
   * Distinct from internal `id`. Assigned on create and by schema v15.
   */
  publicId?: string;
  jerseyNumber: number;
  position: PlayerPosition;
  /** Defaults from position, but may be overridden for roster planning. */
  rankingPool?: PlayerRankingPool;
  preferredFoot: 'Left' | 'Right' | 'Both';
  avatarUrl?: string;
  /** Calendar year of birth (e.g. 2010). Prefer this over a drifting age. */
  birthYear?: number;
  /** Current school grade (9–12). */
  grade?: PlayerGrade;
  joinedDate: string; // YYYY-MM-DD
  /**
   * `active` = on squad. `injured` = on squad, flagged. `inactive` = cut /
   * not used — record and logs stay, but the player is omitted from live
   * lists, rankings, and averages.
   */
  status: 'active' | 'injured' | 'inactive';
  notes?: string;
  /**
   * Coach-set: exclude from Adjusted Rank (sort to bottom).
   * Missing / false = included. Compliance badges are informational only.
   */
  rankingIneligible?: boolean;
  /** ISO timestamp when soft-deleted; omit/undefined = live. Purged after 90 days. */
  deletedAt?: string;
}

/** Configurable paperwork / fee / eligibility checklist item. */
export type RequirementKind =
  | 'paperwork'
  | 'fee'
  | 'eligibility'
  | 'disciplinary'
  | 'other';

export interface ComplianceRequirement {
  id: string;
  name: string;
  kind: RequirementKind;
  /** Incomplete + blocksPlay ⇒ no match play (eligibility kind shows Ineligible). */
  blocksPlay: boolean;
  /** Incomplete + blocksPractice ⇒ flagged as unable to attend practice. */
  blocksPractice: boolean;
  /** Incomplete + blocksEquipment ⇒ cannot be issued kit. */
  blocksEquipment?: boolean;
  description?: string;
  sortOrder: number;
}

export interface ComplianceCompletion {
  complete: boolean;
  completedAt?: string;
  note?: string;
}

/** playerId → requirementId → completion */
export type PlayerComplianceState = Record<
  string,
  Record<string, ComplianceCompletion>
>;

/** Assignable equipment inventory. */
export interface EquipmentGroup {
  id: string;
  name: string;
  description?: string;
}

export type EquipmentItemStatus = 'available' | 'assigned' | 'retired';

export interface EquipmentItem {
  id: string;
  groupId: string;
  label: string;
  status: EquipmentItemStatus;
  assignedPlayerId?: string;
  assignedAt?: string;
  notes?: string;
}

/** One primary + secondary cut pair (1-based rank places). */
export interface RankingCutPair {
  primaryCut: number;
  secondaryCut: number;
}

/** Cut lines for Adjusted / specialty / category / metric ranking lists. */
export interface RankingBoundariesConfig {
  /** Overall (all rankings) primary cut. */
  primaryCut: number;
  /** Overall (all rankings) secondary cut. */
  secondaryCut: number;
  specialtyCuts: Partial<Record<PlayerPosition, number>>;
  /** Optional cuts keyed by category label id. */
  categoryCuts?: Record<string, RankingCutPair>;
  /** Optional cuts keyed by metric or calculated-field id. */
  metricCuts?: Record<string, RankingCutPair>;
  /** Substitute / actual-cut lines keyed by coach ranking pool. */
  poolCuts?: Partial<Record<PlayerRankingPool, RankingCutPair>>;
}

/** Training / testing / drill days are `session`; competitive games are `match`. */
export type SessionType = 'session' | 'match';

/** Open sessions can be resumed in Quick Insert; closed are history-only until reopened. */
export type SessionStatus = 'open' | 'closed';

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  title: string;
  type: SessionType;
  status: SessionStatus;
  location?: string;
  opponent?: string; // for matches
  score?: string; // e.g. "3 - 1"
  notes?: string;
  /** Ordered metric plan for this session; attendance metric id is always first. */
  metricIds: string[];
  /** ISO timestamp when soft-deleted; omit/undefined = live. Purged after 90 days. */
  deletedAt?: string;
}

export interface MetricEntry {
  id: string;
  sessionId: string;
  playerId: string;
  metricId: string;
  value: number; // For attendance: present=100, late=50, absent=0, excused=-1 (exempt)
  rawValue?: string; // e.g. "Present", "5.42s"
  timestamp: string;
  notes?: string;
}

export interface LabelWeight {
  labelId: string;
  weightPercent: number; // 0 to 100
  enabled: boolean;
}

export interface ScoringFormulaConfig {
  id: string;
  name: string;
  weights: LabelWeight[]; // labelId -> weight percent
}

export interface PlayerLabelScore {
  labelId: string;
  labelName: string;
  /**
   * Overall category standing score: average of pool percentiles for
   * logged metrics only. Unscored / excused omitted.
   * Null when nothing has been scored in this label.
   */
  score: number | null;
  /**
   * Adjusted category standing score: average over metrics with
   * includeInAdjustedTotal !== false. Missing/unscored count as 0 when
   * treatNoScoreAsZero !== false; otherwise omitted. Null when the label has
   * no Adjusted-included metrics (or none contribute after omission).
   */
  adjustedScore: number | null;
  entryCount: number;
  metrics: {
    metricId: string;
    metricName: string;
    /** Value after applying the metric's aggregationMode. */
    aggregatedValue: number;
    unit: string;
    /** Pool percentile vs squad (100 = best), or season rate for attendance. */
    poolScore: number;
  }[];
}

/** Staff coach who submits ordinal ballots for Coaches Rank. */
export interface Coach {
  id: string;
  name: string;
  /** Linked Firebase Auth uid when coach is a signed-in user. */
  uid?: string;
  email?: string;
}

/** Access roles for Firebase-backed multi-user mode (#75 / v2.7.0). */
export type AppRole =
  | 'none'
  | 'viewer'
  | 'dataEntry'
  | 'teamAdmin'
  | 'systemAdmin';

export type TeamMembershipRole = 'viewer' | 'dataEntry' | 'teamAdmin';

export type AccessAction =
  | 'view'
  | 'dataEntry'
  | 'coachesRating'
  | 'adjustedBumps'
  | 'rosterWrite'
  | 'profileNotes'
  | 'configWrite'
  | 'adminPage'
  | 'manageAllTeams'
  | 'manageTeamMembers'
  | 'promoteSystemAdmin'
  | 'cloudSync';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  systemRole: 'none' | 'systemAdmin';
  createdAt: string;
  lastLoginAt: string;
}

export interface TeamMembership {
  uid?: string;
  email: string;
  role: TeamMembershipRole;
  coachDisplayName?: string;
  createdAt: string;
  createdByUid: string;
}

export interface EffectiveAccess {
  role: AppRole;
  systemRole: 'none' | 'systemAdmin';
  teamId: string | null;
  membershipRole: TeamMembershipRole | null;
}

/**
 * One coach's full or partial ordinal ranking of players.
 * `ranks` maps playerId → ordinal (1 = best). Complete ballots assign
 * unique 1…N over every active player.
 */
export interface CoachBallot {
  coachId: string;
  ranks: Record<string, number>;
}

/** Team-level ±1 bump budgets for Adjusted rankings only. */
export interface AdjustedBumpConfig {
  plusBudget: number;
  minusBudget: number;
}

/**
 * One +1 / −1 Adjusted bump attributed to a coach.
 * Net per player = sum of deltas; ranking uses that net as a score offset.
 */
export interface AdjustedBumpTransaction {
  id: string;
  playerId: string;
  coachId: string;
  delta: 1 | -1;
  createdAt: string;
}

/** Coach id used when migrating pre-attribution bump nets. */
export const LEGACY_BUMP_COACH_ID = 'coach_legacy';

export interface PlayerRanking {
  player: Player;
  /**
   * Overall combined standing score (pool-based): formula weights applied
   * only to labels with real scores. Null when nothing scored.
   */
  totalScore: number | null;
  /**
   * Adjusted combined standing score: formula weights on all enabled labels;
   * unscored labels count as 0. Null when no enabled formula weights.
   */
  adjustedTotalScore: number | null;
  /**
   * Pool place for Statistical Rank (1 = best). Null when unscored.
   * Field name `overallRank` kept for storage / API stability.
   */
  overallRank: number | null;
  /**
   * Pool place for Adjusted (1 = best), after optional ± bumps.
   * Null when no enabled formula weights.
   */
  adjustedRank: number | null;
  /**
   * Sum of ordinals across complete coach ballots only.
   * Display as average (sum / ballot count); order matches average.
   * Null when no complete ballots (or player not active in the pool).
   */
  coachesTotalSum: number | null;
  /**
   * Competition rank of coaches averages (1 = best / lower average).
   * Null when coachesTotalSum is null.
   */
  coachesRank: number | null;
  /** Net Adjusted ±1 bump for this player (0 when none). */
  adjustedBump: number;
  /**
   * False when any blocksPlay compliance requirement is incomplete.
   * Adjusted / specialty competition ranks only include eligible players.
   */
  eligibleToPlay: boolean;
  labelScores: Record<string, PlayerLabelScore>; // labelId -> label score details
  /** @deprecated Prefer overallRank — kept as overall pool place for callers. */
  rank: number;
  /**
   * Overall attendance rate from present/late/absent only.
   * Excused is unscored and omitted. Null when no countable attendance.
   */
  attendanceRate: number | null;
  recentTrend: 'up' | 'down' | 'stable';
  /** Enabled calculated field id → computed value (only when enabled). */
  calculatedValues: Record<string, number>;
}
