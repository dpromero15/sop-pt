import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, UserCheck, X, Ban, Clock } from 'lucide-react';
import type { AttendanceStatus, Player } from '../../types';
import { toggleLateStatus } from '../../utils/sessionMetrics';

interface AttendanceSwipeDeckProps {
  players: Player[];
  attendanceMap: Record<string, AttendanceStatus>;
  onSetStatus: (playerId: string, status: AttendanceStatus) => void;
  onMarkRemainingPresent: (remainingPlayerIds: string[]) => void;
  /** Reset the swipe queue when session (or other plan) changes — not on every players array refresh. */
  resetKey: string;
}

type UndoItem = { playerId: string; previous: AttendanceStatus | undefined; next: AttendanceStatus };

type DragMode = 'idle' | 'dragging' | 'longpress';

const LONG_PRESS_MS = 450;
const THRESHOLD = 100;

export const AttendanceSwipeDeck: React.FC<AttendanceSwipeDeckProps> = ({
  players,
  attendanceMap,
  onSetStatus,
  onMarkRemainingPresent,
  resetKey,
}) => {
  const [queue, setQueue] = useState<string[]>(() => players.map((p) => p.id));
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const modeRef = useRef<DragMode>('idle');
  const longPressTimer = useRef<number | null>(null);
  const activePlayerId = queue[0];
  const activePlayer = players.find((p) => p.id === activePlayerId);

  // Stable roster fingerprint — ignore new array identity from storage refresh after each swipe.
  const rosterKey = useMemo(
    () => `${resetKey}:${players.map((p) => p.id).join(',')}`,
    [resetKey, players],
  );

  useEffect(() => {
    setQueue(players.map((p) => p.id));
    setUndoStack([]);
    setOffset({ x: 0, y: 0 });
    // players is read when rosterKey changes (session or membership), not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: depend on rosterKey only
  }, [rosterKey]);

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const commitStatus = useCallback(
    (playerId: string, status: AttendanceStatus, advance: boolean) => {
      const previous = attendanceMap[playerId];
      onSetStatus(playerId, status);
      setUndoStack((stack) => [...stack, { playerId, previous, next: status }]);
      if (advance) {
        setQueue((q) => q.filter((id) => id !== playerId));
      }
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      modeRef.current = 'idle';
    },
    [attendanceMap, onSetStatus],
  );

  const applySwipe = (dx: number, dy: number) => {
    if (!activePlayerId) return;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) {
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      return;
    }
    if (Math.abs(dy) > Math.abs(dx) && dy > THRESHOLD) {
      commitStatus(activePlayerId, 'excused', true);
    } else if (dx > THRESHOLD) {
      commitStatus(activePlayerId, 'present', true);
    } else if (dx < -THRESHOLD) {
      commitStatus(activePlayerId, 'absent', true);
    } else {
      setOffset({ x: 0, y: 0 });
      setDragging(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activePlayerId) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    modeRef.current = 'idle';
    setDragging(true);
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (modeRef.current === 'dragging') return;
      modeRef.current = 'longpress';
      const current = attendanceMap[activePlayerId] ?? 'present';
      const next = toggleLateStatus(current);
      if (next !== current) {
        commitStatus(activePlayerId, next, false);
      }
      setDragging(false);
      startRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startRef.current || modeRef.current === 'longpress') return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearLongPress();
      modeRef.current = 'dragging';
    }
    if (modeRef.current === 'dragging') {
      setOffset({ x: dx, y: dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    clearLongPress();
    if (modeRef.current === 'longpress') {
      startRef.current = null;
      return;
    }
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    startRef.current = null;
    if (modeRef.current === 'dragging') {
      applySwipe(dx, dy);
    } else {
      setDragging(false);
      setOffset({ x: 0, y: 0 });
    }
    modeRef.current = 'idle';
  };

  const undo = () => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const last = stack[stack.length - 1];
      const prevStatus = last.previous ?? 'present';
      onSetStatus(last.playerId, prevStatus);
      setQueue((q) => (q.includes(last.playerId) ? q : [last.playerId, ...q]));
      return stack.slice(0, -1);
    });
  };

  const stamp =
    Math.abs(offset.y) > Math.abs(offset.x) && offset.y > 40
      ? 'EXCUSED'
      : offset.x > 40
        ? 'HERE'
        : offset.x < -40
          ? 'OUT'
          : null;

  const stampColor =
    stamp === 'HERE'
      ? 'text-emerald-400 border-emerald-400'
      : stamp === 'OUT'
        ? 'text-rose-400 border-rose-400'
        : stamp === 'EXCUSED'
          ? 'text-amber-400 border-amber-400'
          : '';

  const currentStatus = activePlayerId
    ? (attendanceMap[activePlayerId] ?? 'present')
    : null;

  if (!activePlayer) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-4">
        <Check className="mx-auto h-10 w-10 text-emerald-400" />
        <p className="text-lg font-semibold text-slate-100">Attendance complete</p>
        <p className="text-sm text-slate-400">
          {Object.values(attendanceMap).filter((s) => s === 'present' || s === 'late').length}{' '}
          scoreable ·{' '}
          {Object.values(attendanceMap).filter((s) => s === 'absent').length} absent ·{' '}
          {Object.values(attendanceMap).filter((s) => s === 'excused').length} excused
        </p>
        <button
          type="button"
          onClick={undo}
          disabled={undoStack.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" /> Undo last
        </button>
      </div>
    );
  }

  const rotation = offset.x / 20;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {queue.length} remaining · {players.length - queue.length} done
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Undo
          </button>
          <button
            type="button"
            onClick={() => {
              onMarkRemainingPresent(queue);
              setQueue([]);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300"
          >
            <UserCheck className="h-3.5 w-3.5" /> Mark rest present
          </button>
        </div>
      </div>

      <div className="relative mx-auto h-[340px] w-full max-w-sm touch-none select-none">
        {queue.slice(1, 3).map((id, i) => {
          const p = players.find((pl) => pl.id === id);
          if (!p) return null;
          return (
            <div
              key={id}
              className="absolute inset-0 rounded-2xl border border-slate-800 bg-slate-900"
              style={{
                transform: `scale(${0.96 - i * 0.03}) translateY(${(i + 1) * 8}px)`,
                zIndex: 10 - i,
              }}
            />
          );
        })}

        <div
          role="button"
          tabIndex={0}
          aria-label={`Attendance card for ${activePlayer.name}. Swipe right present, left absent, down excused. Long press toggles late.`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 z-20 flex cursor-grab flex-col justify-between rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-950 p-6 shadow-2xl active:cursor-grabbing"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.2s ease',
          }}
        >
          {stamp && (
            <div
              className={`pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 rounded-lg border-4 px-4 py-1 text-2xl font-black tracking-widest ${stampColor}`}
              style={{ opacity: Math.min(1, Math.max(Math.abs(offset.x), Math.abs(offset.y)) / 120) }}
            >
              {stamp}
            </div>
          )}

          {currentStatus === 'late' && (
            <div className="pointer-events-none absolute right-4 top-4 rounded-lg border-4 border-amber-400 px-3 py-1 text-lg font-black tracking-widest text-amber-400">
              LATE
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              #{activePlayer.jerseyNumber} · {activePlayer.position}
            </p>
            <h3 className="mt-2 text-3xl font-bold text-slate-50">{activePlayer.name}</h3>
            <p className="mt-2 text-sm capitalize text-slate-400">
              Current: {currentStatus}
            </p>
          </div>

          <p className="text-center text-xs text-slate-500">
            Swipe → here · ← out · ↓ excused · hold = late
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => commitStatus(activePlayer.id, 'absent', true)}
          className="flex flex-col items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-rose-300"
        >
          <X className="h-5 w-5" />
          <span className="text-xs">Out</span>
        </button>
        <button
          type="button"
          onClick={() => commitStatus(activePlayer.id, 'excused', true)}
          className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-amber-300"
        >
          <Ban className="h-5 w-5" />
          <span className="text-xs">Excused</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = toggleLateStatus(currentStatus ?? 'present');
            commitStatus(activePlayer.id, next, false);
          }}
          className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-amber-200"
        >
          <Clock className="h-5 w-5" />
          <span className="text-xs">Late</span>
        </button>
        <button
          type="button"
          onClick={() => commitStatus(activePlayer.id, 'present', true)}
          className="flex flex-col items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-emerald-300"
        >
          <Check className="h-5 w-5" />
          <span className="text-xs">Here</span>
        </button>
      </div>
    </div>
  );
};
