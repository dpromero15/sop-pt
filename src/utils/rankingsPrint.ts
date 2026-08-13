import type {
  LabelDefinition,
  MetricDefinition,
  Player,
  PlayerRanking,
} from '../types';
import { displayPublicId } from './playerPublicId';
import { rosterPlayers } from './playerStatus';
import { metricPrimaryLabelId } from './metricLabels';
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

export interface RankingsPrintRow {
  playerId: string;
  place: number | null;
  name: string;
  jersey: number;
  position: string;
  value: string;
  /** Unlabeled rule under this row (after this place). */
  showCutBelow: boolean;
}

export type RankingsPrintNameMode = 'name' | 'publicId';

export interface RankingsPrintDocument {
  teamName: string;
  season: string;
  title: string;
  scopeLine: string;
  printedAt: string;
  valueHeader: string;
  nameHeader: string;
  nameMode: RankingsPrintNameMode;
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
  const sheet = frameDoc.querySelector('.sheet') as HTMLElement | null;
  const page = frameDoc.querySelector('.page') as HTMLElement | null;
  if (!sheet) return 1;
  const pageW = page?.clientWidth || PRINT_SHEET_WIDTH_PX;
  const pageH = page?.clientHeight || PRINT_SHEET_HEIGHT_PX;
  const scale = computePrintScale(
    sheet.scrollWidth,
    sheet.scrollHeight,
    pageW,
    pageH,
  );
  sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
  return scale;
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
  completeBallotCount?: number;
  individualOrdinals?: Map<string, number> | null;
  cutLines: number[];
  nameMode?: RankingsPrintNameMode;
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
    completeBallotCount = 0,
    individualOrdinals,
    cutLines,
    nameMode = 'name',
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

  let title: string;
  let valueHeader: string;
  let scopeLine: string;

  if (totalMode === 'coaches') {
    title = 'Coaches Rank';
    valueHeader = individualOrdinals ? 'Ordinal' : 'Average';
    scopeLine = individualOrdinals
      ? `${coachesScopeLabel} · complete ballot`
      : `${coachesScopeLabel} · complete ballots`;
  } else if (activeMetric) {
    title = activeMetric.name;
    valueHeader = 'Value';
    scopeLine =
      totalMode === 'adjusted' ? 'Adjusted · single metric' : 'Statistical · single metric';
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
    return {
      playerId: ranking.player.id,
      place,
      name:
        nameMode === 'publicId'
          ? displayPublicId(ranking.player)
          : ranking.player.name,
      jersey: ranking.player.jerseyNumber,
      position: ranking.player.position,
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
      showCutBelow: place != null && cuts.includes(place),
    };
  });

  return {
    teamName: teamName.trim() || 'Team',
    season: season.trim(),
    title,
    scopeLine,
    printedAt: formatPrintDate(printedAt),
    valueHeader,
    nameHeader: nameMode === 'publicId' ? 'ID' : 'Player',
    nameMode,
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
      position: player.position,
    }));

  return {
    teamName: opts.teamName.trim() || 'Team',
    season: (opts.season ?? '').trim(),
    printedAt: formatPrintDate(opts.printedAt ?? new Date()),
    rows,
  };
}

function printRowHtml(row: RankingsPrintRow, nameMode: RankingsPrintNameMode): string {
  const place = row.place == null ? '—' : String(row.place);
  const cutClass = row.showCutBelow ? ' class="breakout"' : '';
  const nameClass = nameMode === 'publicId' ? 'name id' : 'name';
  return `<tr${cutClass}><td class="rank">${place}</td><td class="jersey">#${row.jersey}</td><td class="${nameClass}">${escapeHtml(row.name)}</td><td class="pos">${escapeHtml(row.position)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`;
}

function printTableHtml(
  rows: RankingsPrintRow[],
  valueHeader: string,
  nameHeader: string,
  nameMode: RankingsPrintNameMode,
): string {
  const body = rows.map((row) => printRowHtml(row, nameMode)).join('');
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
      printTableHtml(chunk, doc.valueHeader, doc.nameHeader, doc.nameMode),
    )
    .join('');

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
