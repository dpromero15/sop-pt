import type {
  LabelDefinition,
  MetricDefinition,
  PlayerRanking,
} from '../types';
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

export interface RankingsPrintDocument {
  teamName: string;
  season: string;
  title: string;
  scopeLine: string;
  printedAt: string;
  valueHeader: string;
  rows: RankingsPrintRow[];
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
      name: ranking.player.name,
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
    rows,
  };
}

export function rankingsPrintHtml(doc: RankingsPrintDocument): string {
  const seasonBit = doc.season ? ` · ${escapeHtml(doc.season)}` : '';
  const body = doc.rows
    .map((row) => {
      const place = row.place == null ? '—' : String(row.place);
      const cutClass = row.showCutBelow ? ' class="cut-after"' : '';
      return `<tr${cutClass}><td class="rank">${place}</td><td class="jersey">#${row.jersey}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.position)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.teamName)} · ${escapeHtml(doc.title)}</title>
  <style>
    @page { size: letter portrait; margin: 0.6in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
      font-size: 11pt;
    }
    h1 {
      margin: 0;
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .kicker {
      margin: 0 0 4px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #444;
    }
    .meta {
      margin: 6px 0 18px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 9pt;
      color: #444;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-bottom: 1.5px solid #111;
      padding: 6px 8px;
    }
    th.value, td.value { text-align: right; }
    td {
      padding: 6px 8px;
      border-bottom: 0.4px solid #d4d4d4;
      font-variant-numeric: tabular-nums;
    }
    tr.cut-after td {
      border-bottom: 2.25px solid #111;
    }
    .rank { width: 3.2rem; }
    .jersey { width: 3.2rem; color: #444; }
  </style>
</head>
<body>
  <p class="kicker">${escapeHtml(doc.teamName)}${seasonBit}</p>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="meta">${escapeHtml(doc.scopeLine)} · Printed ${escapeHtml(doc.printedAt)}</p>
  <table>
    <thead>
      <tr>
        <th class="rank">Rank</th>
        <th class="jersey">No.</th>
        <th>Player</th>
        <th>Pos</th>
        <th class="value">${escapeHtml(doc.valueHeader)}</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

export function openRankingsPrint(doc: RankingsPrintDocument): void {
  const html = rankingsPrintHtml(doc);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
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
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1500);
  };
  iframe.contentWindow?.addEventListener('load', run, { once: true });
  window.setTimeout(run, 300);
}
