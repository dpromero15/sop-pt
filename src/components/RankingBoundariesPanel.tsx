import React, { useEffect, useState } from 'react';
import { Scissors } from 'lucide-react';
import type { RankingBoundariesConfig } from '../types';
import { StorageService } from '../services/storage';

interface RankingBoundariesPanelProps {
  boundaries: RankingBoundariesConfig;
  onRefreshData: () => void;
}

export const RankingBoundariesPanel: React.FC<RankingBoundariesPanelProps> = ({
  boundaries,
  onRefreshData,
}) => {
  const [primary, setPrimary] = useState(String(boundaries.primaryCut));
  const [secondary, setSecondary] = useState(String(boundaries.secondaryCut));
  const [gkCut, setGkCut] = useState(String(boundaries.specialtyCuts.GK ?? 4));

  useEffect(() => {
    setPrimary(String(boundaries.primaryCut));
    setSecondary(String(boundaries.secondaryCut));
    setGkCut(String(boundaries.specialtyCuts.GK ?? 4));
  }, [boundaries.primaryCut, boundaries.secondaryCut, boundaries.specialtyCuts.GK]);

  const handleSave = () => {
    const primaryCut = Math.max(1, Math.floor(Number(primary) || 18));
    const secondaryCut = Math.max(1, Math.floor(Number(secondary) || 36));
    const gk = Math.max(1, Math.floor(Number(gkCut) || 4));
    StorageService.saveRankingBoundaries({
      primaryCut,
      secondaryCut,
      specialtyCuts: { ...boundaries.specialtyCuts, GK: gk },
    });
    onRefreshData();
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div className="flex items-center gap-2 text-slate-100 font-semibold">
        <Scissors className="w-5 h-5 text-violet-400" />
        <span>Ranking Cut Lines</span>
      </div>
      <p className="text-sm text-slate-400">
        Visual cut lines on Adjusted rankings (defaults 18 / 36 for two teams of
        18). Specialty GK cut defaults to 4.
      </p>
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
        onClick={handleSave}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
      >
        Save cut lines
      </button>
    </section>
  );
};
