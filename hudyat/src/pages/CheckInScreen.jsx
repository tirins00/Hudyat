import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import CheckInArrivalBanner from '../components/student/CheckInArrivalBanner.jsx';
import CheckInCameraCard from '../components/student/CheckInCameraCard.jsx';
import CheckInHeaderActions from '../components/student/CheckInHeaderActions.jsx';
import CheckInLiveContextCard from '../components/student/CheckInLiveContextCard.jsx';
import CheckInManualSimulator from '../components/student/CheckInManualSimulator.jsx';
import SosModalDialog from '../components/student/SosModalDialog.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import StatusBanner from '../components/ui/StatusBanner.jsx';
import {
  DEMO_CHECKIN_CAMPUS_ID,
  DEMO_CHECKIN_DRILL_ID,
  DEMO_CHECKIN_MAP_NODES,
  DEMO_CHECKIN_STUDENT_UID,
} from '../data/checkInDemoData.js';
import { getHeadcountFirestore } from '../firebase/headcountClient.js';
import { useHudyatSession } from '../routes/useHudyatSession.js';
import {
  CheckInService,
  createFirestoreCheckInStore,
  createMemoryCheckInStore,
} from '../services/CheckInService.js';
import { QrCodeParser } from '../services/QrCodeParser.js';

const QR_READER_ELEMENT_ID = 'hudyat-assembly-qr-reader';

