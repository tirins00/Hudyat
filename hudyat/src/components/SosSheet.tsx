import { useEffect, useState } from 'react';
import {
  SOS_PRESETS,
  sendSos,
  subscribeToSosAlerts,
} from '../services/SosService';
import type { Sos } from '../types/models';

export interface SosZoneOption {
  nodeId: string;
  label: string;
}

const DEFAULT_ZONE_OPTIONS: readonly SosZoneOption[] = [
  { nodeId: 'eng-401', label: 'ENG 401 (Room)' },
  { nodeId: 'stair-a', label: 'Stairway A' },
  { nodeId: 'corridor-4f', label: 'Corridor 4F' },
  { nodeId: 'restroom-4f', label: 'Restroom' },
  { nodeId: 'canteen', label: 'Canteen' },
  { nodeId: 'library', label: 'Library' },
];

export interface SosSheetProps {
  drillId: string;
  studentUid: string;
  studentName?: string;
  defaultZoneId?: string;
  zoneOptions?: readonly SosZoneOption[];
  useDemoMode?: boolean;
  onClose?: () => void;
  onSent?: (sos: Sos) => void;
}

function formatSosTime(sos: Sos): string {
  return sos.createdAt.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SosSheet({
  drillId,
  studentUid,
  studentName,
  defaultZoneId = 'stair-a',
  zoneOptions = DEFAULT_ZONE_OPTIONS,
  useDemoMode = false,
  onClose,
  onSent,
}: SosSheetProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>(
    SOS_PRESETS[0].label,
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string>(defaultZoneId);
  const [note, setNote] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sentSosId, setSentSosId] = useState<string | null>(null);
  const [sentSosSnapshot, setSentSosSnapshot] = useState<Sos | null>(null);

  // Subscribe to live status updates (Sent -> Acknowledged -> Resolved) for the sent SOS.
  useEffect(() => {
    if (!sentSosId) return;
    const unsub = subscribeToSosAlerts(
      drillId,
      (alerts) => {
        const match = alerts.find((a) => a.id === sentSosId);
        if (match) {
          setSentSosSnapshot(match);
        }
      },
      { useDemoMode },
    );
    return () => unsub();
  }, [drillId, sentSosId, useDemoMode]);

  const handleSendSos = async () => {
    setError(null);
    setIsSending(true);
    try {
      const zoneObj = zoneOptions.find((z) => z.nodeId === selectedZoneId);
      const created = await sendSos(
        {
          drillId,
          uid: studentUid,
          nodeId: selectedZoneId,
          zoneLabel: zoneObj?.label ?? selectedZoneId,
          message: selectedPreset,
          note,
        },
        { useDemoMode },
      );
      setSentSosId(created.id);
      setSentSosSnapshot(created);
      onSent?.(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send SOS.');
    } finally {
      setIsSending(false);
    }
  };

  const confirmationStatusLabel =
    sentSosSnapshot?.status === 'resolved'
      ? 'Resolved'
      : sentSosSnapshot?.status === 'acknowledged'
        ? 'Acknowledged'
        : 'Sent';

  return (
    <section
      aria-label="Emergency SOS"
      className="bg-white border-4 border-red-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-red-200 pb-3">
        <div>
          <span className="inline-block px-2.5 py-1 rounded bg-red-800 text-white text-xs font-extrabold uppercase tracking-wider">
            Emergency SOS
          </span>
          <h2 className="text-2xl font-extrabold text-slate-950 mt-2">
            What do you need?
          </h2>
          {studentName && (
            <p className="text-sm font-semibold text-slate-700 mt-0.5">
              Sending as: {studentName}
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border-2 border-slate-700 bg-white text-slate-950 font-bold text-sm hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      {sentSosSnapshot ? (
        <div
          role="status"
          className="bg-red-50 border-2 border-red-800 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-lg font-extrabold text-red-950">
              SOS Alert {confirmationStatusLabel}
            </span>
            <span
              className={
                sentSosSnapshot.status === 'acknowledged'
                  ? 'px-3 py-1 rounded-full bg-amber-200 border border-amber-900 text-amber-950 text-xs font-extrabold uppercase'
                  : sentSosSnapshot.status === 'resolved'
                    ? 'px-3 py-1 rounded-full bg-emerald-200 border border-emerald-900 text-emerald-950 text-xs font-extrabold uppercase'
                    : 'px-3 py-1 rounded-full bg-red-800 text-white text-xs font-extrabold uppercase'
              }
            >
              {confirmationStatusLabel}
            </span>
          </div>

          <dl className="text-sm space-y-1 text-slate-950">
            <div>
              <dt className="inline font-bold">Message: </dt>
              <dd className="inline font-semibold">{sentSosSnapshot.message}</dd>
            </div>
            {sentSosSnapshot.note && (
              <div>
                <dt className="inline font-bold">Note: </dt>
                <dd className="inline font-semibold">{sentSosSnapshot.note}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-bold">Last known zone: </dt>
              <dd className="inline font-semibold">
                {sentSosSnapshot.zoneLabel ?? sentSosSnapshot.nodeId}
              </dd>
            </div>
            <div>
              <dt className="inline font-bold">Time sent: </dt>
              <dd className="inline font-semibold">
                {formatSosTime(sentSosSnapshot)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => {
              setSentSosId(null);
              setSentSosSnapshot(null);
              setNote('');
            }}
            className="min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 cursor-pointer"
          >
            Send Another SOS
          </button>
        </div>
      ) : (
        <>
          {/* One-tap preset SOS buttons (matching SDD Figure 48 & WCAG >= 48x48px) */}
          <div
            role="radiogroup"
            aria-label="SOS message presets"
            className="grid grid-cols-1 gap-3"
          >
            {SOS_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.label;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedPreset(preset.label)}
                  className={
                    isSelected
                      ? 'min-h-[56px] w-full px-4 py-3 rounded-xl text-left border-2 border-red-950 bg-red-800 text-white font-extrabold text-base shadow-sm cursor-pointer flex items-center justify-between gap-2'
                      : 'min-h-[56px] w-full px-4 py-3 rounded-xl text-left border-2 border-slate-700 bg-slate-900 text-white font-bold text-base hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2'
                  }
                >
                  <span>{preset.label}</span>
                  <span className="text-xs font-semibold opacity-90">
                    {preset.shortText}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zone selector (indoor zone only, no GPS per GEMINI.md) */}
          <label className="block space-y-1.5">
            <span className="block text-sm font-bold text-slate-900">
              Current / Last known zone
            </span>
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="w-full min-h-[48px] px-3 rounded-xl border-2 border-slate-400 bg-white text-slate-950 text-sm font-bold"
            >
              {zoneOptions.map((z) => (
                <option key={z.nodeId} value={z.nodeId}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>

          {/* Optional short note */}
          <label className="block space-y-1.5">
            <span className="block text-sm font-bold text-slate-900">
              Optional short note (optional)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="e.g. Near east stairs, 2nd floor"
              className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-400 bg-white text-slate-950 text-sm font-semibold"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border-2 border-red-800 text-red-950 rounded-xl px-4 py-3 text-sm font-bold"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={isSending}
            onClick={() => void handleSendSos()}
            className="w-full min-h-[56px] px-6 py-3 rounded-xl bg-red-700 text-white font-extrabold text-lg tracking-wide hover:bg-red-800 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-red-400 cursor-pointer"
          >
            {isSending ? 'SENDING SOS...' : 'SEND SOS'}
          </button>
        </>
      )}
    </section>
  );
}

export default SosSheet;
