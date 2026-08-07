import { 
  LabelDefinition, 
  MetricDefinition, 
  Player, 
  Session, 
  MetricEntry, 
  ScoringFormulaConfig,
  Team,
} from '../types';

export const DEFAULT_TEAM: Team = {
  id: 'team_thunder_fc_u16',
  name: 'Thunder FC',
  shortName: 'TFC',
  season: '2026',
  ageGroup: 'U-16',
  clubName: 'Thunder Football Club',
  homeVenue: 'Thunder Field',
  primaryColor: '#10b981',
  secondaryColor: '#0f172a',
  coachName: 'Coach Rivera',
  contactEmail: 'coach@thunderfc.example',
  timezone: 'America/Denver',
  notes: 'Sample squad for local development.',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_LABELS: LabelDefinition[] = [
  {
    id: 'attendance',
    name: 'Attendance',
    description: 'Punctuality, practice attendance, and team reliability',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    iconName: 'CalendarCheck'
  },
  {
    id: 'speed',
    name: 'Speed',
    description: 'Sprint speed, acceleration, and 40m dash times',
    color: 'blue',
    badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    badgeText: 'text-blue-700 dark:text-blue-300',
    iconName: 'Zap'
  },
  {
    id: 'agility',
    name: 'Agility',
    description: 'Direction changes, Shuttle run, T-test, and footwork',
    color: 'cyan',
    badgeBg: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    iconName: 'Activity'
  },
  {
    id: 'technical',
    name: 'Technical Skill',
    description: 'Ball control, juggling reps, first touch, and accuracy',
    color: 'purple',
    badgeBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
    badgeText: 'text-purple-700 dark:text-purple-300',
    iconName: 'Dribble'
  },
  {
    id: 'offense',
    name: 'Offense',
    description: 'Goals, assists, shots on target, and attacking contributions',
    color: 'rose',
    badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
    badgeText: 'text-rose-700 dark:text-rose-300',
    iconName: 'Target'
  },
  {
    id: 'defense',
    name: 'Defense',
    description: 'Tackles won, interceptions, aerial duels, and clean sheets',
    color: 'indigo',
    badgeBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    iconName: 'Shield'
  },
  {
    id: 'fitness',
    name: 'Fitness',
    description: 'Endurance, shuttle run stamina, and aerobic capacity',
    color: 'amber',
    badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    badgeText: 'text-amber-700 dark:text-amber-300',
    iconName: 'Flame'
  },
  {
    id: 'character',
    name: 'Character',
    description: 'Leadership, coachability, teamwork, and work ethic rating',
    color: 'orange',
    badgeBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    badgeText: 'text-orange-700 dark:text-orange-300',
    iconName: 'Award'
  }
];

export const DEFAULT_METRICS: MetricDefinition[] = [
  {
    id: 'm_attendance',
    name: 'Session Attendance',
    labelId: 'attendance',
    type: 'attendance',
    unit: 'status',
    higherIsBetter: true,
    description: 'Present (100%), Late (50%), Absent (0%), Excused (Exempt)'
  },
  {
    id: 'm_40m_dash',
    name: '40 Meter Dash',
    labelId: 'speed',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    minExpectedValue: 4.8,
    maxExpectedValue: 7.0,
    description: 'Timed 40m sprint from static start. Lower time is better.'
  },
  {
    id: 'm_shuttle_run',
    name: '5-10-5 Agility Shuttle',
    labelId: 'agility',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    minExpectedValue: 4.2,
    maxExpectedValue: 6.5,
    description: 'Pro agility shuttle run time.'
  },
  {
    id: 'm_juggling',
    name: 'Consecutive Juggles',
    labelId: 'technical',
    type: 'count',
    unit: 'reps',
    higherIsBetter: true,
    minExpectedValue: 10,
    maxExpectedValue: 200,
    description: 'Maximum consecutive juggles using feet and thighs without dropping.'
  },
  {
    id: 'm_pass_acc',
    name: 'Pass Completion Rate',
    labelId: 'technical',
    type: 'percentage',
    unit: '%',
    higherIsBetter: true,
    minExpectedValue: 50,
    maxExpectedValue: 98,
    description: 'Percentage of successful passes under drill or match pressure.'
  },
  {
    id: 'm_goals',
    name: 'Goals Scored',
    labelId: 'offense',
    type: 'count',
    unit: 'goals',
    higherIsBetter: true,
    minExpectedValue: 0,
    maxExpectedValue: 5,
    description: 'Match or scrimmage goals scored.'
  },
  {
    id: 'm_assists',
    name: 'Key Assists',
    labelId: 'offense',
    type: 'count',
    unit: 'assists',
    higherIsBetter: true,
    minExpectedValue: 0,
    maxExpectedValue: 5,
    description: 'Direct assists leading to goals.'
  },
  {
    id: 'm_tackles',
    name: 'Tackles Won',
    labelId: 'defense',
    type: 'count',
    unit: 'tackles',
    higherIsBetter: true,
    minExpectedValue: 0,
    maxExpectedValue: 12,
    description: 'Successful ground tackles and ball recoveries.'
  },
  {
    id: 'm_beep_test',
    name: 'Beep Test Level',
    labelId: 'fitness',
    type: 'count',
    unit: 'level',
    higherIsBetter: true,
    minExpectedValue: 6,
    maxExpectedValue: 15,
    description: 'Multi-stage fitness test shuttle level completed.'
  },
  {
    id: 'm_coach_rating',
    name: 'Work Ethic & Focus',
    labelId: 'character',
    type: 'rating_10',
    unit: '/10',
    higherIsBetter: true,
    minExpectedValue: 1,
    maxExpectedValue: 10,
    description: 'Coach rating (1-10) for effort, listening, and sportsmanship.'
  }
];

export const INITIAL_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: 'Mateo Rossi',
    jerseyNumber: 10,
    position: 'CAM',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'Team captain, excellent playmaker and vision.'
  },
  {
    id: 'p2',
    name: 'Lucas Silva',
    jerseyNumber: 7,
    position: 'RW',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
    age: 16,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'Blazing speed on the wing, sharp crossing.'
  },
  {
    id: 'p3',
    name: 'Marcus Vance',
    jerseyNumber: 9,
    position: 'ST',
    preferredFoot: 'Left',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-09-01',
    status: 'active',
    notes: 'Clinical finisher inside the 18-yard box.'
  },
  {
    id: 'p4',
    name: 'Diego Hernandez',
    jerseyNumber: 4,
    position: 'CB',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    age: 16,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'Strong in aerial duels, great defensive organizer.'
  },
  {
    id: 'p5',
    name: 'Liam O’Connor',
    jerseyNumber: 1,
    position: 'GK',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80',
    age: 16,
    joinedDate: '2025-08-20',
    status: 'active',
    notes: 'Quick reflexes, solid distribution.'
  },
  {
    id: 'p6',
    name: 'Kai Takahashi',
    jerseyNumber: 6,
    position: 'CDM',
    preferredFoot: 'Both',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'High work rate, intercepts key opposition passes.'
  },
  {
    id: 'p7',
    name: 'Julian MbappÃ©',
    jerseyNumber: 11,
    position: 'LW',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-08-18',
    status: 'active',
    notes: 'Direct dribbler, cuts inside with high power.'
  },
  {
    id: 'p8',
    name: 'Soren Lindqvist',
    jerseyNumber: 8,
    position: 'CM',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&q=80',
    age: 16,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'Box-to-box midfielder, high stamina.'
  },
  {
    id: 'p9',
    name: 'Carlos Ruiz',
    jerseyNumber: 3,
    position: 'LB',
    preferredFoot: 'Left',
    avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-08-25',
    status: 'active',
    notes: 'Solid overlapping runs, reliable 1v1 defender.'
  },
  {
    id: 'p10',
    name: 'Ethan Brooks',
    jerseyNumber: 2,
    position: 'RB',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
    age: 16,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'Tough tackler, discipline is improving.'
  },
  {
    id: 'p11',
    name: 'Noah Patel',
    jerseyNumber: 5,
    position: 'CB',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-09-10',
    status: 'active',
    notes: 'Great positioning and composure under pressure.'
  },
  {
    id: 'p12',
    name: 'Zack Fernandez',
    jerseyNumber: 14,
    position: 'ST',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-10-01',
    status: 'active',
    notes: 'Super-sub forward, rapid acceleration.'
  },
  {
    id: 'p13',
    name: 'Oliver Thorne',
    jerseyNumber: 18,
    position: 'CM',
    preferredFoot: 'Right',
    avatarUrl: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-09-01',
    status: 'injured',
    notes: 'Ankle sprain in recovery, doing light rehab.'
  },
  {
    id: 'p14',
    name: 'Gabriel Santos',
    jerseyNumber: 12,
    position: 'GK',
    preferredFoot: 'Left',
    avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=256&q=80',
    age: 15,
    joinedDate: '2025-08-15',
    status: 'active',
    notes: 'Backup keeper, vocal leader on bench.'
  }
];

