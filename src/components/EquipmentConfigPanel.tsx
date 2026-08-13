import React, { useMemo, useState } from 'react';
import { Package, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import type { EquipmentGroup, EquipmentItem, Player } from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import { isEligibleForEquipment } from '../utils/complianceConsequences';
import { rosterPlayers } from '../utils/playerStatus';
import { SaveAndSyncButton } from './SaveAndSyncButton';

interface EquipmentConfigPanelProps {
  groups: EquipmentGroup[];
  items: EquipmentItem[];
  players: Player[];
  onRefreshData: () => void;
}

export const EquipmentConfigPanel: React.FC<EquipmentConfigPanelProps> = ({
  groups,
  items,
  players,
  onRefreshData,
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const [itemLabel, setItemLabel] = useState('');
  const [assignItemId, setAssignItemId] = useState<string | null>(null);
  const [assignPlayerId, setAssignPlayerId] = useState('');

  const activeGroupId = groups.some((g) => g.id === selectedGroupId)
    ? selectedGroupId
    : (groups[0]?.id ?? '');

  const groupItems = useMemo(
    () => items.filter((i) => i.groupId === activeGroupId),
    [items, activeGroupId],
  );

  const counts = useMemo(() => {
    const available = groupItems.filter((i) => i.status === 'available').length;
    const assigned = groupItems.filter((i) => i.status === 'assigned').length;
    const retired = groupItems.filter((i) => i.status === 'retired').length;
    return { available, assigned, retired };
  }, [groupItems]);

  const playerName = (id?: string) =>
    players.find((p) => p.id === id)?.name ?? 'Unknown';

  const assignablePlayers = useMemo(() => rosterPlayers(players), [players]);

  const equipmentOkByPlayer = useMemo(() => {
    const reqs = StorageService.getComplianceRequirements();
    const compliance = StorageService.getPlayerCompliance();
    return new Map(
      assignablePlayers.map((p) => [
        p.id,
        isEligibleForEquipment(p.id, reqs, compliance),
      ]),
    );
  }, [assignablePlayers]);

  const firstEquipmentEligibleId =
    assignablePlayers.find((p) => equipmentOkByPlayer.get(p.id))?.id ?? '';

  const handleAddGroup = () => {
    const name = groupName.trim();
    if (!name) return;
    const g = StorageService.addEquipmentGroup({ name });
    setGroupName('');
    setSelectedGroupId(g.id);
    void flushNow();
    onRefreshData();
  };

  const handleDeleteGroup = (id: string) => {
    if (
      !confirm(
        'Delete this group and all of its items? Assigned items will be removed.',
      )
    ) {
      return;
    }
    StorageService.deleteEquipmentGroup(id);
    void flushNow();
    onRefreshData();
  };

  const handleAddItem = () => {
    const label = itemLabel.trim();
    if (!label || !activeGroupId) return;
    StorageService.addEquipmentItem({ groupId: activeGroupId, label });
    setItemLabel('');
    void flushNow();
    onRefreshData();
  };

  const handleAssign = () => {
    if (!assignItemId || !assignPlayerId) return;
    const reqs = StorageService.getComplianceRequirements();
    const compliance = StorageService.getPlayerCompliance();
    if (!isEligibleForEquipment(assignPlayerId, reqs, compliance)) {
      alert(
        'This player is blocked from equipment (unpaid team fee or other No equipment item).',
      );
      return;
    }
    StorageService.assignEquipmentItem(assignItemId, assignPlayerId);
    setAssignItemId(null);
    setAssignPlayerId('');
    void flushNow();
    onRefreshData();
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <Package className="w-5 h-5 text-sky-400" />
          <span>Equipment Inventory</span>
        </div>
        <SaveAndSyncButton compact />
      </div>
      <p className="text-sm text-slate-400">
        Create groups of individual items, assign them to players, and return
        them to available stock.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="New group name (e.g. Home Jerseys)"
          className="flex-1 min-w-[12rem] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAddGroup}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold px-3 py-1.5"
        >
          <Plus className="w-4 h-4" />
          Add group
        </button>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupId(g.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                g.id === activeGroupId
                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-200'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {activeGroupId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Available {counts.available} · Assigned {counts.assigned}
              {counts.retired > 0 ? ` · Retired ${counts.retired}` : ''}
            </span>
            <button
              type="button"
              onClick={() => handleDeleteGroup(activeGroupId)}
              className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete group
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              placeholder="Item label / number"
              className="flex-1 min-w-[10rem] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 text-sm px-3 py-1.5"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          </div>

          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {groupItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-100">
                    #{item.label}
                  </span>
                  <span className="ml-2 text-xs text-slate-500 capitalize">
                    {item.status}
                  </span>
                  {item.status === 'assigned' && item.assignedPlayerId && (
                    <span className="ml-2 text-xs text-sky-300">
                      → {playerName(item.assignedPlayerId)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.status === 'available' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignItemId(item.id);
                        setAssignPlayerId(firstEquipmentEligibleId);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-emerald-300 hover:bg-slate-800"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Assign
                    </button>
                  )}
                  {item.status === 'assigned' && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.returnEquipmentItem(item.id);
                        void flushNow();
                        onRefreshData();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-amber-300 hover:bg-slate-800"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Return
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      StorageService.deleteEquipmentItem(item.id);
                      void flushNow();
                      onRefreshData();
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300"
                    aria-label={`Delete item ${item.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {groupItems.length === 0 && (
              <li className="text-sm text-slate-500 py-2">
                No items in this group yet.
              </li>
            )}
          </ul>
        </>
      )}

      {assignItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold">Assign item</h3>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Player</span>
              <select
                value={assignPlayerId}
                onChange={(e) => setAssignPlayerId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {assignablePlayers.map((p) => {
                  const ok = equipmentOkByPlayer.get(p.id) === true;
                  return (
                    <option key={p.id} value={p.id} disabled={!ok}>
                      #{p.jerseyNumber} {p.name}
                      {ok ? '' : ' — no equipment'}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignItemId(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!assignPlayerId}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3 py-1.5 text-sm font-semibold text-slate-950"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
