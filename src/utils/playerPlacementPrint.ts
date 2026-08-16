import type {
  CoachBallot,
  CoachPositionBallot,
  LabelDefinition,
  MetricDefinition,
  MetricEntry,
  Player,
  PlayerRanking,
  PositionDefinition,
  Team,
} from '../types';
import {
  coachesRankingsForPosition,
  isCompleteBallot,
  isCompletePositionBallot,
  playersForPosition,
} from './coachesRating';
import { visibleRankingLabels } from './formulaWeights';
import { metricValueTriple } from './metricAggregation';
import {
  formatPlayerPosition,
  formatPlayerPositions,
  playerPositionCodes,
} from './playerPositions';
import { displayPublicId } from './playerPublicId';
import { activePlayers } from './playerStatus';
import {
  specialtyAdjustedRankings,
  specialtyStatisticalRankings,
} from './positionRankings';
import { formatTeamMetricValue } from './rankingsFilter';
import { openPrintHtml } from './rankingsPrint';

export interface RankPlace {
  rank: number | null;
  of: number;
  detail: string;
}

export interface PositionPlacementRow {
  code: string;
  label: string;
  playerCount: number;
  statistical: RankPlace;
  adjusted: RankPlace;
  coaches: RankPlace;
}

export interface CategoryPlacementRow {
  id: string;
  name: string;
  score: number | null;
  adjustedScore: number | null;
}

export interface MetricPlacementRow {
  metricId: string;
  metricName: string;
  category: string;
  standing: string;
  average: string;
  latest: string;
  best: string;
}

export interface PlayerPlacementDocument {
  teamName: string;
  clubName: string;
  season: string;
  ageGroup: string;
  accent: string;
  printedAt: string;
  playerName: string;
  jersey: number;
  publicId: string;
  positionsLabel: string;
  foot: string;
  grade: string;
  birthYear: string;
  statusNote: string;
  notes: string;
  attendanceRate: string;
  overall: {
    statistical: RankPlace;
    adjusted: RankPlace;
    coaches: RankPlace;
  };
  positions: PositionPlacementRow[];
  categories: CategoryPlacementRow[];
  metrics: MetricPlacementRow[];
}