export const INITIAL_SESSIONS: Session[] = [
  {
    id: 'sess_1',
    date: '2026-08-01',
    time: '17:30',
    title: 'Pre-Season Sprint & Fitness Combine',
    type: 'fitness_test',
    status: 'closed',
    location: 'Westside Athletic Complex',
    notes: 'Baseline testing for 40m dash, shuttle run, and consecutive juggling count.',
    metricIds: ['m_attendance', 'm_40m_dash', 'm_shuttle_run', 'm_juggling'],
  },
  {
    id: 'sess_2',
    date: '2026-08-03',
    time: '18:00',
    title: 'Tactical Possession & Finishing Drill',
    type: 'practice',
    status: 'closed',
    location: 'Field A',
    notes: 'Focus on quick transitions and passing accuracy in tight spaces.',
    metricIds: ['m_attendance', 'm_pass_acc', 'm_coach_rating', 'm_tackles'],
  },
  {
    id: 'sess_3',
    date: '2026-08-05',
    time: '10:00',
    title: 'League Match vs St. Jude Academy',
    type: 'match',
    status: 'closed',
    location: 'Central Stadium',
    opponent: 'St. Jude Academy',
    score: '3 - 1 (Win)',
    notes: 'Dominant midfield display, 2 goals from Mateo, 1 goal from Lucas.',
    metricIds: ['m_attendance', 'm_goals', 'm_assists', 'm_tackles', 'm_pass_acc'],
  }
];