function formatArrivalTime(ts) {
  const date = ts.toDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function CheckInScreen() {
  const {
    authUser,
    activeDrillId: campusActiveDrillId,
    firebaseReady,
  } = useHudyatSession();
  const [demoOverride, setDemoOverride] = useState(null);
  const useDemoMode = demoOverride ?? (!firebaseReady || !authUser);

  const [manualDrillId, setManualDrillId] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('drillId') ?? '';
    }
    return '';
  });
  const [manualCampusId, setManualCampusId] = useState('');
  const [manualStudentUid, setManualStudentUid] = useState('');

  const drillId = manualDrillId.trim() || campusActiveDrillId || 'active-drill';
  const campusId =
    manualCampusId.trim() || authUser?.campusId || DEMO_CHECKIN_CAMPUS_ID;
  const studentUid =
    manualStudentUid.trim() || authUser?.uid || DEMO_CHECKIN_STUDENT_UID;
  const studentDisplayName =
    authUser?.displayName ||
    authUser?.email ||
    (studentUid === DEMO_CHECKIN_STUDENT_UID ? 'Ana Cruz' : undefined);

  const [liveNodes, setLiveNodes] = useState([]);
  const [liveCheckIn, setLiveCheckIn] = useState(null);

  const [demoCheckIns, setDemoCheckIns] = useState([]);
  const demoStore = useMemo(
    () =>
      createMemoryCheckInStore([], {
        onChange: (all) => setDemoCheckIns(all),
      }),
    [],
  );

  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [duplicateNotice, setDuplicateNotice] = useState(null);
  const [manualQrInput, setManualQrInput] = useState('');
  const [isSosOpen, setIsSosOpen] = useState(false);

  useEffect(() => {
    if (useDemoMode) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsubNodes = onSnapshot(
      query(collection(db, 'campuses', campusId, 'mapNodes')),
      (snap) => {
        setLiveNodes(
          snap.docs.map((d) => ({
            ...d.data(),
            id: d.id,
          })),
        );
      },
      (err) => setScanError(err.message),
    );

    const unsubCheckIn = onSnapshot(
      doc(db, 'drills', drillId, 'checkIns', studentUid),
      (snap) => {
        if (snap.exists()) {
          setLiveCheckIn({
            ...snap.data(),
            studentUid: snap.id,
          });
        } else {
          setLiveCheckIn(null);
        }
      },
      (err) => setScanError(err.message),
    );

    return () => {
      unsubNodes();
      unsubCheckIn();
    };
  }, [useDemoMode, campusId, drillId, studentUid]);

  const activeCampusId = useDemoMode ? DEMO_CHECKIN_CAMPUS_ID : campusId;
  const activeDrillId = useDemoMode ? DEMO_CHECKIN_DRILL_ID : drillId;
  const activeNodes = useDemoMode ? DEMO_CHECKIN_MAP_NODES : liveNodes;
  const activeCheckIn = useDemoMode
    ? demoCheckIns.find((c) => c.studentUid === studentUid) ?? null
    : liveCheckIn;

  const qrParser = useMemo(
    () => new QrCodeParser(activeCampusId, activeNodes),
    [activeCampusId, activeNodes],
  );

  const checkInService = useMemo(() => {
    const db = useDemoMode ? null : getHeadcountFirestore();
    const store =
      !useDemoMode && db
        ? createFirestoreCheckInStore(db, activeDrillId)
        : demoStore;

    return new CheckInService({
      drillId: activeDrillId,
      actorUid: studentUid,
      qrCodeParser: qrParser,
      store,
      onDuplicate: (existing) => {
        const areaNode = activeNodes.find(
          (n) => n.id === existing.assemblyNodeId,
        );
        const areaName = areaNode?.label ?? existing.assemblyNodeId;
        setDuplicateNotice(
          `Already checked in at ${areaName} (${formatArrivalTime(existing.checkedInAt)}). Duplicate scan ignored.`,
        );
      },
    });
  }, [useDemoMode, activeDrillId, studentUid, qrParser, demoStore, activeNodes]);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Ignore cleanup errors when stream is already stopped
    } finally {
      scannerRef.current = null;
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const handleDecodedQr = useCallback(
    async (decodedText) => {
      setScanError(null);
      setDuplicateNotice(null);
      try {
        await checkInService.checkInQr(decodedText, studentUid);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(200);
        }
      } catch (err) {
        setScanError(
          err instanceof Error ? err.message : 'Failed to process QR code.',
        );
      }
    },
    [checkInService, studentUid],
  );

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    setDuplicateNotice(null);

    if (scannerRef.current?.isScanning) return;

    try {
      const scanner = new Html5Qrcode(QR_READER_ELEMENT_ID, {
        verbose: false,
      });
      scannerRef.current = scanner;
      setIsScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          void handleDecodedQr(decodedText).then(() => stopCamera());
        },
        () => {},
      );
    } catch (err) {
      setIsScanning(false);
      scannerRef.current = null;
      setCameraError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Use the QR simulator or manual input below.`
          : 'Camera unavailable. Use the QR simulator or manual input below.',
      );
    }
  };

  const handleResetDemo = async () => {
    setScanError(null);
    setDuplicateNotice(null);
    const existing = await demoStore.getCheckIn(studentUid);
    if (existing) {
      await demoStore.deleteCheckIn(studentUid);
    }
    setDemoCheckIns((prev) => prev.filter((c) => c.studentUid !== studentUid));
  };

  const arrivedNodeLabel = activeCheckIn
    ? activeNodes.find((n) => n.id === activeCheckIn.assemblyNodeId)?.label ??
      activeCheckIn.assemblyNodeId
    : null;
  const arrivalTime = activeCheckIn
    ? formatArrivalTime(activeCheckIn.checkedInAt)
    : null;

  return (
    <AppShell
      title="Check In"
      subtitle="Scan the assembly QR code"
      actions={
        <CheckInHeaderActions
          useDemoMode={useDemoMode}
          onOpenSos={() => setIsSosOpen(true)}
          onToggleMode={() => {
            setScanError(null);
            setDuplicateNotice(null);
            setDemoOverride(!useDemoMode);
          }}
        />
      }
    >
      <PageStack gap="lg">
        <SosModalDialog
          open={isSosOpen}
          drillId={activeDrillId}
          studentUid={studentUid}
          studentName={studentDisplayName}
          useDemoMode={useDemoMode}
          onClose={() => setIsSosOpen(false)}
        />

        {!useDemoMode && (
          <CheckInLiveContextCard
            campusIdValue={
              manualCampusId || authUser?.campusId || DEMO_CHECKIN_CAMPUS_ID
            }
            onCampusIdChange={setManualCampusId}
            drillIdValue={manualDrillId || campusActiveDrillId || ''}
            onDrillIdChange={setManualDrillId}
            studentUidValue={
              manualStudentUid || authUser?.uid || DEMO_CHECKIN_STUDENT_UID
            }
            onStudentUidChange={setManualStudentUid}
          />
        )}

        <CheckInCameraCard
          readerElementId={QR_READER_ELEMENT_ID}
          isScanning={isScanning}
          cameraError={cameraError}
          onStartCamera={startCamera}
          onStopCamera={stopCamera}
        />

        <CheckInArrivalBanner
          nodeLabel={arrivedNodeLabel}
          arrivalTime={arrivalTime}
        />

        <StatusBanner tone="warning" message={duplicateNotice} />

        <ErrorBanner message={scanError} />

        <CheckInManualSimulator
          manualQrInput={manualQrInput}
          onManualQrChange={setManualQrInput}
          onSubmitQr={handleDecodedQr}
          useDemoMode={useDemoMode}
          onSimulateQr={handleDecodedQr}
          onResetDemo={handleResetDemo}
        />
      </PageStack>
    </AppShell>
  );
}

export default CheckInScreen;
