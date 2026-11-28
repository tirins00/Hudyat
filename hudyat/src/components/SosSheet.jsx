import { useEffect, useState } from 'react';
import {
  SOS_PRESETS,
  sendSos,
  subscribeToSosAlerts,
} from '../services/SosService.js';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import StatusBadge from './ui/StatusBadge.jsx';

const DEFAULT_ZONE_OPTIONS = Object.freeze([
  { nodeId: 'eng-401', label: 'ENG 401 (Room)' },
  { nodeId: 'stair-a', label: 'Stairway A' },
  { nodeId: 'corridor-4f', label: 'Corridor 4F' },
  { nodeId: 'restroom-4f', label: 'Restroom' },
  { nodeId: 'canteen', label: 'Canteen' },
  { nodeId: 'library', label: 'Library' },
]);

function formatSosTime(sos) {
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
}) {
  const [selectedPreset, setSelectedPreset] = useState(SOS_PRESETS[0].label);
  const [selectedZoneId, setSelectedZoneId] = useState(defaultZoneId);
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [sentSosId, setSentSosId] = useState(null);
  const [sentSosSnapshot, setSentSosSnapshot] = useState(null);

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
      { useDemoMode, uid: studentUid },
    );
    return () => unsub();
  }, [drillId, sentSosId, studentUid, useDemoMode]);

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
    } catch (err) {
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
    <Card
      aria-label="Emergency SOS"
      className="border-2 border-red-400 space-y-5 shadow-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-red-200 pb-3">
        <div>
          <StatusBadge status="danger">Emergency SOS</StatusBadge>
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
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {sentSosSnapshot ? (
        <div
          role="status"
          className="bg-red-50 border border-red-300 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-lg font-extrabold text-red-950">
              SOS Alert {confirmationStatusLabel}
            </span>
            <StatusBadge status={sentSosSnapshot.status}>
              {confirmationStatusLabel}
            </StatusBadge>
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

          <Button
            variant="primary"
            onClick={() => {
              setSentSosId(null);
              setSentSosSnapshot(null);
              setNote('');
            }}
          >
            Send Another SOS
          </Button>
        </div>
      ) : (
        <>
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
                      ? 'min-h-14 w-full px-4 py-3 rounded-xl text-left border-2 border-red-900 bg-red-700 text-white font-extrabold text-base shadow-sm cursor-pointer flex items-center justify-between gap-2'
                      : 'min-h-14 w-full px-4 py-3 rounded-xl text-left border border-slate-700 bg-[#0F172A] text-white font-bold text-base hover:bg-[#1E293B] cursor-pointer flex items-center justify-between gap-2'
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

          <label className="block space-y-1.5">
            <span className="block text-sm font-bold text-slate-900">
              Current / Last known zone
            </span>
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="w-full min-h-12 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-950 text-sm font-bold focus:border-slate-900 focus:outline-none"
            >
              {zoneOptions.map((z) => (
                <option key={z.nodeId} value={z.nodeId}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>

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
              className="w-full min-h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-950 text-sm font-semibold focus:border-slate-900 focus:outline-none"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 text-red-950 rounded-xl px-4 py-3 text-sm font-bold"
            >
              {error}
            </div>
          )}

          <Button
            variant="danger"
            fullWidth
            disabled={isSending}
            onClick={() => void handleSendSos()}
            className="min-h-14 text-base tracking-wide"
          >
            {isSending ? 'SENDING SOS...' : 'SEND SOS'}
          </Button>
        </>
      )}
    </Card>
  );
}

export default SosSheet;
