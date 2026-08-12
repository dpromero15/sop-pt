import React, { useEffect, useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import type {
  CalculatedFieldDefinition,
  LabelDefinition,
  MetricDefinition,
  RankingBoundariesConfig,
  RankingCutPair,
} from '../types';
import { StorageService } from '../services/storage';
import { normalizeRankingBoundaries } from '../utils/rankingBoundaries';

type CutConfigMode = 'all' | 'scoped';

interface RankingBoundariesPanelProps {
  boundaries: RankingBoundariesConfig;
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  calculatedFields: CalculatedFieldDefinition[];
  onRefreshData: () => void;
}

function pairFromForm(
  primary: string,
  secondary: string,
  fallbacks: RankingCutPair,
): RankingCutPair {
  return {
    primaryCut: Math.max(1, Math.floor(Number(primary) || fallbacks.primaryCut)),
    secondaryCut: Math.max(
      1,
      Math.floor(Number(secondary) || fallbacks.secondaryCut),
    ),
  };
}

export const RankingBoundariesPanel: React.FC<RankingBoundariesPanelProps> = ({
  boundaries,
  labels,
  metrics,
  calculatedFields,
  onRefreshData,
}) => {
  const normalized = useMemo(
    () => normalizeRankingBoundaries(boundaries),
    [boundaries],
  );

  const [mode, setMode] = useState<CutConfigMode>('all');
  const [primary, setPrimary] = useState(String(normalized.primaryCut));
  const [secondary, setSecondary] = useState(String(normalized.secondaryCut));
  const [gkCut, setGkCut] = useState(String(normalized.specialtyCuts.GK ?? 4));

  const categoryOptions = useMemo(
    () => labels.filter((l) => l.id !== 'attendance'),
    [labels],
  );

  const [categoryId, setCategoryId] = useState(
    () => categoryOptions[0]?.id ?? '',
  );
  const [measureId, setMeasureId] = useState('');
  const [scopedPrimary, setScopedPrimary] = useState('8');
  const [scopedSecondary, setScopedSecondary] = useState('16');

  useEffect(() => {
    setPrimary(String(normalized.primaryCut));
    setSecondary(String(normalized.secondaryCut));
    setGkCut(String(normalized.specialtyCuts.GK ?? 4));
  }, [normalized.primaryCut, normalized.secondaryCut, normalized.specialtyCuts.GK]);

  useEffect(() => {
    if (!categoryId && categoryOptions[0]) {
      setCategoryId(categoryOptions[0].id);
    }
  }, [categoryId, categoryOptions]);

  const measuresForCategory = useMemo(() => {
    if (!categoryId) return { metrics: [] as MetricDefinition[], calculated: [] as CalculatedFieldDefinition[] };
    const catMetrics = metrics.filter((m) => m.labelId === categoryId);
    const catMetricIds = new Set(catMetrics.map((m) => m.id));
    const catCalculated = calculatedFields.filter((f) =>
      catMetricIds.has(f.baseMetricId),
    );
    return { metrics: catMetrics, calculated: catCalculated };
  }, [categoryId, metrics, calculatedFields]);

  useEffect(() => {
    if (!categoryId) return;
    if (measureId) {
      const fromMetric = normalized.metricCuts[measureId];
      if (fromMetric) {
        setScopedPrimary(String(fromMetric.primaryCut));
        setScopedSecondary(String(fromMetric.secondaryCut));
        return;
      }
    }
    const fromCategory = normalized.categoryCuts[categoryId];
    if (fromCategory) {
      setScopedPrimary(String(fromCategory.primaryCut));
      setScopedSecondary(String(fromCategory.secondaryCut));
      return;
    }
    setScopedPrimary(String(normalized.primaryCut));
    setScopedSecondary(String(normalized.secondaryCut));
  }, [
    categoryId,
    measureId,
    normalized.categoryCuts,
    normalized.metricCuts,
    normalized.primaryCut,
    normalized.secondaryCut,
  ]);

  const handleSaveAll = () => {
    const primaryCut = Math.max(1, Math.floor(Number(primary) || 18));
    const secondaryCut = Math.max(1, Math.floor(Number(secondary) || 36));
    const gk = Math.max(1, Math.floor(Number(gkCut) || 4));
    StorageService.saveRankingBoundaries({
      ...normalized,
      primaryCut,
      secondaryCut,
      specialtyCuts: { ...normalized.specialtyCuts, GK: gk },
    });
    onRefreshData();
  };

  const handleSaveScoped = () => {
    if (!categoryId) return;
    const pair = pairFromForm(scopedPrimary, scopedSecondary, {
      primaryCut: normalized.primaryCut,
      secondaryCut: normalized.secondaryCut,
    });
    const next: RankingBoundariesConfig = {
      ...normalized,
      categoryCuts: { ...normalized.categoryCuts },
      metricCuts: { ...normalized.metricCuts },
    };
    if (measureId) {
      next.metricCuts = { ...next.metricCuts, [measureId]: pair };
    } else {
      next.categoryCuts = { ...next.categoryCuts, [categoryId]: pair };
    }
    StorageService.saveRankingBoundaries(next);
    onRefreshData();
  };

  const handleClearScoped = () => {
    if (!categoryId) return;
    const next: RankingBoundariesConfig = {
      ...normalized,
      categoryCuts: { ...normalized.categoryCuts },
      metricCuts: { ...normalized.metricCuts },
    };
    if (measureId) {
      const { [measureId]: _removed, ...rest } = next.metricCuts ?? {};
      next.metricCuts = rest;
    } else {
      const { [categoryId]: _removed, ...rest } = next.categoryCuts ?? {};
      next.categoryCuts = rest;
    }
    StorageService.saveRankingBoundaries(next);
    onRefreshData();
  };

  const scopedSaved = measureId
    ? Boolean(normalized.metricCuts[measureId])
    : Boolean(categoryId && normalized.categoryCuts[categoryId]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div className="flex items-center gap-2 text-slate-100 font-semibold">
        <Scissors className="w-5 h-5 text-violet-400" />
        <span>Ranking Cut Lines</span>
      </div>
      <p className="text-sm text-slate-400">
        Visual cut lines on rankings. Use <strong className="text-slate-300">All rankings</strong> for
        overall Adjusted cuts (defaults 18 / 36), or{' '}
        <strong className="text-slate-300">By category / metric</strong> for scoped lists
        (including calculated averages when enabled).
      </p>

      <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMode('all')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            mode === 'all'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All rankings
        </button>
        <button
          type="button"
          onClick={() => setMode('scoped')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            mode === 'scoped'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          By category / metric
        </button>
      </div>

      {mode === 'all' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Primary cut</span>
              <input
                type="number"
                min={1}
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Secondary cut</span>
              <input
                type="number"
                min={1}
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">GK specialty cut</span>
              <input
                type="number"
                min={1}
                value={gkCut}
                onChange={(e) => setGkCut(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
          >
            Save cut lines
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Category</span>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setMeasureId('');
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {categoryOptions.length === 0 ? (
                  <option value="">No categories</option>
                ) : (
                  categoryOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">
                Metric / calculated field (optional)
              </span>
              <select
                value={measureId}
                onChange={(e) => setMeasureId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Entire category</option>
                {measuresForCategory.metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    Metric: {m.name}
                  </option>
                ))}
                {measuresForCategory.calculated.map((f) => (
                  <option key={f.id} value={f.id}>
                    Calculated{f.enabled ? '' : ' (off)'}: {f.name}
                    {f.kind === 'average' ? ' · average' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Primary cut</span>
              <input
                type="number"
                min={1}
                value={scopedPrimary}
                onChange={(e) => setScopedPrimary(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Secondary cut</span>
              <input
                type="number"
                min={1}
                value={scopedSecondary}
                onChange={(e) => setScopedSecondary(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            {measureId
              ? 'Saving applies when Rankings is sorted by this metric or calculated field.'
              : 'Saving applies when Rankings is filtered to this category (no specific metric).'}
            {scopedSaved ? ' · Override saved for this scope.' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveScoped}
              disabled={!categoryId}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3 py-1.5 text-sm font-semibold text-slate-950"
            >
              Save scoped cut lines
            </button>
            {scopedSaved ? (
              <button
                type="button"
                onClick={handleClearScoped}
                className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-300"
              >
                Clear this override
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
};
