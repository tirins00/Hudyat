import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import QrCameraScanner from '../components/QrCameraScanner.jsx';
import { db } from '../firebase/config.js';
import { useAuth } from '../routes/authContext.js';
import { findLatestDrillForCampus } from '../services/AlertCoordinator.js';
import { loadCampusBundle } from '../services/CampusRepository.js';
import { CIT_U_SEED_DATA } from '../services/CampusSeeder.js';
import {
  CheckInService,
  createFirestoreCheckInStore,
} from '../services/CheckInService.ts';
import { DrillService } from '../services/DrillService.js';
import {
  validateAssemblyQrPayload,
  validateManualAssemblyCode,
} from '../services/QrCodeParser.js';
import { QrCodeParser as NodeQrCodeParser } from '../services/QrCodeParser.ts';
import { VibrationService } from '../services/VibrationService.js';
import { DRILL_PHASES, NODE_TYPES, RESPONSE_STATUSES, ROLES } from '../types/models.js';

const EVACUATION_SAFETY_STEPS = Object.freeze([
  { id: 'dch', label: 'Completed Drop, Cover, and Hold On during shaking' },
  { id: 'stairs', label: 'Evacuated using stairs only (no elevators)' },
  { id: 'assembly', label: 'Arrived at designated Assembly Area and verified code' },
]);

async function recordUnifiedCheckIn({
  drillId,
  studentUid,
  campusId,
  nodeId,
  qrCode,
  method,
  mapNodes,
}) {
  const hasNode = mapNodes.some((n) => n.id === nodeId);
  const effectiveNodes = hasNode
    ? mapNodes
    : [
        ...mapNodes,
        {
          id: nodeId,
          campusId,
          buildingId: null,
          floor: 1,
          label: nodeId,
          type: NODE_TYPES.ASSEMBLY,
          x: 0,
          y: 0,
          qrCode,
        },
      ];

  const checkInService = new CheckInService({
    drillId,
    actorUid: studentUid,
    qrCodeParser: new NodeQrCodeParser(campusId, effectiveNodes),
    store: createFirestoreCheckInStore(db, drillId),
  });

  try {
    if (method === 'manual_code') {
      return await checkInService.checkInManualCode(qrCode, studentUid);
    }
    return await checkInService.checkInQr(qrCode, studentUid);
  } catch {
    // Offline fallback: idempotent merge write when Firestore transactions are unavailable offline
    const ref = doc(db, 'drills', drillId, 'checkIns', studentUid);
    const payload = {
      studentUid,
      drillId,
      method,
      assemblyNodeId: nodeId,
      checkedInBy: studentUid,
      byUid: studentUid,
      verifiedBy: null,
      checkedInAt: Timestamp.now(),
    };
    await setDoc(ref, payload, { merge: true });
    return payload;
  }
}

