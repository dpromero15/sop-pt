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

export interface MetricDefinition {
  id: string;
  name: string; // e.g. "40m Sprint Dash", "Juggling Count", "Attendance Status"
  labelId: string; // references LabelDefinition.id (e.g. 'speed', 'technical', 'attendance')
  type: MetricType;
  unit: string; // "s", "reps", "goals", "%", "/10"
  higherIsBetter: boolean; // e.g. Sprint time: false (lower seconds is better); Juggling: true
  minExpectedValue?: number; // for normalization scaling
  maxExpectedValue?: number; // for normalization scaling
  description?: string;
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

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  title: string;
  type: SessionType;
  location?: string;
  opponent?: string; // for matches
  score?: string; // e.g. "3 - 1"
  notes?: string;
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
  score: number; // 0 - 100 normalized
  entryCount: number;
  metrics: {
    metricId: string;
    metricName: string;
    latestValue: number;
    unit: string;
    normalizedScore: number;
  }[];
}

export interface PlayerRanking {
  player: Player;
  totalScore: number; // 0 - 100
  labelScores: Record<string, PlayerLabelScore>; // labelId -> label score details
  rank: number;
  attendanceRate: number; // 0 - 100%
  recentTrend: 'up' | 'down' | 'stable';
}
