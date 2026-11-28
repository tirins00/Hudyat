import { useEffect, useRef, useState } from 'react';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import DchConfirmationCard from '../components/student/DchConfirmationCard.jsx';
import EvacuationCheckInCard from '../components/student/EvacuationCheckInCard.jsx';
import StepDrillBanner from '../components/student/StepDrillBanner.jsx';
import StepQuickActionsCard from '../components/student/StepQuickActionsCard.jsx';
import StepSavedBanner from '../components/student/StepSavedBanner.jsx';
import EmptyStateCard from '../components/ui/EmptyStateCard.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import { db } from '../firebase/config.js';
import { useAuth } from '../routes/authContext.js';
import { findLatestDrillForCampus } from '../services/AlertCoordinator.js';
import { loadCampusBundle } from '../services/CampusRepository.js';
import { CIT_U_SEED_DATA } from '../services/CampusSeeder.js';
import {
  CheckInService,
  createFirestoreCheckInStore,
} from '../services/CheckInService.js';
import { DrillService } from '../services/DrillService.js';
import {
  QrCodeParser as NodeQrCodeParser,
  validateAssemblyQrPayload,
  validateManualAssemblyCode,
} from '../services/QrCodeParser.js';
import { VibrationService } from '../services/VibrationService.js';
import {
  DRILL_PHASES,
  NODE_TYPES,
  RESPONSE_STATUSES,
  ROLES,
} from '../types/models.js';

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
  const [campusNodes, setCampusNodes] = useState(() => [
    ...CIT_U_SEED_DATA.mapNodes,
  ]);
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
        if (
          !cancelled &&
          Array.isArray(bundle?.mapNodes) &&
          bundle.mapNodes.length > 0
        ) {
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
  const hintCode = assemblyHintCodes[0] || 'ASM-QUAD';
  const assistedCheckInPath = isStudent
    ? '/student/assisted-check-in'
    : '/assisted-check-in';

  function focusConfirmSection() {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
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
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId],
    );
  }

  function handleQrDecoded(rawText) {
    setError('');
    const result = validateAssemblyQrPayload(rawText, expectedCampusId);

    if (!result.valid) {
      setVerifiedScanState(null);
      setScanErrorState({ key: drillPhaseKey, message: result.error });
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
      setScanErrorState({ key: drillPhaseKey, message: result.error });
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
      setError(
        err?.message || 'Failed to record Drop, Cover & Hold confirmation.',
      );
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
    const arrivalMethod =
      verifiedScan?.method === 'manual_code' ? 'manual_code' : 'qr';
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
      <PageStack>
        <StepDrillBanner
          drill={drill}
          expectedCampusId={expectedCampusId}
          phase={phase}
        />

        <ErrorBanner message={error} />

        <StepSavedBanner saved={saved} />

        {!drill ? (
          <EmptyStateCard
            title="No Active Drill"
            description="When a campus earthquake drill begins, safety confirmation and assembly check-in controls will appear here automatically."
          />
        ) : phase === DRILL_PHASES.ENDED ? (
          <EmptyStateCard
            tone="success"
            title="All Clear — Drill Ended"
            description="This drill has concluded. Follow coordinator instructions to return to classrooms."
          />
        ) : phase === DRILL_PHASES.DCH ? (
          <DchConfirmationCard
            note={note}
            onNoteChange={setNote}
            submitting={submitting}
            saved={saved}
            onConfirm={handleDchConfirm}
          />
        ) : (
          <EvacuationCheckInCard
            expectedCampusId={expectedCampusId}
            hintCode={hintCode}
            showManualFallback={showManualFallback}
            onToggleManualFallback={() =>
              setShowManualFallback((prev) => !prev)
            }
            manualCodeInput={manualCodeInput}
            onManualCodeChange={setManualCodeInput}
            onQrDecoded={handleQrDecoded}
            onVerifyManualCode={handleManualCodeVerify}
            verifiedScan={verifiedScan}
            onResetScan={() => {
              setVerifiedScanState(null);
              setScanErrorState(null);
            }}
            scanError={scanError}
            completedSteps={completedSteps}
            onToggleStep={toggleStep}
            note={note}
            onNoteChange={setNote}
            submitting={submitting}
            confirmSectionRef={confirmSectionRef}
            assistedCheckInPath={assistedCheckInPath}
            onSubmit={handleEvacuateSubmit}
          />
        )}

        {isStudent && <StepQuickActionsCard />}
      </PageStack>
    </AppShell>
  );
}