export default function StepScreen({
  drillService = DrillService,
  vibrationService = VibrationService,
  checkInWriter = recordUnifiedCheckIn,
}) {
  const { user } = useAuth();
  const campusId = user?.campusId || 'cit-u';
  const isStudent = !user?.role || user.role === ROLES.STUDENT;

  const [drill, setDrill] = useState(null);
  const [campusNodes, setCampusNodes] = useState(() => [...CIT_U_SEED_DATA.mapNodes]);
  const [completedSteps, setCompletedSteps] = useState(['dch', 'stairs']);
  const [note, setNote] = useState('');

  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');

  const [verifiedScanState, setVerifiedScanState] = useState(null);
  const [scanErrorState, setScanErrorState] = useState(null);
  const [savedState, setSavedState] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirmSectionRef = useRef(null);

  useEffect(() => {
    return drillService.subscribeToDrills((list) => {
      setDrill(findLatestDrillForCampus(list, campusId));
    });
  }, [drillService, campusId]);

  const drillPhaseKey = drill ? `${drill.id}:${drill.phase}` : '';
  const expectedCampusId = drill?.campusId || campusId || 'cit-u';
  const phase = drill?.phase || null;

  useEffect(() => {
    let cancelled = false;
    loadCampusBundle(expectedCampusId)
      .then((bundle) => {
        if (!cancelled && Array.isArray(bundle?.mapNodes) && bundle.mapNodes.length > 0) {
          setCampusNodes(bundle.mapNodes);
        }
      })
      .catch(() => {
        // Retain CIT_U_SEED_DATA fallback offline
      });
    return () => {
      cancelled = true;
    };
  }, [expectedCampusId]);

  const verifiedScan =
    verifiedScanState?.key === drillPhaseKey ? verifiedScanState.scan : null;
  const scanError =
    scanErrorState?.key === drillPhaseKey ? scanErrorState.message : '';
  const saved = savedState?.key === drillPhaseKey ? savedState.response : null;

  const assemblyHintCodes = campusNodes
    .filter((n) => n.type === NODE_TYPES.ASSEMBLY)
    .map((n) => n.id);

  function focusConfirmSection() {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        confirmSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }

  function toggleStep(stepId) {
    setCompletedSteps((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId],
    );
  }

  function handleQrDecoded(rawText) {
    setError('');
    const result = validateAssemblyQrPayload(rawText, expectedCampusId);

    if (!result.valid) {
      setVerifiedScanState(null);
      setScanErrorState({
        key: drillPhaseKey,
        message: result.error,
      });
      return;
    }

    setScanErrorState(null);
    setVerifiedScanState({
      key: drillPhaseKey,
      scan: {
        nodeId: result.nodeId,
        qrCode: result.qrCode,
        campusId: result.campusId,
        nodeType: result.nodeType,
        method: 'qr',
      },
    });
    vibrationService.vibrateStepConfirmed();
    focusConfirmSection();
  }

  function handleManualCodeVerify() {
    setError('');
    const result = validateManualAssemblyCode(manualCodeInput, {
      expectedCampusId,
      mapNodes: campusNodes,
    });

    if (!result.valid) {
      setVerifiedScanState(null);
      setScanErrorState({
        key: drillPhaseKey,
        message: result.error,
      });
      return;
    }

    setScanErrorState(null);
    setVerifiedScanState({
      key: drillPhaseKey,
      scan: {
        nodeId: result.nodeId,
        qrCode: result.qrCode,
        campusId: result.campusId,
        nodeType: result.nodeType,
        method: 'manual_code',
      },
    });
    vibrationService.vibrateStepConfirmed();
    focusConfirmSection();
  }

  async function handleDchConfirm() {
    setError('');
    if (!drill?.id) {
      setError('No active drill found.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await drillService.submitStepResponse(
        drill.id,
        user?.uid || 'demo-student',
        {
          displayName: user?.displayName || user?.email || 'Campus User',
          phase: DRILL_PHASES.DCH,
          status: RESPONSE_STATUSES.DCH_ACKNOWLEDGED,
          currentNodeId: null,
          nodeId: null,
          qrCode: null,
          verifiedQr: false,
          completedSteps: ['dch'],
          source: 'one_tap',
          method: 'one_tap',
          note: note.trim(),
        },
      );
      setSavedState({ key: drillPhaseKey, response: res });
      vibrationService.vibrateStepConfirmed();
    } catch (err) {
      setError(err?.message || 'Failed to record Drop, Cover & Hold confirmation.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEvacuateSubmit(e) {
    e.preventDefault();
    setError('');

    if (!drill?.id) {
      setError('No active drill found.');
      return;
    }

    const validation = validateAssemblyQrPayload(
      verifiedScan?.qrCode,
      expectedCampusId,
    );
    if (!validation.valid) {
      setScanErrorState({
        key: drillPhaseKey,
        message:
          'Scan a valid Assembly Area QR code (HUDYAT|' +
          expectedCampusId +
          '|assembly|<nodeId>) or enter a valid printed assembly code before confirming.',
      });
      return;
    }

    const uid = user?.uid || 'demo-student';
    const arrivalMethod = verifiedScan?.method === 'manual_code' ? 'manual_code' : 'qr';
    const stepsToSave = Array.from(new Set([...completedSteps, 'assembly']));

    setSubmitting(true);
    try {
      const [res] = await Promise.all([
        drillService.submitStepResponse(drill.id, uid, {
          displayName: user?.displayName || user?.email || 'Campus User',
          phase: DRILL_PHASES.EVACUATE,
          status: RESPONSE_STATUSES.ARRIVED,
          currentNodeId: validation.nodeId,
          nodeId: validation.nodeId,
          qrCode: validation.qrCode,
          verifiedQr: true,
          completedSteps: stepsToSave,
          source: arrivalMethod,
          method: arrivalMethod,
          note: note.trim(),
        }),
        checkInWriter({
          drillId: drill.id,
          studentUid: uid,
          campusId: expectedCampusId,
          nodeId: validation.nodeId,
          qrCode: validation.qrCode,
          method: arrivalMethod,
          mapNodes: campusNodes,
        }),
      ]);

      setSavedState({ key: drillPhaseKey, response: res });
      vibrationService.vibrateStepConfirmed();
    } catch (err) {
      setError(err?.message || 'Failed to save safe arrival confirmation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Safety & Assembly Check-In"
      subtitle="Confirm your Drop, Cover & Hold status or verify your safe arrival at an assembly area."
    >
      <div className="space-y-5">
        {drill && (
          <div className="rounded-xl border-2 border-slate-900 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Active Drill • Campus: {expectedCampusId}
              </p>
              <p className="text-base font-extrabold text-slate-950">{drill.title}</p>
            </div>
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-extrabold uppercase text-white ${
                phase === DRILL_PHASES.DCH
                  ? 'bg-red-700'
                  : phase === DRILL_PHASES.EVACUATE
                    ? 'bg-amber-900'
                    : 'bg-emerald-800'
              }`}
            >
              Phase: {phase?.toUpperCase()}
            </span>
          </div>
        )}

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
                SAFE ARRIVAL &amp; CHECK-IN RECORDED
              </p>
              <p className="text-base font-extrabold text-slate-950">
                Status: {saved.status}
                {saved.nodeId || saved.currentNodeId
                  ? ` • Assembly Area: ${saved.nodeId || saved.currentNodeId}`
                  : ' • Drop, Cover & Hold Confirmed'}
              </p>
              {saved.qrCode && (
                <p className="text-xs font-mono font-bold text-emerald-950 mt-0.5">
                  Verified Code: {saved.qrCode} ({saved.method === 'manual_code' ? 'Manual Code' : 'QR Scan'})
                </p>
              )}
            </div>
            <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-extrabold uppercase text-white">
              {saved.verifiedQr ? 'CHECKED IN' : 'CONFIRMED'}
            </span>
          </div>
        )}

        {!drill ? (
          <section className="rounded-xl border-2 border-slate-300 bg-white p-6 text-center space-y-2">
            <h2 className="text-lg font-extrabold text-slate-950">No Active Drill</h2>
            <p className="text-sm font-medium text-slate-700">
              When a campus earthquake drill begins, safety confirmation and assembly check-in controls will appear here automatically.
            </p>
          </section>
        ) : phase === DRILL_PHASES.ENDED ? (
          <section className="rounded-xl border-2 border-emerald-800 bg-emerald-50 p-6 text-center space-y-2">
            <h2 className="text-xl font-extrabold text-slate-950">
              All Clear — Drill Ended
            </h2>
            <p className="text-sm font-semibold text-emerald-950">
              This drill has concluded. Follow coordinator instructions to return to classrooms.
            </p>
          </section>
        ) : phase === DRILL_PHASES.DCH ? (
          /* Phase 1: Drop, Cover & Hold — 1-tap confirmation (no QR scanning) */
          <section className="rounded-xl border-2 border-red-800 bg-white p-6 space-y-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-red-800">
                Phase 1 — Drop, Cover &amp; Hold On
              </p>
              <h2 className="text-xl font-extrabold text-slate-950 mt-1">
                1-Tap Safety Confirmation
              </h2>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                Stay under a sturdy desk or table and hold on. No QR scan is needed during Phase 1 — tap once below when you are safely taking cover.
              </p>
            </div>

            <label className="block">
              <span className="block text-xs font-bold text-slate-800 mb-1">
                Optional Note
              </span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Taking cover in Room NGE-301"
                className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-slate-950 focus:outline-none"
              />
            </label>

            <button
              type="button"
              disabled={submitting}
              onClick={handleDchConfirm}
              className="hudyat-btn hudyat-btn-primary sm:w-full min-h-14 text-base"
            >
              {submitting
                ? 'Confirming…'
                : saved
                  ? 'Drop, Cover & Hold Confirmed (Tap to Update)'
                  : 'Confirm Drop, Cover & Hold'}
            </button>
          </section>
        ) : (
          /* Phase 2: Evacuate — Real Assembly QR Scan + Manual Printed Code Fallback */
          <form onSubmit={handleEvacuateSubmit} className="space-y-5">
            <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                  Phase 2 — Evacuation &amp; Assembly Check-In
                </p>
                <h2 className="text-lg font-extrabold text-slate-950 mt-0.5">
                  1. Scan Official Assembly Area QR Code
                </h2>
                <p className="text-sm font-medium text-slate-700 mt-1">
                  Proceed to your designated assembly area using stairs only and scan the posted{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-950">
                    HUDYAT|{expectedCampusId}|assembly|…
                  </code>{' '}
                  QR code to check in and record your safe arrival.
                </p>
              </div>

              <QrCameraScanner
                elementId="hudyat-step-assembly-qr-reader"
                onScan={handleQrDecoded}
                disabled={submitting}
              />

              {/* Camera-broken manual fallback */}
              <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-4 space-y-3">
                <button
                  type="button"
                  aria-expanded={showManualFallback}
                  onClick={() => setShowManualFallback((prev) => !prev)}
                  className="hudyat-btn hudyat-btn-ghost sm:w-full justify-between px-3 text-left text-slate-950"
                >
                  <span>Camera not working? Use manual fallback</span>
                  <span aria-hidden="true" className="text-xs font-extrabold uppercase">
                    {showManualFallback ? 'Hide ▲' : 'Show ▼'}
                  </span>
                </button>

                {showManualFallback && (
                  <div className="space-y-4 border-t border-slate-300 pt-4">
                    <div className="space-y-2.5">
                      <p className="text-sm font-extrabold text-slate-950">
                        Option A: Enter Printed Assembly Code
                      </p>
                      <p className="text-xs font-medium text-slate-700">
                        Type the official assembly code posted on the muster point sign (for example:{' '}
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-950">
                          {assemblyHintCodes[0] || 'ASM-QUAD'}
                        </code>{' '}
                        or{' '}
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-950">
                          HUDYAT|{expectedCampusId}|assembly|{assemblyHintCodes[0] || 'ASM-QUAD'}
                        </code>
                        ).
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={manualCodeInput}
                          onChange={(e) => setManualCodeInput(e.target.value)}
                          placeholder={`e.g., ${assemblyHintCodes[0] || 'ASM-QUAD'}`}
                          aria-label="Printed assembly area code"
                          className="min-h-12 flex-1 rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2 text-sm font-mono font-semibold text-slate-950 focus:border-slate-950 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleManualCodeVerify}
                          disabled={submitting}
                          className="hudyat-btn hudyat-btn-secondary"
                        >
                          Verify Printed Code
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-300 bg-white p-3.5 space-y-2.5">
                      <p className="text-sm font-extrabold text-slate-950">
                        Option B: Peer / Teacher Check-In
                      </p>
                      <p className="text-xs font-medium text-slate-700">
                        If your phone or camera is completely unusable, ask a classmate or teacher at the assembly area to mark you present via Assisted Check-In.
                      </p>
                      <Link
                        to={isStudent ? '/student/assisted-check-in' : '/assisted-check-in'}
                        className="hudyat-btn hudyat-btn-secondary"
                      >
                        Check In a Classmate / Assisted Check-In
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {scanError && (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
                >
                  Code Rejected: {scanError}
                </div>
              )}

              {verifiedScan && (
                <div
                  role="status"
                  className="rounded-xl border-2 border-emerald-800 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                      {verifiedScan.method === 'manual_code'
                        ? 'Printed Assembly Code Verified'
                        : 'Assembly QR Verified'}
                    </p>
                    <p className="text-sm font-extrabold text-slate-950">
                      Assembly Area: {verifiedScan.nodeId} (Campus: {verifiedScan.campusId})
                    </p>
                    <p className="text-xs font-mono text-emerald-950">
                      {verifiedScan.qrCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedScanState(null);
                      setScanErrorState(null);
                    }}
                    className="hudyat-btn hudyat-btn-secondary"
                  >
                    Rescan / Change Code
                  </button>
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <section className="rounded-xl border-2 border-slate-900 bg-white p-5">
                <h2 className="text-base font-extrabold text-slate-950 mb-3">
                  2. Evacuation Safety Steps
                </h2>
                <ul className="space-y-2.5">
                  {EVACUATION_SAFETY_STEPS.map((step, idx) => {
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
                            className="h-5 w-5 accent-slate-950"
                          />
                          <span>{step.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section
                ref={confirmSectionRef}
                className={`rounded-xl border-2 p-5 space-y-3 transition-all ${
                  verifiedScan
                    ? 'border-emerald-800 bg-emerald-50 ring-4 ring-emerald-300'
                    : 'border-slate-900 bg-white'
                }`}
              >
                <h2 className="text-base font-extrabold text-slate-950">
                  3. Confirm Safe Arrival at Assembly
                </h2>

                <label className="block">
                  <span className="block text-xs font-bold text-slate-800 mb-1">
                    Optional Note
                  </span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Arrived with Section CS-3A"
                    className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-slate-950 focus:outline-none"
                  />
                </label>

                {!verifiedScan ? (
                  <p className="rounded-lg border border-amber-700 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
                    Scan the {expectedCampusId} Assembly Area QR code (or verify the printed assembly code) above to unlock check-in.
                  </p>
                ) : (
                  <p className="rounded-lg border border-emerald-800 bg-white px-3 py-2 text-xs font-extrabold text-emerald-950">
                    Ready to record safe arrival &amp; assembly check-in at {verifiedScan.nodeId}.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!verifiedScan || submitting}
                  className="hudyat-btn hudyat-btn-primary sm:w-full min-h-14 text-base"
                >
                  {submitting
                    ? 'Recording Safe Arrival…'
                    : 'Confirm Safe Arrival at Assembly'}
                </button>
              </section>
            </div>
          </form>
        )}

        {isStudent && (
          <section
            aria-label="Other drill actions"
            className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-3"
          >
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Other Drill Actions
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                to="/student/route"
                className="hudyat-btn hudyat-btn-secondary"
              >
                View Evacuation Route
              </Link>
              <Link
                to="/student/assisted-check-in"
                className="hudyat-btn hudyat-btn-secondary"
              >
                Check In a Classmate
              </Link>
              <Link
                to="/student/sos"
                className="hudyat-btn hudyat-btn-danger"
              >
                Send SOS
              </Link>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
