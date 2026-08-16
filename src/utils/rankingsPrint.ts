import type {
  LabelDefinition,
  MetricDefinition,
  MetricEntry,
  Player,
  PlayerRanking,
} from '../types';
import { displayPublicId } from './playerPublicId';
import { rosterPlayers } from './playerStatus';
import { formatPlayerPositions } from './playerPositions';
import { metricPrimaryLabelId } from './metricLabels';
import { metricValueTriple } from './metricAggregation';
import {
  formatTeamMetricValue,
  isUnscoredForRankMode,
  labelScoreForMode,
  metricAggregatedValue,
  type RankingsMetricSelection,
  type RankingsSortMode,
  type RankingsTotalMode,
  totalForMode,
} from './rankingsFilter';

export interface RankingsPrintMetricStats {
  average: string;
  latest: string;
  best: string;
}

export interface RankingsPrintRow {
  playerId: string;
  place: number | null;
  name: string;
  jersey: number;
  position: string;
  value: string;
  /** Avg / latest / all-time best when printing a measurable metric. */
  stats?: RankingsPrintMetricStats;
  /** Unlabeled rule under this row (after this place). */
  showCutBelow: boolean;
}

export type RankingsPrintNameMode = 'name' | 'publicId';

export interface RankingsPrintDocument {
  teamName: string;
  season: string;
  title: string;
  scopeLine: string;
  /** Squad rollup under the title when printing a metric with stats. */
  teamStatsLine?: string;
  printedAt: string;
  valueHeader: string;
  nameHeader: string;
  nameMode: RankingsPrintNameMode;
  /** True when rows include Avg / Latest / Best columns. */
  showMetricStats: boolean;
  rows: RankingsPrintRow[];
}

export interface PlayerIdLegendRow {
  publicId: string;
  name: string;
  jersey: number;
  position: string;
}

export interface PlayerIdLegendDocument {
  teamName: string;
  season: string;
  printedAt: string;
  rows: PlayerIdLegendRow[];
}

/** Printable letter area (0.4in inset) in CSS px at 96dpi. */
export const PRINT_SHEET_WIDTH_PX = 7.7 * 96;
export const PRINT_SHEET_HEIGHT_PX = 10.2 * 96;

export type PrintColumnCount = 1 | 2 | 3;

/** Extra columns once a single list would spill a letter page. */
export function printColumnCount(rowCount: number): PrintColumnCount {
  if (rowCount <= 22) return 1;
  if (rowCount <= 44) return 2;
  return 3;
}

export function splitPrintRows<T>(rows: T[], columns: PrintColumnCount): T[][] {
  if (rows.length === 0) return [[]];
  const size = Math.ceil(rows.length / columns);
  const out: T[][] = [];
  for (let i = 0; i < columns; i++) {
    const chunk = rows.slice(i * size, (i + 1) * size);
    if (chunk.length > 0) out.push(chunk);
  }
  return out;
}

export function printSheetDensity(rowsPerColumn: number): {
  bodyPt: number;
  titlePt: number;
  padPx: number;
} {
  if (rowsPerColumn <= 16) return { bodyPt: 11, titlePt: 18, padPx: 5 };
  if (rowsPerColumn <= 20) return { bodyPt: 10, titlePt: 16, padPx: 4 };
  if (rowsPerColumn <= 24) return { bodyPt: 9, titlePt: 15, padPx: 3 };
  if (rowsPerColumn <= 30) return { bodyPt: 8, titlePt: 14, padPx: 2 };
  return { bodyPt: 7.5, titlePt: 13, padPx: 1 };
}

/** Scale ≤1 so content fits the printable sheet. */
export function computePrintScale(
  contentWidth: number,
  contentHeight: number,
  pageWidth = PRINT_SHEET_WIDTH_PX,
  pageHeight = PRINT_SHEET_HEIGHT_PX,
): number {
  if (contentWidth <= 0 || contentHeight <= 0) return 1;
  const raw = Math.min(pageWidth / contentWidth, pageHeight / contentHeight);
  if (raw >= 1) return 1;
  return Math.max(0.25, raw * 0.98);
}

