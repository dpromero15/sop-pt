import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Minus, Plus, Play, Square, RotateCcw, SkipForward } from 'lucide-react';
import type { MetricDefinition, Player } from '../../types';

interface PlayerScoreCardProps {
  player: Player;
  metric: MetricDefinition;
  initialValue?: number;
  remaining: number;
  total: number;
  onSave: (value: number, rawValue: string) => void;
  onSkip: () => void;
}

function formatRaw(metric: MetricDefinition, value: number): string {
  switch (metric.type) {
    case 'time_seconds':
      return `${value.toFixed(2)}${metric.unit}`;
    case 'percentage':
      return `${value}%`;
    case 'rating_10':
      return `${value}/10`;
    case 'count':
      return `${value} ${metric.unit}`.trim();
    default:
      return String(value);
  }
}

export const PlayerScoreCard: React.FC<PlayerScoreCardProps> = ({
  player,
  metric,
  initialValue,
  remaining,
  total,
  onSave,
  onSkip,
}) => {
  const [value, setValue] = useState<number>(initialValue ?? (metric.type === 'count' ? 0 : 0));
  const [inputText, setInputText] = useState(
    initialValue != null ? String(initialValue) : '',
  );
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue ?? (metric.type === 'count' ? 0 : 0));
    setInputText(initialValue != null ? String(initialValue) : '');
    setStopwatchMs(0);
    setRunning(false);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [player.id, metric.id, initialValue]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStopwatchMs((t) => t + 10), 10);
    return () => window.clearInterval(id);
  }, [running]);

  const commit = (next: number) => {
    onSave(next, formatRaw(metric, next));
  };

  const stopwatchSeconds = stopwatchMs / 1000;

  const saveAndNext = () => {
    const finalValue =
      metric.type === 'time_seconds' && stopwatchMs > 0 && !inputText
        ? Number(stopwatchSeconds.toFixed(2))
        : value;
    commit(finalValue);
  };

  const scoreInputProps = {
    ref: inputRef,
    enterKeyHint: 'go' as const,
  };

  return (
    <form
      className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
      onSubmit={(e) => {
        e.preventDefault();
        saveAndNext();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {metric.name} · {total - remaining + 1}/{total}
          </p>
          <h3 className="mt-1 text-2xl font-bold text-slate-50">
            #{player.jerseyNumber} {player.name}
          </h3>
          <p className="text-sm text-slate-400">{player.position}</p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
        >
          Skip <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      {metric.type === 'count' && (
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                const next = Math.max(0, value - 1);
                setValue(next);
                setInputText(String(next));
              }}
              className="rounded-2xl border border-slate-600 bg-slate-800 p-4 text-slate-200"
            >
              <Minus className="h-6 w-6" />
            </button>
            <div className="min-w-[4rem] text-center text-5xl font-bold tabular-nums text-emerald-400">
              {value}
            </div>
            <button
              type="button"
              onClick={() => {
                const next = value + 1;
                setValue(next);
                setInputText(String(next));
              }}
              className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-emerald-300"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <input
            {...scoreInputProps}
            type="number"
            inputMode="numeric"
            step="1"
            min={0}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              const n = parseFloat(e.target.value);
              if (!Number.isNaN(n)) setValue(n);
            }}
            placeholder="Or type a number"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-center text-lg text-slate-100"
          />
        </div>
      )}

      {metric.type === 'time_seconds' && (
        <div className="space-y-4 py-2">
          <div className="text-center font-mono text-4xl tabular-nums text-cyan-300">
            {stopwatchSeconds.toFixed(2)}s
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-cyan-300"
            >
              {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? 'Stop' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setStopwatchMs(0);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-slate-300"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
          <input
            {...scoreInputProps}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              const n = parseFloat(e.target.value);
              if (!Number.isNaN(n)) setValue(n);
            }}
            placeholder="Or type seconds"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-center text-lg text-slate-100"
          />
        </div>
      )}

      {(metric.type === 'percentage' || metric.type === 'rating_10') && (
        <div className="space-y-3 py-2">
          <input
            {...scoreInputProps}
            type="number"
            inputMode="decimal"
            step={metric.type === 'rating_10' ? '0.5' : '1'}
            min={0}
            max={metric.type === 'rating_10' ? 10 : 100}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              const n = parseFloat(e.target.value);
              if (!Number.isNaN(n)) setValue(n);
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-4 text-center text-3xl font-bold text-slate-100"
            placeholder={metric.type === 'rating_10' ? '0–10' : '0–100'}
          />
          <p className="text-center text-xs text-slate-500">Unit: {metric.unit}</p>
        </div>
      )}

      {metric.type !== 'count' &&
        metric.type !== 'time_seconds' &&
        metric.type !== 'percentage' &&
        metric.type !== 'rating_10' && (
          <input
            {...scoreInputProps}
            type="number"
            inputMode="decimal"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              const n = parseFloat(e.target.value);
              if (!Number.isNaN(n)) setValue(n);
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-4 text-center text-3xl font-bold text-slate-100"
          />
        )}

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-base font-semibold text-slate-950 hover:bg-emerald-400"
      >
        Save & next <ChevronRight className="h-5 w-5" />
      </button>
    </form>
  );
};
