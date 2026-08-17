import React from 'react';
import type { AttendanceStatus, Player } from '../../types';
import { countAttendanceByStatus, unanimousAttendanceStatus } from '../../utils/sessionMetrics';
import { formatPlayerPosition } from '../../utils/playerPositions';

interface AttendanceMaintenanceListProps {
  players: Player[];
  attendanceMap: Record<string, AttendanceStatus>;
  onSetStatus: (playerId: string, status: AttendanceStatus) => void;
  onSetAll: (status: AttendanceStatus) => void;
}

const STATUS_ACTIONS: {
  status: AttendanceStatus;
  short: string;
  word: string;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    status: 'present',
    short: 'H',
    word: 'here',
    activeClass: 'bg-emerald-500 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
  {
    status: 'late',
    short: 'L',
    word: 'late',
    activeClass: 'bg-amber-400 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
  {
    status: 'absent',
    short: 'O',
    word: 'out',
    activeClass: 'bg-rose-500 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
  {
    status: 'excused',
    short: 'E',
    word: 'excused',
    activeClass: 'bg-amber-600 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
];

function StatusToggleGroup({
  current,
  onSelect,
  groupLabel,
  labelFor,
}: {
  current: AttendanceStatus | undefined;
  onSelect: (status: AttendanceStatus) => void;
  groupLabel: string;
  labelFor: (word: string) => string;
}) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex shrink-0 overflow-hidden rounded-md border border-slate-700"
    >
      {STATUS_ACTIONS.map(({ status, short, word, activeClass, idleClass }) => {
        const active = current === status;
        const label = labelFor(word);
        return (
          <button
            key={status}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onSelect(status)}
            className={`h-7 w-7 text-[11px] font-bold ${
              active ? activeClass : idleClass
            }`}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

export const AttendanceMaintenanceList: React.FC<AttendanceMaintenanceListProps> = ({
  players,
  attendanceMap,
  onSetStatus,
  onSetAll,
}) => {
  const sorted = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const playerIds = sorted.map((p) => p.id);
  const counts = countAttendanceByStatus(
    sorted.map((p) => attendanceMap[p.id] ?? 'present'),
  );
  const allStatus = unanimousAttendanceStatus(playerIds, attendanceMap);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="shrink-0 border-b border-slate-800 px-3 py-2">
        <p className="text-sm font-semibold text-slate-100">Review attendance</p>
        <p className="text-[11px] text-slate-500">
          {counts.present + counts.late} here · {counts.late} late · {counts.absent} out ·{' '}
          {counts.excused} excused
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-2.5 py-1.5 sm:gap-3 sm:px-3">
        <span className="w-7 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight text-slate-200">All</p>
          <p className="text-[10px] leading-tight text-slate-600">
            Sets everyone · then tap exceptions
          </p>
        </div>
        <StatusToggleGroup
          current={allStatus}
          onSelect={onSetAll}
          groupLabel="Set attendance for everyone"
          labelFor={(word) => `Set all ${word}`}
        />
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-slate-800/80 overflow-y-auto overscroll-contain">
        {sorted.map((player) => {
          const current = attendanceMap[player.id] ?? 'present';
          return (
            <li
              key={player.id}
              className="flex items-center gap-2 px-2.5 py-1 hover:bg-slate-950/50 sm:gap-3 sm:px-3"
            >
              <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
                {player.jerseyNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-slate-100">
                  {player.name}
                </p>
                <p className="text-[10px] leading-tight text-slate-600">
                  {formatPlayerPosition(player.position)}
                </p>
              </div>
              <StatusToggleGroup
                current={current}
                onSelect={(status) => onSetStatus(player.id, status)}
                groupLabel={`Attendance for ${player.name}`}
                labelFor={(word) => word}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