export const INITIAL_ENTRIES: MetricEntry[] = [
  // Session 1: Fitness Combine
  { id: 'e1', sessionId: 'sess_1', playerId: 'p1', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-01' },
  { id: 'e2', sessionId: 'sess_1', playerId: 'p1', metricId: 'm_40m_dash', value: 5.15, rawValue: '5.15s', timestamp: '2026-08-01' },
  { id: 'e3', sessionId: 'sess_1', playerId: 'p1', metricId: 'm_juggling', value: 165, rawValue: '165 reps', timestamp: '2026-08-01' },
  { id: 'e4', sessionId: 'sess_1', playerId: 'p1', metricId: 'm_shuttle_run', value: 4.55, rawValue: '4.55s', timestamp: '2026-08-01' },

  { id: 'e5', sessionId: 'sess_1', playerId: 'p2', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-01' },
  { id: 'e6', sessionId: 'sess_1', playerId: 'p2', metricId: 'm_40m_dash', value: 4.88, rawValue: '4.88s', timestamp: '2026-08-01' },
  { id: 'e7', sessionId: 'sess_1', playerId: 'p2', metricId: 'm_juggling', value: 110, rawValue: '110 reps', timestamp: '2026-08-01' },
  { id: 'e8', sessionId: 'sess_1', playerId: 'p2', metricId: 'm_shuttle_run', value: 4.35, rawValue: '4.35s', timestamp: '2026-08-01' },

  { id: 'e9', sessionId: 'sess_1', playerId: 'p3', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-01' },
  { id: 'e10', sessionId: 'sess_1', playerId: 'p3', metricId: 'm_40m_dash', value: 5.02, rawValue: '5.02s', timestamp: '2026-08-01' },
  { id: 'e11', sessionId: 'sess_1', playerId: 'p3', metricId: 'm_juggling', value: 85, rawValue: '85 reps', timestamp: '2026-08-01' },

  { id: 'e12', sessionId: 'sess_1', playerId: 'p4', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-01' },
  { id: 'e13', sessionId: 'sess_1', playerId: 'p4', metricId: 'm_40m_dash', value: 5.45, rawValue: '5.45s', timestamp: '2026-08-01' },

  { id: 'e14', sessionId: 'sess_1', playerId: 'p6', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-01' },
  { id: 'e15', sessionId: 'sess_1', playerId: 'p6', metricId: 'm_40m_dash', value: 5.25, rawValue: '5.25s', timestamp: '2026-08-01' },
  { id: 'e16', sessionId: 'sess_1', playerId: 'p6', metricId: 'm_juggling', value: 140, rawValue: '140 reps', timestamp: '2026-08-01' },

  // Session 2: Tactical Practice
  { id: 'e20', sessionId: 'sess_2', playerId: 'p1', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-03' },
  { id: 'e21', sessionId: 'sess_2', playerId: 'p1', metricId: 'm_pass_acc', value: 92, rawValue: '92%', timestamp: '2026-08-03' },
  { id: 'e22', sessionId: 'sess_2', playerId: 'p1', metricId: 'm_coach_rating', value: 9.5, rawValue: '9.5/10', timestamp: '2026-08-03' },

  { id: 'e23', sessionId: 'sess_2', playerId: 'p2', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-03' },
  { id: 'e24', sessionId: 'sess_2', playerId: 'p2', metricId: 'm_pass_acc', value: 84, rawValue: '84%', timestamp: '2026-08-03' },
  { id: 'e25', sessionId: 'sess_2', playerId: 'p2', metricId: 'm_coach_rating', value: 8.5, rawValue: '8.5/10', timestamp: '2026-08-03' },

  { id: 'e26', sessionId: 'sess_2', playerId: 'p4', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-03' },
  { id: 'e27', sessionId: 'sess_2', playerId: 'p4', metricId: 'm_tackles', value: 8, rawValue: '8 tackles', timestamp: '2026-08-03' },
  { id: 'e28', sessionId: 'sess_2', playerId: 'p4', metricId: 'm_coach_rating', value: 9.0, rawValue: '9.0/10', timestamp: '2026-08-03' },

  { id: 'e29', sessionId: 'sess_2', playerId: 'p5', metricId: 'm_attendance', value: 50, rawValue: 'Late', timestamp: '2026-08-03' },
  { id: 'e30', sessionId: 'sess_2', playerId: 'p7', metricId: 'm_attendance', value: 0, rawValue: 'Absent', timestamp: '2026-08-03' },

  // Session 3: Match vs St. Jude
  { id: 'e31', sessionId: 'sess_3', playerId: 'p1', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-05' },
  { id: 'e32', sessionId: 'sess_3', playerId: 'p1', metricId: 'm_goals', value: 2, rawValue: '2 goals', timestamp: '2026-08-05' },
  { id: 'e33', sessionId: 'sess_3', playerId: 'p1', metricId: 'm_assists', value: 1, rawValue: '1 assist', timestamp: '2026-08-05' },

  { id: 'e34', sessionId: 'sess_3', playerId: 'p2', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-05' },
  { id: 'e35', sessionId: 'sess_3', playerId: 'p2', metricId: 'm_goals', value: 1, rawValue: '1 goal', timestamp: '2026-08-05' },
  { id: 'e36', sessionId: 'sess_3', playerId: 'p2', metricId: 'm_assists', value: 1, rawValue: '1 assist', timestamp: '2026-08-05' },

  { id: 'e37', sessionId: 'sess_3', playerId: 'p3', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-05' },
  { id: 'e38', sessionId: 'sess_3', playerId: 'p3', metricId: 'm_assists', value: 1, rawValue: '1 assist', timestamp: '2026-08-05' },

  { id: 'e39', sessionId: 'sess_3', playerId: 'p4', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-05' },
  { id: 'e40', sessionId: 'sess_3', playerId: 'p4', metricId: 'm_tackles', value: 11, rawValue: '11 tackles', timestamp: '2026-08-05' },

  { id: 'e41', sessionId: 'sess_3', playerId: 'p6', metricId: 'm_attendance', value: 100, rawValue: 'Present', timestamp: '2026-08-05' },
  { id: 'e42', sessionId: 'sess_3', playerId: 'p6', metricId: 'm_tackles', value: 9, rawValue: '9 tackles', timestamp: '2026-08-05' },
  { id: 'e43', sessionId: 'sess_3', playerId: 'p6', metricId: 'm_pass_acc', value: 89, rawValue: '89%', timestamp: '2026-08-05' }
];

export const DEFAULT_FORMULA_CONFIG: ScoringFormulaConfig = {
  id: 'default_formula',
  name: 'Balanced Coach Rating',
  weights: [
    { labelId: 'attendance', weightPercent: 20, enabled: true },
    { labelId: 'speed', weightPercent: 15, enabled: true },
    { labelId: 'agility', weightPercent: 10, enabled: true },
    { labelId: 'technical', weightPercent: 20, enabled: true },
    { labelId: 'offense', weightPercent: 15, enabled: true },
    { labelId: 'defense', weightPercent: 10, enabled: true },
    { labelId: 'fitness', weightPercent: 5, enabled: true },
    { labelId: 'character', weightPercent: 5, enabled: true }
  ]
};