export function fitPrintSheetToPage(frameDoc: Document): number {
  const sheets = Array.from(
    frameDoc.querySelectorAll('.sheet'),
  ) as HTMLElement[];
  if (sheets.length === 0) return 1;
  let min = 1;
  for (const sheet of sheets) {
    const page = sheet.closest('.page') as HTMLElement | null;
    const pageW = page?.clientWidth || PRINT_SHEET_WIDTH_PX;
    const pageH = page?.clientHeight || PRINT_SHEET_HEIGHT_PX;
    const scale = computePrintScale(
      sheet.scrollWidth,
      sheet.scrollHeight,
      pageW,
      pageH,
    );
    sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
    min = Math.min(min, scale);
  }
  return min;
}

function formatCoachesAverage(sum: number, ballotCount: number): string {
  if (ballotCount <= 0) return String(sum);
  const avg = sum / ballotCount;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
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

function printValue(
  ranking: PlayerRanking,
  sortBy: RankingsSortMode,
  selectedLabelId: string | 'all',
  selectedMetricId: RankingsMetricSelection,
  metrics: MetricDefinition[],
  totalMode: RankingsTotalMode,
  individualOrdinals: Map<string, number> | null | undefined,
  completeBallotCount: number,
): string {
  const ordinal = individualOrdinals?.get(ranking.player.id);
  if (ordinal != null) return String(ordinal);

  if (sortBy === 'metric' && selectedMetricId !== 'none') {
    const metric = metrics.find((m) => m.id === selectedMetricId);
    if (!metric) return '—';
    const raw = metricAggregatedValue(
      ranking,
      metric.id,
      metricPrimaryLabelId(metric),
    );
    return raw == null ? '—' : formatTeamMetricValue(raw, metric);
  }

  if (sortBy === 'label' && selectedLabelId !== 'all') {
    const score = labelScoreForMode(ranking, selectedLabelId, totalMode);
    return score == null ? '—' : String(score);
  }

  if (totalMode === 'coaches') {
    if (ranking.coachesTotalSum == null) return '—';
    return completeBallotCount > 0
      ? formatCoachesAverage(ranking.coachesTotalSum, completeBallotCount)
      : String(ranking.coachesTotalSum);
  }

  const total = totalForMode(ranking, totalMode);
  return total == null ? '—' : String(total);
}

function formatStatCell(
  value: number | null,
  metric: MetricDefinition,
): string {
  return value == null ? '—' : formatTeamMetricValue(value, metric);
}

function buildMetricStatsForPlayer(
  ranking: PlayerRanking,
  metric: MetricDefinition,
  entries: MetricEntry[],
): RankingsPrintMetricStats {
  const playerEntries = entries.filter((e) => e.playerId === ranking.player.id);
  const triple = metricValueTriple(playerEntries, metric);
  return {
    average: formatStatCell(triple.average, metric),
    latest: formatStatCell(triple.latest, metric),
    best: formatStatCell(triple.best, metric),
  };
}

function buildTeamStatsLine(
  rankings: PlayerRanking[],
  metric: MetricDefinition,
  entries: MetricEntry[],
): string | undefined {
  const averages: number[] = [];
  const latests: number[] = [];
  const bests: number[] = [];
  for (const ranking of rankings) {
    const playerEntries = entries.filter(
      (e) => e.playerId === ranking.player.id,
    );
    const triple = metricValueTriple(playerEntries, metric);
    if (triple.average != null) averages.push(triple.average);
    if (triple.latest != null) latests.push(triple.latest);
    if (triple.best != null) bests.push(triple.best);
  }
  if (averages.length === 0) return undefined;
  const avg =
    Math.round(
      (averages.reduce((a, b) => a + b, 0) / averages.length) * 100,
    ) / 100;
  const latestBest = metric.higherIsBetter
    ? Math.max(...latests)
    : Math.min(...latests);
  const allTimeBest = metric.higherIsBetter
    ? Math.max(...bests)
    : Math.min(...bests);
  return `Team · Avg ${formatTeamMetricValue(avg, metric)} · Latest best ${formatTeamMetricValue(latestBest, metric)} · All-time ${formatTeamMetricValue(allTimeBest, metric)} · ${averages.length} of ${rankings.length} scored`;
}

export function buildRankingsPrintDocument(opts: {
  teamName: string;
  season?: string;
  rankings: PlayerRanking[];
  sortBy: RankingsSortMode;
  selectedLabelId: string | 'all';
  selectedMetricId: RankingsMetricSelection;
  metrics: MetricDefinition[];
  labels: LabelDefinition[];
  totalMode: RankingsTotalMode;
  coachesScopeLabel?: string;
  rankingPoolLabel?: string;
  completeBallotCount?: number;
  individualOrdinals?: Map<string, number> | null;
  cutLines: number[];
  nameMode?: RankingsPrintNameMode;
  /** Raw entries — enables Avg / Latest / Best columns on metric sheets. */
  entries?: MetricEntry[];
  printedAt?: Date;
}): RankingsPrintDocument {
  const {
    teamName,
    season = '',
    rankings,
    sortBy,
    selectedLabelId,
    selectedMetricId,
    metrics,
    labels,
    totalMode,
    coachesScopeLabel = 'All coaches',
    rankingPoolLabel,
    completeBallotCount = 0,
    individualOrdinals,
    cutLines,
    nameMode = 'name',
    entries = [],
    printedAt = new Date(),
  } = opts;

  const cuts = [...new Set(cutLines.filter((n) => n >= 1))].sort((a, b) => a - b);
  const activeMetric =
    sortBy === 'metric' && selectedMetricId !== 'none'
      ? metrics.find((m) => m.id === selectedMetricId)
      : undefined;
  const activeLabel =
    selectedLabelId !== 'all'
      ? labels.find((l) => l.id === selectedLabelId)
      : undefined;

  const showMetricStats = Boolean(activeMetric && entries.length > 0);

  let title: string;
  let valueHeader: string;
  let scopeLine: string;
  let teamStatsLine: string | undefined;

  if (totalMode === 'coaches') {
    title = rankingPoolLabel
      ? `Coaches Rank · ${rankingPoolLabel}`
      : 'Coaches Rank';
    valueHeader = individualOrdinals ? 'Ordinal' : 'Average';
    const ballotScope = individualOrdinals
      ? `${coachesScopeLabel} · complete ballot`
      : `${coachesScopeLabel} · complete ballots`;
    if (rankingPoolLabel) {
      const lineMeaning =
        cuts.length > 1
          ? `Substitutes after ${cuts[0]} · cuts after ${cuts[cuts.length - 1]}`
          : cuts.length === 1
            ? `Cuts after ${cuts[0]}`
            : '';
      scopeLine = [ballotScope, 'position pool', lineMeaning]
        .filter(Boolean)
        .join(' · ');
    } else {
      scopeLine = ballotScope;
    }
  } else if (activeMetric) {
    title = activeMetric.name;
    valueHeader = showMetricStats ? 'Best' : 'Value';
    scopeLine = showMetricStats
      ? totalMode === 'adjusted'
        ? 'Adjusted · Avg / Latest / All-time best'
        : 'Statistical · Avg / Latest / All-time best'
      : totalMode === 'adjusted'
        ? 'Adjusted · single metric'
        : 'Statistical · single metric';
    if (showMetricStats) {
      teamStatsLine = buildTeamStatsLine(rankings, activeMetric, entries);
    }
  } else if (activeLabel) {
    title = `${activeLabel.name} standing`;
    valueHeader = 'Standing';
    scopeLine = totalMode === 'adjusted' ? 'Adjusted' : 'Statistical';
  } else {
    title = totalMode === 'adjusted' ? 'Adjusted Rank' : 'Statistical Rank';
    valueHeader = 'Standing';
    scopeLine = 'All categories';
  }

  let scoredCount = 0;
  const rows: RankingsPrintRow[] = rankings.map((ranking) => {
    const unscored = individualOrdinals
      ? !individualOrdinals.has(ranking.player.id)
      : isUnscoredForRankMode(
          ranking,
          sortBy,
          selectedLabelId,
          selectedMetricId,
          metrics,
          totalMode,
        );
    const place = unscored ? null : ++scoredCount;
    const stats =
      showMetricStats && activeMetric
        ? buildMetricStatsForPlayer(ranking, activeMetric, entries)
        : undefined;
    return {
      playerId: ranking.player.id,
      place,
      name:
        nameMode === 'publicId'
          ? displayPublicId(ranking.player)
          : ranking.player.name,
      jersey: ranking.player.jerseyNumber,
      position: formatPlayerPositions(ranking.player),
      value: printValue(
        ranking,
        sortBy,
        selectedLabelId,
        selectedMetricId,
        metrics,
        totalMode,
        individualOrdinals,
        completeBallotCount,
      ),
      stats,
      showCutBelow: place != null && cuts.includes(place),
    };
  });

  return {
    teamName: teamName.trim() || 'Team',
    season: season.trim(),
    title,
    scopeLine,
    teamStatsLine,
    printedAt: formatPrintDate(printedAt),
    valueHeader,
    nameHeader: nameMode === 'publicId' ? 'ID' : 'Player',
    nameMode,
    showMetricStats,
    rows,
  };
}

export function buildPlayerIdLegendDocument(opts: {
  teamName: string;
  season?: string;
  players: Player[];
  printedAt?: Date;
}): PlayerIdLegendDocument {
  const rows = rosterPlayers(opts.players)
    .slice()
    .sort(
      (a, b) =>
        a.jerseyNumber - b.jerseyNumber || a.name.localeCompare(b.name),
    )
    .map((player) => ({
      publicId: displayPublicId(player),
      name: player.name,
      jersey: player.jerseyNumber,
      position: formatPlayerPositions(player),
    }));

  return {
    teamName: opts.teamName.trim() || 'Team',
    season: (opts.season ?? '').trim(),
    printedAt: formatPrintDate(opts.printedAt ?? new Date()),
    rows,
  };
}

function printRowHtml(
  row: RankingsPrintRow,
  nameMode: RankingsPrintNameMode,
  showMetricStats: boolean,
): string {
  const place = row.place == null ? '—' : String(row.place);
  const cutClass = row.showCutBelow ? ' class="breakout"' : '';
  const nameClass = nameMode === 'publicId' ? 'name id' : 'name';
  if (showMetricStats && row.stats) {
    return `<tr${cutClass}><td class="rank">${place}</td><td class="jersey">#${row.jersey}</td><td class="${nameClass}">${escapeHtml(row.name)}</td><td class="value">${escapeHtml(row.stats.average)}</td><td class="value">${escapeHtml(row.stats.latest)}</td><td class="value">${escapeHtml(row.stats.best)}</td></tr>`;
  }
  return `<tr${cutClass}><td class="rank">${place}</td><td class="jersey">#${row.jersey}</td><td class="${nameClass}">${escapeHtml(row.name)}</td><td class="pos">${escapeHtml(row.position)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`;
}

function printTableHtml(
  rows: RankingsPrintRow[],
  valueHeader: string,
  nameHeader: string,
  nameMode: RankingsPrintNameMode,
  showMetricStats: boolean,
): string {
  const body = rows
    .map((row) => printRowHtml(row, nameMode, showMetricStats))
    .join('');
  if (showMetricStats) {
    return `<table>
    <thead>
      <tr>
        <th class="rank">Rank</th>
        <th class="jersey">No.</th>
        <th>${escapeHtml(nameHeader)}</th>
        <th class="value">Avg</th>
        <th class="value">Latest</th>
        <th class="value">Best</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
  }
  return `<table>
    <thead>
      <tr>
        <th class="rank">Rank</th>
        <th class="jersey">No.</th>
        <th>${escapeHtml(nameHeader)}</th>
        <th class="pos">Pos</th>
        <th class="value">${escapeHtml(valueHeader)}</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function rankingsPrintHtml(doc: RankingsPrintDocument): string {
  const seasonBit = doc.season ? ` · ${escapeHtml(doc.season)}` : '';
  const columns = printColumnCount(doc.rows.length);
  const chunks = splitPrintRows(doc.rows, columns);
  const rowsPerColumn = Math.max(1, ...chunks.map((c) => c.length));
  const density = printSheetDensity(rowsPerColumn);
  const tables = chunks
    .map((chunk) =>
      printTableHtml(
        chunk,
        doc.valueHeader,
        doc.nameHeader,
        doc.nameMode,
        doc.showMetricStats,
      ),
    )
    .join('');
  const teamStats = doc.teamStatsLine
    ? `<p class="team-stats">${escapeHtml(doc.teamStatsLine)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.teamName)} · ${escapeHtml(doc.title)}</title>
  <style>
    @page { size: letter portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      color: #111;
      font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
      font-size: ${density.bodyPt}pt;
    }
    .page {
      width: 8.5in;
      height: 11in;
      padding: 0.4in;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .sheet {
      width: 7.7in;
      transform-origin: top left;
    }
    header { margin: 0 0 8px; }
    h1 {
      margin: 0;
      font-size: ${density.titlePt}pt;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .kicker {
      margin: 0 0 2px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #444;
    }
    .meta {
      margin: 4px 0 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 8pt;
      color: #444;
    }
    .team-stats {
      margin: 3px 0 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #222;
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(${columns}, minmax(0, 1fr));
      gap: 0.22in;
      align-items: start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
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
    th.value, td.value { text-align: right; }
    td {
      padding: ${density.padPx}px 6px;
      border-bottom: 0.4px solid #d4d4d4;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    td.name, td.pos {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    td.id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.08em;
      font-weight: 700;
    }
    tr.breakout td {
      border-bottom: 2px dotted #111;
    }
    .rank { width: 2.4rem; }
    .jersey { width: 2.6rem; color: #444; }
    .pos { width: 2.4rem; }
  </style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <header>
        <p class="kicker">${escapeHtml(doc.teamName)}${seasonBit}</p>
        <h1>${escapeHtml(doc.title)}</h1>
        <p class="meta">${escapeHtml(doc.scopeLine)} · Printed ${escapeHtml(doc.printedAt)}</p>
        ${teamStats}
      </header>
      <div class="columns cols-${columns}">${tables}</div>
    </div>
  </div>
</body>
</html>`;
}

export function playerIdLegendHtml(doc: PlayerIdLegendDocument): string {
  const seasonBit = doc.season ? ` · ${escapeHtml(doc.season)}` : '';
  const columns = printColumnCount(doc.rows.length);
  const chunks = splitPrintRows(doc.rows, columns);
  const rowsPerColumn = Math.max(1, ...chunks.map((c) => c.length));
  const density = printSheetDensity(rowsPerColumn);
  const tables = chunks
    .map((chunk) => {
      const body = chunk
        .map(
          (row) =>
            `<tr><td class="id">${escapeHtml(row.publicId)}</td><td class="name">${escapeHtml(row.name)}</td><td class="jersey">#${row.jersey}</td><td class="pos">${escapeHtml(row.position)}</td></tr>`,
        )
        .join('');
      return `<table>
    <thead>
      <tr>
        <th class="id">ID</th>
        <th>Player</th>
        <th class="jersey">No.</th>
        <th class="pos">Pos</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.teamName)} · Player ID Legend</title>
  <style>
    @page { size: letter portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      color: #111;
      font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
      font-size: ${density.bodyPt}pt;
    }
    .page {
      width: 8.5in;
      height: 11in;
      padding: 0.4in;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .sheet {
      width: 7.7in;
      transform-origin: top left;
    }
    header { margin: 0 0 8px; }
    h1 {
      margin: 0;
      font-size: ${density.titlePt}pt;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .kicker {
      margin: 0 0 2px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #444;
    }
    .meta {
      margin: 4px 0 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 8pt;
      color: #444;
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(${columns}, minmax(0, 1fr));
      gap: 0.22in;
      align-items: start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
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
      padding: ${density.padPx}px 6px;
      border-bottom: 0.4px solid #d4d4d4;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    td.name, td.pos {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    td.id, th.id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.08em;
      font-weight: 700;
      width: 5.2rem;
    }
    .jersey { width: 2.6rem; color: #444; }
    .pos { width: 2.4rem; }
  </style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <header>
        <p class="kicker">${escapeHtml(doc.teamName)}${seasonBit}</p>
        <h1>Player ID Legend</h1>
        <p class="meta">Names stay with the coaching staff · Printed ${escapeHtml(doc.printedAt)}</p>
      </header>
      <div class="columns cols-${columns}">${tables}</div>
    </div>
  </div>
</body>
</html>`;
}

export function openPrintHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '8.5in';
  iframe.style.height = '11in';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);
  const frameDoc = iframe.contentDocument;
  if (!frameDoc) {
    iframe.remove();
    return;
  }
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
  let printed = false;
  const run = () => {
    if (printed) return;
    printed = true;
    if (iframe.contentDocument) fitPrintSheetToPage(iframe.contentDocument);
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1500);
  };
  iframe.contentWindow?.addEventListener('load', run, { once: true });
  window.setTimeout(run, 300);
}

export function openRankingsPrint(doc: RankingsPrintDocument): void {
  openPrintHtml(rankingsPrintHtml(doc));
}

export function openPlayerIdLegendPrint(doc: PlayerIdLegendDocument): void {
  openPrintHtml(playerIdLegendHtml(doc));
}

export interface PositionRankingsPrintSection {
  heading: string;
  rows: RankingsPrintRow[];
}

export interface PositionRankingsPrintDocument {
  teamName: string;
  season: string;
  title: string;
  scopeLine: string;
  printedAt: string;
  nameMode: RankingsPrintNameMode;
  valueHeader: string;
  nameHeader: string;
  sections: PositionRankingsPrintSection[];
}

export function positionRankingsPrintHtml(
  doc: PositionRankingsPrintDocument,
): string {
  const seasonBit = doc.season ? ` · ${escapeHtml(doc.season)}` : '';
  const sections = doc.sections
    .map((section) => {
      const table = printTableHtml(
        section.rows,
        doc.valueHeader,
        doc.nameHeader,
        doc.nameMode,
        false,
      );
      return `<section class="pos-section"><h2>${escapeHtml(section.heading)}</h2>${table}</section>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.teamName)} · ${escapeHtml(doc.title)}</title>
  <style>
    @page { size: letter portrait; margin: 0.45in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
      font-size: 9.5pt;
    }
    h1 { margin: 0; font-size: 16pt; font-weight: 700; }
    .kicker {
      margin: 0 0 2px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #444;
    }
    .meta {
      margin: 4px 0 10px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 8pt;
      color: #444;
    }
    .pos-section { break-inside: avoid; margin: 0 0 14px; }
    .pos-section h2 {
      margin: 0 0 4px;
      font-size: 11pt;
      border-bottom: 1px solid #111;
      padding-bottom: 2px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 2px 4px; }
    th { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #111; }
    td.rank, th.rank, td.jersey, th.jersey, td.value, th.value { text-align: right; font-variant-numeric: tabular-nums; }
    td.pos, th.pos { width: 18%; }
    tr.breakout td { border-bottom: 2px solid #111; }
  </style>
</head>
<body>
  <p class="kicker">${escapeHtml(doc.teamName)}${seasonBit}</p>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="meta">${escapeHtml(doc.scopeLine)} · ${escapeHtml(doc.printedAt)}</p>
  ${sections}
</body>
</html>`;
}

export function openPositionRankingsPrint(
  doc: PositionRankingsPrintDocument,
): void {
  openPrintHtml(positionRankingsPrintHtml(doc));
}
