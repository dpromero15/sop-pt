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
}

export type MetricType = 'time_seconds' | 'count' | 'percentage' | 'rating_10' | 'attendance';

/** How session entries roll up for rankings / label scoring. */
export type MetricAggregationMode = 'sum' | 'best' | 'latest';

export interface MetricDefinition {
  id: string;
  name: string; // e.g. "40m Sprint Dash", "Juggling Count", "Attendance Status"
  labelId: string; // references LabelDefinition.id (e.g. 'speed', 'technical', 'attendance')
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

/** Pre-built derived stats computed from a base measurable metric (not logged in sessions). */
export type CalculatedFieldKind = 'average' | 'per_session' | 'percentile';

export interface CalculatedFieldDefinition {
  id: string;
  name: string;
  kind: CalculatedFieldKind;
  baseMetricId: string;
  enabled: boolean;
  higherIsBetter: boolean;
  unit: string;
}

export type PlayerPosition = 
  | 'GK' 
  | 'CB' 
  | 'LB' 
  | 'RB' 
  | 'CDM' 
  | 'CM' 
  | 'CAM' 
  | 'LW' 
  | 'RW' 
  | 'ST';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface Player {
  id: string;
  name: string;
  jerseyNumber: number;
  position: PlayerPosition;
  preferredFoot: 'Left' | 'Right' | 'Both';
  avatarUrl?: string;
  age?: number;
  joinedDate: string; // YYYY-MM-DD
  status: 'active' | 'injured' | 'inactive';
  notes?: string;
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
    /** Pool percentile vs squad (100 = best among players with this metric). */
    poolScore: number;
  }[];
}

/** Staff coach who submits ordinal ballots for Coaches Rank. */
export interface Coach {
  id: string;
  name: string;
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
