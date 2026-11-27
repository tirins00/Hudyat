import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../routes/authContext.js';
import { DrillService } from '../services/DrillService.js';
import { parseQrPayload } from '../services/QrCodeParser.js';
import { VibrationService } from '../services/VibrationService.js';
import { NODE_TYPES, RESPONSE_STATUSES } from '../types/models.js';

const SAFETY_STEPS = [
  { id: 'dch', label: 'Completed Drop, Cover, and Hold On during shaking' },
  { id: 'stairs', label: 'Evacuated using stairs only (no elevators)' },
  { id: 'assembly', label: 'Arrived at designated Assembly Area' },
];

const QUICK_QR_PRESETS = [
  { label: 'NGE 301 (Room)', value: 'HUDYAT|cit-u|room|NGE-301' },
  { label: 'NGE 3F Corridor', value: 'HUDYAT|cit-u|corridor|NGE-3F-CORR' },
  { label: 'NGE West Stairwell', value: 'HUDYAT|cit-u|stair|NGE-STAIR-WEST' },
  { label: 'CIT-U Quadrangle Assembly', value: 'HUDYAT|cit-u|assembly|ASM-QUAD-01' },
];

export default function StepScreen({
  drillService = DrillService,
  vibrationService = VibrationService,
}) {
  const { user } = useAuth();
  const [drill, setDrill] = useState(null);
  const [inputMode, setInputMode] = useState('qr');
  const [qrInput, setQrInput] = useState('');
  const qrResult = qrInput.trim() ? parseQrPayload(qrInput) : null;

  const [manualNodeType, setManualNodeType] = useState(NODE_TYPES.ROOM);
  const [manualNodeId, setManualNodeId] = useState('NGE-301');

  const [completedSteps, setCompletedSteps] = useState([]);
  const [status, setStatus] = useState(RESPONSE_STATUSES.EVACUATING);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return drillService.subscribeToDrills((list) => {
      setDrill(list[0] || null);
    });
  }, [drillService]);

  function toggleStep(stepId) {
    setCompletedSteps((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId],
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!drill?.id) {
      setError('No active drill found.');
      return;
    }

    let currentNodeId;
    let source = 'manual';

    if (inputMode === 'qr') {
      const parsed = parseQrPayload(qrInput);
      if (!parsed.valid) {
        setError(parsed.error);
        return;
      }
      currentNodeId = parsed.nodeId;
      source = 'qr';
    } else {
      if (!manualNodeId.trim()) {
        setError('Please enter a Location / Node ID (e.g., NGE-301).');
        return;
      }
      currentNodeId = manualNodeId.trim();
    }

    setSubmitting(true);
    try {
      const res = await drillService.submitStepResponse(
        drill.id,
        user?.uid || 'demo-student',
        {
          displayName: user?.displayName || user?.email || 'Campus User',
          phase: drill.phase,
          status,
          currentNodeId,
          completedSteps,
          source,
          note: note.trim(),
        },
      );
      setSaved(res);
      vibrationService.vibrateStepConfirmed();
    } catch (err) {
      setError(err?.message || 'Failed to save step confirmation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-white border-b-2 border-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-widest uppercase text-slate-700">
              HUDYAT • STEP CONFIRMATION
            </p>
            <h1 className="text-2xl font-extrabold text-slate-950">
              Location-Step &amp; Confirmation
            </h1>
          </div>
          <Link
            to="/"
            className="rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
          >
            {error}
          </div>
        )}

        {saved && (
          <div
            role="status"
            className="rounded-xl border-2 border-emerald-800 bg-emerald-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                STEP CONFIRMATION RECORDED
              </p>
              <p className="text-base font-extrabold text-slate-950">
                Status: {saved.status} • Node: {saved.currentNodeId}
              </p>
            </div>
            <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-extrabold uppercase text-white">
              CONFIRMED
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              1. Current Location (No GPS — QR or Manual)
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInputMode('qr')}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-bold ${
                  inputMode === 'qr'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-300 bg-white text-slate-950'
                }`}
              >
                Scan / Paste QR Code
              </button>
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-bold ${
                  inputMode === 'manual'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-300 bg-white text-slate-950'
                }`}
              >
                Manual Location Input
              </button>
            </div>

            {inputMode === 'qr' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Scan/paste QR: HUDYAT|cit-u|room|NGE-301"
                    className="flex-1 min-w-60 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-slate-950 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQrInput((prev) => prev.trim())}
                    className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                  >
                    Set via QR
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {QUICK_QR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setQrInput(preset.value)}
                      className="rounded-lg border border-slate-900 bg-white px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-slate-100"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {qrResult && (
                  <p
                    className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                      qrResult.valid
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                        : 'border-red-700 bg-red-50 text-red-950'
                    }`}
                  >
                    {qrResult.valid
                      ? `Parsed: Campus ${qrResult.campusId} • Type ${qrResult.nodeType} • Node ${qrResult.nodeId}`
                      : qrResult.error}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold text-slate-800 mb-1">Node Type</span>
                  <select
                    value={manualNodeType}
                    onChange={(e) => setManualNodeType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.values(NODE_TYPES).map((nt) => (
                      <option key={nt} value={nt}>
                        {nt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-slate-800 mb-1">
                    Location / Node ID
                  </span>
                  <input
                    type="text"
                    value={manualNodeId}
                    onChange={(e) => setManualNodeId(e.target.value)}
                    placeholder="e.g., NGE-301"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <section className="rounded-xl border-2 border-slate-900 bg-white p-5">
              <h2 className="text-base font-extrabold text-slate-950 mb-3">
                2. Step-by-Step Confirmation
              </h2>
              <ul className="space-y-2.5">
                {SAFETY_STEPS.map((step, idx) => {
                  const checked = completedSteps.includes(step.id);
                  return (
                    <li
                      key={step.id}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                        checked ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                          checked ? 'bg-emerald-700' : 'bg-blue-700'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStep(step.id)}
                          className="h-4 w-4 accent-slate-950"
                        />
                        <span>{step.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-3">
              <h2 className="text-base font-extrabold text-slate-950">3. Status &amp; Submit</h2>
              <label className="block">
                <span className="block text-xs font-bold text-slate-800 mb-1">
                  Participant Status
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                >
                  <option value={RESPONSE_STATUSES.DCH_ACKNOWLEDGED}>
                    Drop, Cover &amp; Hold Acknowledged
                  </option>
                  <option value={RESPONSE_STATUSES.EVACUATING}>Evacuating</option>
                  <option value={RESPONSE_STATUSES.ARRIVED}>Arrived at Assembly</option>
                  <option value={RESPONSE_STATUSES.NEEDS_HELP}>Needs Help</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-bold text-slate-800 mb-1">
                  Optional Note
                </span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Floor 3 corridor clear"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Confirm Step & Location'}
              </button>
            </section>
          </div>
        </form>
      </main>
    </div>
  );
}
