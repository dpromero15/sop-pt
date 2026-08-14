import React from 'react';
import type { AttendanceStatus, Player } from '../../types';
import { countAttendanceByStatus } from '../../utils/sessionMetrics';
import { formatPlayerPosition } from '../../utils/playerPositions';

interface AttendanceMaintenanceListProps {
  players: Player[];
  attendanceMap: Record<string, AttendanceStatus>;
  onSetStatus: (playerId: string, status: AttendanceStatus) => void;
}

const STATUS_ACTIONS: {
  status: AttendanceStatus;
  short: string;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    status: 'present',
    short: 'H',
    activeClass: 'bg-emerald-500 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
  {
    status: 'late',
    short: 'L',
    activeClass: 'bg-amber-400 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
  {
    status: 'absent',
    short: 'O',
    activeClass: 'bg-rose-500 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
  {
    status: 'excused',
    short: 'E',
    activeClass: 'bg-amber-600 text-slate-950',
    idleClass: 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
  },
];

export const AttendanceMaintenanceList: React.FC<AttendanceMaintenanceListProps> = ({
  players,
  attendanceMap,
  onSetStatus,
}) => {
  const sorted = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const counts = countAttendanceByStatus(
    sorted.map((p) => attendanceMap[p.id] ?? 'present'),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">Review attendance</p>
          <p className="text-[11px] text-slate-500">
            {counts.present + counts.late} here · {counts.late} late · {counts.absent} out ·{' '}
            {counts.excused} excused
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-slate-600">
          H here · L late · O out · E excused
        </p>
      </div>

      <ul className="divide-y divide-slate-800/80">
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
                <p className="text-[10px] leading-tight text-slate-600">{formatPlayerPosition(player.position)}</p>
              </div>
              <div
                role="group"
                aria-label={`Attendance for ${player.name}`}
                className="flex shrink-0 overflow-hidden rounded-md border border-slate-700"
              >
                {STATUS_ACTIONS.map(({ status, short, activeClass, idleClass }) => {
                  const active = current === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-label={status}
                      aria-pressed={active}
                      title={status}
                      onClick={() => onSetStatus(player.id, status)}
                      className={`h-7 w-7 text-[11px] font-bold ${
                        active ? activeClass : idleClass
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