export interface PlayerPlacementPrintContext {
  team: Team;
  rankings: PlayerRanking[];
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  entries: MetricEntry[];
  positions: PositionDefinition[];
  coachBallots: CoachBallot[];
  coachPositionBallots: CoachPositionBallot[];
  printedAt?: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrintDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCoachesAverage(sum: number, ballotCount: number): string {
  if (ballotCount <= 0) return String(sum);
  const avg = sum / ballotCount;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

function placeOf(rank: number | null, of: number, detail: string): RankPlace {
  return { rank, of: Math.max(0, of), detail };
}

function formatPlace(place: RankPlace): string {
  if (place.rank == null) return '—';
  if (place.of > 0) return `#${place.rank} of ${place.of}`;
  return `#${place.rank}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '•';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function rankedCount(
  rankings: PlayerRanking[],
  key: 'overallRank' | 'adjustedRank' | 'coachesRank',
): number {
  return rankings.filter((row) => row[key] != null).length;
}

function findRanking(
  rankings: PlayerRanking[],
  playerId: string,
): PlayerRanking | undefined {
  return rankings.find((row) => row.player.id === playerId);
}

function statusNoteFor(player: Player): string {
  const bits: string[] = [];
  if (player.status === 'injured') bits.push('Injured');
  if (player.status === 'inactive') bits.push('Inactive');
  if (player.rankingIneligible) bits.push('Marked ineligible for Adjusted');
  return bits.join(' · ');
}

export function buildPlayerPlacementDocument(
  player: Player,
  ctx: PlayerPlacementPrintContext,
): PlayerPlacementDocument {
  const ranking =
    findRanking(ctx.rankings, player.id) ??
    ({
      player,
      totalScore: null,
      adjustedTotalScore: null,
      overallRank: null,
      adjustedRank: null,
      coachesTotalSum: null,
      coachesRank: null,
      adjustedBump: 0,
      eligibleToPlay: true,
      labelScores: {},
      rank: 0,
      attendanceRate: null,
      recentTrend: 'stable',
      calculatedValues: {},
    } satisfies PlayerRanking);

  const activeIds = activePlayers(ctx.rankings.map((row) => row.player)).map(
    (row) => row.id,
  );
  const completeCoachCount = ctx.coachBallots.filter((ballot) =>
    isCompleteBallot(ballot, activeIds),
  ).length;

  let adjustedDetail = formatScore(ranking.adjustedTotalScore);
  if (ranking.adjustedBump) {
    const bump =
      ranking.adjustedBump > 0
        ? `+${ranking.adjustedBump}`
        : String(ranking.adjustedBump);
    adjustedDetail =
      adjustedDetail === '—' ? bump : `${adjustedDetail} (${bump})`;
  }

  const overall = {
    statistical: placeOf(
      ranking.overallRank,
      rankedCount(ctx.rankings, 'overallRank'),
      ranking.totalScore != null ? `Standing ${formatScore(ranking.totalScore)}` : 'Unscored',
    ),
    adjusted: placeOf(
      ranking.adjustedRank,
      rankedCount(ctx.rankings, 'adjustedRank'),
      ranking.adjustedRank == null ? 'Unscored' : adjustedDetail,
    ),
    coaches: placeOf(
      ranking.coachesRank,
      ranking.coachesRank != null ? activeIds.length : 0,
      ranking.coachesTotalSum != null && completeCoachCount > 0
        ? `Avg ${formatCoachesAverage(ranking.coachesTotalSum, completeCoachCount)}`
        : 'No complete ballots',
    ),
  };

  const assigned = playerPositionCodes(player);
  const positions: PositionPlacementRow[] = assigned.map((code) => {
    const statList = specialtyStatisticalRankings(ctx.rankings, code);
    const adjList = specialtyAdjustedRankings(ctx.rankings, code);
    const coachList = coachesRankingsForPosition(
      ctx.rankings,
      ctx.rankings.map((row) => row.player),
      ctx.coachPositionBallots,
      code,
    );
    const eligibleIds = playersForPosition(
      ctx.rankings.map((row) => row.player),
      code,
    ).map((row) => row.id);
    const completePositionCount = ctx.coachPositionBallots.filter(
      (ballot) =>
        ballot.position === code &&
        isCompletePositionBallot(ballot, eligibleIds),
    ).length;
    const mineStat = findRanking(statList, player.id);
    const mineAdj = findRanking(adjList, player.id);
    const mineCoach = findRanking(coachList, player.id);
    const coachDetail =
      mineCoach?.coachesTotalSum != null && completePositionCount > 0
        ? `Avg ${formatCoachesAverage(mineCoach.coachesTotalSum, completePositionCount)}`
        : 'No complete ballots';
    return {
      code,
      label: formatPlayerPosition(code, ctx.positions),
      playerCount: Math.max(statList.length, eligibleIds.length),
      statistical: placeOf(
        mineStat?.overallRank ?? null,
        rankedCount(statList, 'overallRank'),
        mineStat?.totalScore != null
          ? `Standing ${formatScore(mineStat.totalScore)}`
          : 'Unscored',
      ),
      adjusted: placeOf(
        mineAdj?.adjustedRank ?? null,
        rankedCount(adjList, 'adjustedRank'),
        mineAdj?.adjustedRank == null
          ? 'Unscored'
          : formatScore(mineAdj.adjustedTotalScore),
      ),
      coaches: placeOf(
        mineCoach?.coachesRank ?? null,
        mineCoach?.coachesRank != null ? eligibleIds.length : 0,
        coachDetail,
      ),
    };
  });

  const rankingLabels = visibleRankingLabels(ctx.labels);
  const categories: CategoryPlacementRow[] = rankingLabels.map((label) => {
    const score = ranking.labelScores[label.id];
    return {
      id: label.id,
      name: label.name,
      score: score?.score ?? null,
      adjustedScore: score?.adjustedScore ?? null,
    };
  });

  const playerEntries = ctx.entries.filter(
    (entry) => entry.playerId === player.id,
  );
  const labelNameById = new Map(ctx.labels.map((label) => [label.id, label.name]));
  const nestedStanding = new Map<string, number>();
  for (const score of Object.values(ranking.labelScores)) {
    for (const nested of score.metrics) {
      if (!nestedStanding.has(nested.metricId)) {
        nestedStanding.set(nested.metricId, nested.poolScore);
      }
    }
  }
  const metrics: MetricPlacementRow[] = ctx.metrics
    .filter((metric) => metric.type !== 'attendance')
    .map((metric) => {
      const triple = metricValueTriple(playerEntries, metric);
      const standing = nestedStanding.get(metric.id);
      if (
        triple.average == null &&
        triple.latest == null &&
        triple.best == null &&
        standing == null
      ) {
        return null;
      }
      const dash = (value: number | null) =>
        value == null ? '—' : formatTeamMetricValue(value, metric);
      return {
        metricId: metric.id,
        metricName: metric.name,
        category:
          labelNameById.get(metric.primaryLabelId) ??
          labelNameById.get(metric.labelIds[0] ?? '') ??
          'Other',
        standing: standing == null ? '—' : String(Math.round(standing)),
        average: dash(triple.average),
        latest: dash(triple.latest),
        best: dash(triple.best),
      } satisfies MetricPlacementRow;
    })
    .filter((row): row is MetricPlacementRow => row != null)
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.metricName.localeCompare(b.metricName),
    );

  const accent =
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ctx.team.primaryColor || '')
      ? ctx.team.primaryColor
      : '#0f766e';

  return {
    teamName: ctx.team.name.trim() || 'Team',
    clubName: ctx.team.clubName.trim(),
    season: ctx.team.season.trim(),
    ageGroup: ctx.team.ageGroup.trim(),
    accent,
    printedAt: formatPrintDate(ctx.printedAt ?? new Date()),
    playerName: player.name,
    jersey: player.jerseyNumber,
    publicId: displayPublicId(player),
    positionsLabel: formatPlayerPositions(player, ctx.positions),
    foot: player.preferredFoot,
    grade: player.grade != null ? String(player.grade) : '',
    birthYear: player.birthYear != null ? String(player.birthYear) : '',
    statusNote: statusNoteFor(player),
    notes: player.notes?.trim() ?? '',
    attendanceRate:
      ranking.attendanceRate != null ? `${ranking.attendanceRate}%` : '—',
    overall,
    positions,
    categories,
    metrics,
  };
}

function radarSvg(categories: CategoryPlacementRow[], accent: string): string {
  const scored = categories.filter((row) => row.score != null);
  if (scored.length < 3) return '';
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const n = scored.length;
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };
  const rings = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const pts = Array.from({ length: n }, (_, i) => {
        const p = point(i, ratio);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="#d4d4d4" stroke-width="0.6"/>`;
    })
    .join('');
  const spokes = Array.from({ length: n }, (_, i) => {
    const p = point(i, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#e5e5e5" stroke-width="0.6"/>`;
  }).join('');
  const valuePts = scored
    .map((row, i) => {
      const p = point(i, Math.max(0, Math.min(100, row.score ?? 0)) / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
  const labels = scored
    .map((row, i) => {
      const p = point(i, 1.22);
      return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#444" font-family="ui-sans-serif, system-ui, sans-serif">${escapeHtml(row.name)}</text>`;
    })
    .join('');
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" width="220" height="220" aria-hidden="true">${rings}${spokes}<polygon points="${valuePts}" fill="${escapeHtml(accent)}" fill-opacity="0.18" stroke="${escapeHtml(accent)}" stroke-width="1.6"/>${labels}</svg>`;
}

function categoryBars(categories: CategoryPlacementRow[]): string {
  if (categories.length === 0) {
    return `<p class="empty">No categories configured.</p>`;
  }
  return categories
    .map((row) => {
      const width = row.score == null ? 0 : Math.max(0, Math.min(100, row.score));
      return `<div class="bar-row">
        <span class="bar-label">${escapeHtml(row.name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
        <span class="bar-score">${row.score == null ? '—' : escapeHtml(formatScore(row.score))}</span>
      </div>`;
    })
    .join('');
}

function overallCards(doc: PlayerPlacementDocument): string {
  const cells: Array<{ title: string; place: RankPlace }> = [
    { title: 'Statistical', place: doc.overall.statistical },
    { title: 'Adjusted', place: doc.overall.adjusted },
    { title: 'Coaches', place: doc.overall.coaches },
  ];
  return cells
    .map(
      (cell) => `<div class="stat-card">
      <p class="stat-kicker">${cell.title}</p>
      <p class="stat-place">${escapeHtml(formatPlace(cell.place))}</p>
      <p class="stat-detail">${escapeHtml(cell.place.detail)}</p>
    </div>`,
    )
    .join('');
}

function positionsTable(rows: PositionPlacementRow[]): string {
  if (rows.length === 0) {
    return `<p class="empty">No positions assigned.</p>`;
  }
  const body = rows
    .map(
      (row) => `<tr>
      <td>${escapeHtml(row.label)}</td>
      <td class="num">${row.playerCount}</td>
      <td class="num">${escapeHtml(formatPlace(row.statistical))}</td>
      <td class="num">${escapeHtml(formatPlace(row.adjusted))}</td>
      <td class="num">${escapeHtml(formatPlace(row.coaches))}</td>
    </tr>`,
    )
    .join('');
  return `<table>
    <thead>
      <tr>
        <th>Position</th>
        <th class="num">Pool</th>
        <th class="num">Statistical</th>
        <th class="num">Adjusted</th>
        <th class="num">Coaches</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function metricsTable(rows: MetricPlacementRow[]): string {
  if (rows.length === 0) {
    return `<p class="empty">No scored metrics yet.</p>`;
  }
  let lastCategory = '';
  const body = rows
    .map((row) => {
      const head =
        row.category !== lastCategory
          ? `<tr class="cat"><td colspan="5">${escapeHtml(row.category)}</td></tr>`
          : '';
      lastCategory = row.category;
      return `${head}<tr>
        <td>${escapeHtml(row.metricName)}</td>
        <td class="num">${escapeHtml(row.standing)}</td>
        <td class="num">${escapeHtml(row.average)}</td>
        <td class="num">${escapeHtml(row.latest)}</td>
        <td class="num">${escapeHtml(row.best)}</td>
      </tr>`;
    })
    .join('');
  return `<table>
    <thead>
      <tr>
        <th>Metric</th>
        <th class="num">Squad standing</th>
        <th class="num">Average</th>
        <th class="num">Latest</th>
        <th class="num">Best</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function identityMeta(doc: PlayerPlacementDocument): string {
  const bits = [
    doc.positionsLabel && `Positions ${doc.positionsLabel}`,
    `Foot ${doc.foot}`,
    doc.grade && `Grade ${doc.grade}`,
    doc.birthYear && `Born ${doc.birthYear}`,
    doc.publicId !== '—' && `ID ${doc.publicId}`,
  ].filter(Boolean) as string[];
  return bits.map((bit) => escapeHtml(bit)).join(' · ');
}

function pageFooter(doc: PlayerPlacementDocument, page: 1 | 2): string {
  const club = [doc.clubName, doc.ageGroup].filter(Boolean).join(' · ');
  return `<footer>
    <span>${escapeHtml(doc.teamName)}${club ? ` · ${escapeHtml(club)}` : ''} · Player placement sheet</span>
    <span>Page ${page} of 2 · ${escapeHtml(doc.printedAt)}</span>
  </footer>`;
}

function playerPagesHtml(doc: PlayerPlacementDocument): string {
  const seasonBit = [doc.season, doc.ageGroup].filter(Boolean).join(' · ');
  const radar = radarSvg(doc.categories, doc.accent);
  const notes = doc.notes
    ? `<section class="block">
        <h2>Coach comments</h2>
        <p class="notes">${escapeHtml(doc.notes)}</p>
      </section>`
    : '';
  return `<div class="page">
  <div class="sheet">
    <header>
      <p class="kicker">${escapeHtml(doc.clubName || doc.teamName)}${seasonBit ? ` · ${escapeHtml(seasonBit)}` : ''}</p>
      <h1>Player placement sheet</h1>
      <p class="lede">Overall standing and assigned-position ranks for team placement.</p>
    </header>
    <div class="identity">
      <div class="mono" aria-hidden="true">${escapeHtml(initials(doc.playerName))}</div>
      <div class="who">
        <p class="name">${escapeHtml(doc.playerName)} <span class="jersey">#${doc.jersey}</span></p>
        <p class="meta">${identityMeta(doc)}</p>
        ${doc.statusNote ? `<p class="status">${escapeHtml(doc.statusNote)}</p>` : ''}
      </div>
      <div class="att">
        <p class="stat-kicker">Attendance</p>
        <p class="stat-place">${escapeHtml(doc.attendanceRate)}</p>
      </div>
    </div>
    <section class="block">
      <h2>Squad standing</h2>
      <div class="stat-row">${overallCards(doc)}</div>
    </section>
    <section class="block">
      <h2>Assigned position ranks</h2>
      <p class="hint">Coaches Rank here is a separate 1…N for each role — not a slice of overall rank. Pool is everyone assigned that position.</p>
      ${positionsTable(doc.positions)}
    </section>
    <section class="block">
      <h2>Category profile</h2>
      <div class="profile-grid">
        <div class="bars">${categoryBars(doc.categories)}</div>
        ${radar ? `<div class="radar-wrap">${radar}</div>` : ''}
      </div>
    </section>
    ${pageFooter(doc, 1)}
  </div>
</div>
<div class="page">
  <div class="sheet">
    <header>
      <p class="kicker">${escapeHtml(doc.playerName)} · #${doc.jersey}</p>
      <h1>Performance detail</h1>
      <p class="lede">Metric standing is the squad percentile (100 = best). Average / latest / best use logged sessions.</p>
    </header>
    <section class="block">
      ${metricsTable(doc.metrics)}
    </section>
    ${notes}
    ${pageFooter(doc, 2)}
  </div>
</div>`;
}

const PLACEMENT_STYLES = `
  @page { size: letter portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #111;
    background: #fff;
    font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
  }
  .page {
    width: 8.5in;
    height: 11in;
    padding: 0.42in 0.48in 0.38in;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .sheet {
    width: 7.54in;
    height: 10.2in;
    display: flex;
    flex-direction: column;
    transform-origin: top left;
  }
  header { margin: 0 0 10px; }
  .kicker {
    margin: 0 0 2px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #444;
  }
  h1 {
    margin: 0;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .lede {
    margin: 4px 0 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8pt;
    color: #444;
  }
  .identity {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 0 12px;
    border-top: 2px solid #111;
    border-bottom: 1px solid #d4d4d4;
    margin-bottom: 12px;
  }
  .mono {
    width: 48px;
    height: 48px;
    border: 1.5px solid #111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-weight: 800;
    font-size: 13pt;
    letter-spacing: 0.04em;
  }
  .name {
    margin: 0;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .jersey { font-variant-numeric: tabular-nums; color: #333; }
  .meta, .status {
    margin: 3px 0 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8pt;
    color: #444;
  }
  .status { font-weight: 700; color: #7c2d12; }
  .att { text-align: right; }
  .block { margin: 0 0 12px; }
  h2 {
    margin: 0 0 6px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .hint {
    margin: -2px 0 6px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7.5pt;
    color: #555;
  }
  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat-card, .att {
    border: 1px solid #d4d4d4;
    padding: 8px 10px;
  }
  .att { border: 0; padding: 0; }
  .stat-kicker {
    margin: 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #555;
  }
  .stat-place {
    margin: 2px 0 0;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  .stat-detail {
    margin: 2px 0 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7.5pt;
    color: #444;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9pt;
  }
  th {
    text-align: left;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 1.5px solid #111;
    padding: 3px 6px;
  }
  td {
    padding: 3.5px 6px;
    border-bottom: 0.4px solid #d4d4d4;
    font-variant-numeric: tabular-nums;
  }
  th.num, td.num { text-align: right; }
  tr.cat td {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7pt;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #444;
    padding-top: 8px;
    border-bottom: 0.8px solid #111;
  }
  .profile-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 1.3in 1fr 0.45in;
    gap: 8px;
    align-items: center;
    margin: 0 0 5px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8pt;
  }
  .bar-label { color: #222; }
  .bar-track {
    height: 7px;
    background: #ececec;
    border: 0.5px solid #d4d4d4;
  }
  .bar-fill {
    display: block;
    height: 100%;
    background: #111;
  }
  .bar-score { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .empty {
    margin: 0;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8pt;
    color: #666;
  }
  .notes {
    margin: 0;
    font-size: 9pt;
    line-height: 1.35;
    white-space: pre-wrap;
  }
  footer {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #d4d4d4;
    display: flex;
    justify-content: space-between;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 7pt;
    color: #555;
  }
`;

export function playerPlacementHtml(
  docs: PlayerPlacementDocument[],
): string {
  const title =
    docs.length === 1
      ? `${docs[0].playerName} · Placement`
      : `${docs[0]?.teamName ?? 'Team'} · Placement sheets`;
  const pages = docs.map((doc) => playerPagesHtml(doc)).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PLACEMENT_STYLES}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

export function openPlayerPlacementPrint(
  players: Player[],
  ctx: PlayerPlacementPrintContext,
): void {
  const docs = players.map((player) =>
    buildPlayerPlacementDocument(player, ctx),
  );
  if (docs.length === 0) return;
  openPrintHtml(playerPlacementHtml(docs));
}
