import React, { useMemo } from 'react';
import { MessagesSquare, Printer, X } from 'lucide-react';
import type { Player } from '../types';
import { defaultAvatarFor } from '../constants/avatars';
import {
  buildPlayerPlacementDocument,
  formatPlace,
  openPlayerPlacementPrint,
  type PlayerPlacementDocument,
  type PlayerPlacementPrintContext,
  type RankPlace,
} from '../utils/playerPlacementPrint';

interface PlayerMeetingModalProps {
  player: Player;
  context: PlayerPlacementPrintContext;
  onClose: () => void;
}

function PlaceCard({
  title,
  place,
  compact = false,
}: {
  title: string;
  place: RankPlace;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <p
        className={`mt-1 font-black tabular-nums tracking-tight text-white ${
          compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
        }`}
      >
        {formatPlace(place)}
      </p>
      {place.detail ? (
        <p className="mt-0.5 text-[11px] font-medium text-slate-400 leading-snug">
          {place.detail}
        </p>
      ) : null}
    </div>
  );
}

function attendanceCounts(doc: PlayerPlacementDocument): string {
  const { present, late, absent, excused } = doc.attendance;
  const bits = [`Present ${present}`, `Late ${late}`, `Absent ${absent}`];
  if (excused > 0) bits.push(`Excused ${excused}`);
  return bits.join(' · ');
}

export const PlayerMeetingModal: React.FC<PlayerMeetingModalProps> = ({
  player,
  context,
  onClose,
}) => {
  const doc = useMemo(
    () => buildPlayerPlacementDocument(player, context),
    [player, context],
  );
  const late = doc.attendance.exceptions.filter((row) => row.status === 'late');
  const absent = doc.attendance.exceptions.filter(
    (row) => row.status === 'absent',
  );

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[min(92dvh,100%)] flex flex-col overflow-hidden shadow-2xl text-white">
        <div className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <MessagesSquare className="w-3.5 h-3.5" />
              Player meeting
            </p>
            <h2 className="text-lg font-black tracking-tight text-white truncate">
              {doc.playerName}{' '}
              <span className="text-slate-400 font-bold">#{doc.jersey}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Where they sit in the squad and each assigned position · {doc.printedAt}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openPlayerPlacementPrint([player], context)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
              aria-label="Close player meeting"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          <section className="flex items-center gap-4">
            <img
              src={player.avatarUrl || defaultAvatarFor(player.id || player.jerseyNumber)}
              alt=""
              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-slate-800 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200">
                {doc.positionsLabel || 'No positions assigned'}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                <span>Foot {doc.foot}</span>
                {doc.grade ? <span>Grade {doc.grade}</span> : null}
                {doc.birthYear ? <span>Born {doc.birthYear}</span> : null}
                {doc.publicId !== '—' ? <span>ID {doc.publicId}</span> : null}
              </p>
              {doc.statusNote ? (
                <p className="text-xs font-bold text-amber-300 mt-1">
                  {doc.statusNote}
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Squad standing
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <PlaceCard title="Statistical" place={doc.overall.statistical} />
              <PlaceCard title="Adjusted" place={doc.overall.adjusted} />
              <PlaceCard title="Coaches" place={doc.overall.coaches} />
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Assigned positions
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Statistical names the top two in that role, then this player if they sit outside the top two. Coaches Rank is a separate 1…N for each role.
            </p>
            {doc.positions.length === 0 ? (
              <p className="text-sm text-slate-500">No positions assigned.</p>
            ) : (
              <div className="space-y-3">
                {doc.positions.map((row) => (
                  <div
                    key={row.code}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-base font-black text-white">
                        {row.label}
                      </h4>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Pool {row.playerCount}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-emerald-200">
                      {row.statisticalLeaders}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <PlaceCard title="Statistical" place={row.statistical} compact />
                      <PlaceCard title="Adjusted" place={row.adjusted} compact />
                      <PlaceCard title="Coaches" place={row.coaches} compact />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Category scores
            </h3>
            {doc.categories.length === 0 ? (
              <p className="text-sm text-slate-500">No categories configured.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {doc.categories.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-medium text-slate-400 truncate">
                      {row.name}
                    </span>
                    <span className="text-sm font-black tabular-nums text-slate-100">
                      {row.score == null ? '—' : row.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Attendance
            </h3>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-2xl font-black tabular-nums text-emerald-400">
                {doc.attendanceRate}
              </p>
              <p className="text-xs text-slate-400 mt-1">{attendanceCounts(doc)}</p>
              {late.length === 0 && absent.length === 0 ? (
                <p className="text-xs text-slate-500 mt-3">No late or absent sessions.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {late.length > 0 ? (
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <span className="font-bold uppercase tracking-wider text-amber-400 mr-2">
                        Late
                      </span>
                      {late.map((row) => `${row.dateLabel} ${row.title}`).join(' · ')}
                    </p>
                  ) : null}
                  {absent.length > 0 ? (
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <span className="font-bold uppercase tracking-wider text-rose-400 mr-2">
                        Absent
                      </span>
                      {absent.map((row) => `${row.dateLabel} ${row.title}`).join(' · ')}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          {doc.notes ? (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Coach comments
              </h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {doc.notes}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};
