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

export type SessionType = 'practice' | 'match' | 'fitness_test';

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
   * Overall category score: average of logged metrics only.
   * Unscored / excused metrics are omitted (not counted against the player).
   * Null when nothing has been scored in this label.
   */
  score: number | null;
  /**
   * Weighted category score: average over every metric in the label,
   * treating missing / unscored / excused as 0.
   * Null when the label has no metrics defined.
   */
  weightedScore: number | null;
  entryCount: number;
  metrics: {
    metricId: string;
    metricName: string;
    /** Value after applying the metric's aggregationMode. */
    aggregatedValue: number;
    unit: string;
    normalizedScore: number;
  }[];
}

export interface PlayerRanking {
  player: Player;
  /**
   * Overall total: formula weights applied only to labels with real scores.
   * Unscored labels are omitted. Null when nothing scored in any weighted label.
   */
  totalScore: number | null;
  /**
   * Weighted total: formula weights applied to all enabled labels;
   * unscored labels count as 0. Null when no enabled formula weights.
   */
  weightedTotalScore: number | null;
  labelScores: Record<string, PlayerLabelScore>; // labelId -> label score details
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
