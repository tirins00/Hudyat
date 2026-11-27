import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../routes/authContext.js';
import {
  DRILL_PHASE_ORDER,
  DrillService,
} from '../services/DrillService.js';
import {
  DRILL_PHASES,
  DRILL_SCENARIOS,
  ROLES,
} from '../types/models.js';

const PHASE_LABELS = {
  [DRILL_PHASES.DCH]: 'Drop, Cover & Hold',
  [DRILL_PHASES.EVACUATE]: 'Evacuate',
  [DRILL_PHASES.ENDED]: 'Ended',
};

export default function DrillDashboard({ drillService = DrillService }) {
  const { user } = useAuth();
  const [drills, setDrills] = useState([]);
  const [selectedDrillId, setSelectedDrillId] = useState('');
  const [expectedEntries, setExpectedEntries] = useState([]);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [campusId, setCampusId] = useState(user?.campusId || 'cit-u');
  const [scenario, setScenario] = useState(DRILL_SCENARIOS.NORMAL);
  const [dchDurationSec, setDchDurationSec] = useState(60);

  useEffect(() => {
    const unsub = drillService.subscribeToDrills((list) => {
      setDrills(list);
      setSelectedDrillId((prev) => prev || list[0]?.id || '');
    });
    return unsub;
  }, [drillService]);

  const activeDrill = drills.find((d) => d.id === selectedDrillId) || drills[0] || null;

  useEffect(() => {
    if (!activeDrill?.id) {
      return;
    }
    const unsubExp = drillService.subscribeToExpectedEntries(activeDrill.id, setExpectedEntries);
    const unsubResp = drillService.subscribeToResponses(activeDrill.id, setResponses);
    return () => {
      unsubExp();
      unsubResp();
    };
  }, [drillService, activeDrill?.id]);

  const isCoordinator =
    user?.role === ROLES.COORDINATOR || user?.role === ROLES.ADMIN;

  async function runAction(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStartNewDrill(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Drill title is required.');
      return;
    }
    await runAction(async () => {
      const created = await drillService.startDrill({
        title: title.trim(),
        campusId: campusId.trim() || 'cit-u',
        scenario,
        dchDurationSec: Number(dchDurationSec) || 60,
        createdBy: user?.uid || 'coordinator',
      });
      setTitle('');
      setShowCreate(false);
      setSelectedDrillId(created.id);
    });
  }

  const currentIdx = activeDrill ? DRILL_PHASE_ORDER.indexOf(activeDrill.phase) : -1;
  const nextPhase =
    currentIdx >= 0 && currentIdx < DRILL_PHASE_ORDER.length - 1
      ? DRILL_PHASE_ORDER[currentIdx + 1]
      : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-white border-b-2 border-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-widest uppercase text-slate-700">
              HUDYAT • DRILL LIFECYCLE
            </p>
            <h1 className="text-2xl font-extrabold text-slate-950">Drill Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/alert"
              className="rounded-lg border-2 border-red-800 bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Visual Alert Screen
            </Link>
            <Link
              to="/steps"
              className="rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"
            >
              Step Confirmation
            </Link>
            <Link
              to="/"
              className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-slate-950"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
          >
            {error}
          </div>
        )}

        <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="block flex-1 min-w-60">
              <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Active / Selected Drill
              </span>
              <select
                value={activeDrill?.id || ''}
                onChange={(e) => setSelectedDrillId(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 focus:border-slate-950 focus:outline-none"
              >
                {drills.length === 0 && <option value="">No drills found</option>}
                {drills.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({PHASE_LABELS[d.phase] || d.phase})
                  </option>
                ))}
              </select>
            </label>

            {isCoordinator && (
              <button
                type="button"
                onClick={() => setShowCreate((prev) => !prev)}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                {showCreate ? 'Cancel' : '+ Start New Drill'}
              </button>
            )}
          </div>

          {showCreate && isCoordinator && (
            <form
              onSubmit={handleStartNewDrill}
              className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3"
            >
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Launch New Drill (Starts in Drop, Cover &amp; Hold)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="block md:col-span-2">
                  <span className="block text-xs font-bold text-slate-800 mb-1">Title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="CIT-U Campus Earthquake Drill"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-slate-800 mb-1">Campus ID</span>
                  <input
                    type="text"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-slate-800 mb-1">
                    DCH Duration (sec)
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={dchDurationSec}
                    onChange={(e) => setDchDurationSec(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <span>Scenario:</span>
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  >
                    <option value={DRILL_SCENARIOS.NORMAL}>Normal</option>
                    <option value={DRILL_SCENARIOS.BLOCKED_EXIT}>Blocked Exit</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  Start Drill Now
                </button>
              </div>
            </form>
          )}

          {isCoordinator && activeDrill && activeDrill.phase !== DRILL_PHASES.ENDED && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
              {nextPhase && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(() => drillService.advanceDrillPhase(activeDrill.id))}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Advance to {PHASE_LABELS[nextPhase]}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(() => drillService.endDrill(activeDrill.id))}
                className="rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-50"
              >
                End Drill
              </button>
            </div>
          )}
        </section>

        {activeDrill && (
          <>
            <section className="rounded-xl border-2 border-emerald-800 bg-emerald-50 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                  DRILL PHASE: {PHASE_LABELS[activeDrill.phase] || activeDrill.phase}
                </p>
                <h2 className="text-lg font-extrabold text-slate-950">{activeDrill.title}</h2>
                <p className="text-sm font-semibold text-emerald-900">
                  Campus: {activeDrill.campusId} • Scenario: {activeDrill.scenario} • DCH:{' '}
                  {activeDrill.dchDurationSec}s
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-extrabold uppercase text-white">
                  {responses.length}/{expectedEntries.length} Responded
                </span>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <section className="rounded-xl border-2 border-slate-900 bg-white p-5">
                <h3 className="text-base font-extrabold text-slate-950 mb-3">
                  Drill Lifecycle Phases
                </h3>
                <ol className="space-y-2.5">
                  {DRILL_PHASE_ORDER.map((phase, idx) => {
                    const isDone = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                      <li
                        key={phase}
                        className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
                          isCurrent
                            ? 'border-slate-950 bg-slate-50 font-bold'
                            : isDone
                            ? 'border-emerald-700 bg-emerald-50'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                            isDone ? 'bg-emerald-700' : isCurrent ? 'bg-blue-700' : 'bg-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-950">
                            {PHASE_LABELS[phase]}
                          </div>
                          <div className="text-xs text-slate-600">
                            {isDone ? 'Completed' : isCurrent ? 'Current Phase' : 'Pending'}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="rounded-xl border-2 border-slate-900 bg-white p-5">
                <h3 className="text-base font-extrabold text-slate-950 mb-3">
                  Expected Entries &amp; Responses
                </h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="block text-xl font-extrabold">{expectedEntries.length}</span>
                    <span className="text-xs font-semibold text-slate-600">Expected</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="block text-xl font-extrabold">{responses.length}</span>
                    <span className="text-xs font-semibold text-slate-600">Responses</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="block text-xl font-extrabold">
                      {expectedEntries.length > 0
                        ? Math.round((responses.length / expectedEntries.length) * 100)
                        : 0}
                      %
                    </span>
                    <span className="text-xs font-semibold text-slate-600">Rate</span>
                  </div>
                </div>

                {responses.length === 0 ? (
                  <p className="text-sm text-slate-600">No step responses recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {responses.map((r, i) => (
                      <li
                        key={r.uid || r.id}
                        className="flex items-center gap-3 rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2 text-sm"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-950">
                            {r.displayName || r.uid}
                          </div>
                          <div className="text-xs text-slate-700">
                            {r.status}
                            {r.currentNodeId ? ` • Node: ${r.currentNodeId}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
