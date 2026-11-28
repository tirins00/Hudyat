import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import { SosSheet } from '../components/SosSheet';
import { getHeadcountFirestore } from '../firebase/headcountClient';
import { useHudyatSession } from '../routes/useHudyatSession';
import {
  CheckInService,
  createFirestoreCheckInStore,
  createMemoryCheckInStore,
} from '../services/CheckInService';
import { QrCodeParser } from '../services/QrCodeParser.ts';
import type { CheckIn, MapNode } from '../types/models';

const QR_READER_ELEMENT_ID = 'hudyat-assembly-qr-reader';

const DEMO_CAMPUS_ID = 'citu-main';
const DEMO_DRILL_ID = 'demo-drill-2026-12-03';
const DEMO_STUDENT_UID = 'stu-ana-cruz';

const DEMO_MAP_NODES: MapNode[] = [
  {
    id: 'assembly-b',
    campusId: DEMO_CAMPUS_ID,
    buildingId: null,
    floor: 1,
    label: 'Assembly Area B',
    type: 'assembly',
    x: 420,
    y: 320,
    qrCode: 'hudyat://citu-main/assembly-b',
  },
  {
    id: 'assembly-a',
    campusId: DEMO_CAMPUS_ID,
    buildingId: null,
    floor: 1,
    label: 'Assembly Area A',
    type: 'assembly',
    x: 120,
    y: 320,
    qrCode: 'hudyat://citu-main/assembly-a',
  },
  {
    id: 'eng-401',
    campusId: DEMO_CAMPUS_ID,
    buildingId: 'eng',
    floor: 4,
    label: 'ENG 401',
    type: 'room',
    x: 100,
    y: 100,
    qrCode: 'hudyat://citu-main/eng-401',
  },
];

function formatArrivalTime(ts: Timestamp): string {
  const date = ts.toDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function CheckInScreen() {
  const { authUser, activeDrillId: campusActiveDrillId, firebaseReady } =
    useHudyatSession();
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);
  const useDemoMode = demoOverride ?? (!firebaseReady || !authUser);

  // Live config parameters (prefilled from authenticated user + active drill, overridable via URL/inputs)
  const [manualDrillId, setManualDrillId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('drillId') ?? '';
    }
    return '';
  });
  const [manualCampusId, setManualCampusId] = useState<string>('');
  const [manualStudentUid, setManualStudentUid] = useState<string>('');

  const drillId = manualDrillId.trim() || campusActiveDrillId || 'active-drill';
  const campusId =
    manualCampusId.trim() || authUser?.campusId || DEMO_CAMPUS_ID;
  const studentUid =
    manualStudentUid.trim() || authUser?.uid || DEMO_STUDENT_UID;
  const studentDisplayName =
    authUser?.displayName ||
    authUser?.email ||
    (studentUid === DEMO_STUDENT_UID ? 'Ana Cruz' : undefined);

  // Live Firestore data
  const [liveNodes, setLiveNodes] = useState<MapNode[]>([]);
  const [liveCheckIn, setLiveCheckIn] = useState<CheckIn | null>(null);

  // Demo state
  const [demoCheckIns, setDemoCheckIns] = useState<CheckIn[]>([]);
  const demoStore = useMemo(
    () =>
      createMemoryCheckInStore(demoCheckIns, {
        onChange: (all) => setDemoCheckIns(all),
      }),
    // Recreating only when explicitly reset via key would lose state; store manages map internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Scanner & feedback state
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [manualQrInput, setManualQrInput] = useState<string>('');
  const [isSosOpen, setIsSosOpen] = useState<boolean>(false);

  // Subscribe to live Firestore mapNodes & student checkIn when in Live mode
  useEffect(() => {
    if (useDemoMode) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsubNodes = onSnapshot(
      query(collection(db, 'campuses', campusId, 'mapNodes')),
      (snap) => {
        setLiveNodes(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<MapNode, 'id'>),
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
            ...(snap.data() as CheckIn),
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

  const activeCampusId = useDemoMode ? DEMO_CAMPUS_ID : campusId;
  const activeDrillId = useDemoMode ? DEMO_DRILL_ID : drillId;
  const activeNodes = useDemoMode ? DEMO_MAP_NODES : liveNodes;
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
    async (decodedText: string) => {
      setScanError(null);
      setDuplicateNotice(null);
      try {
        await checkInService.checkInQr(decodedText, studentUid);
        // Short non-audio haptic confirmation (guarded for iOS/unsupported browsers)
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(200);
        }
      } catch (err: unknown) {
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
        () => {
          // Ignore per-frame decode misses while camera searches for a QR code
        },
      );
    } catch (err: unknown) {
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
      // Directly reset in-memory store for demo re-testing
      await demoStore.deleteCheckIn(studentUid);
    }
    setDemoCheckIns((prev) => prev.filter((c) => c.studentUid !== studentUid));
  };

  const arrivedNodeLabel = activeCheckIn
    ? (activeNodes.find((n) => n.id === activeCheckIn.assemblyNodeId)?.label ??
      activeCheckIn.assemblyNodeId)
    : null;

  return (
    <AppShell
      title="Check In"
      subtitle="Scan the assembly QR code"
      actions={
        <>
          <button
            type="button"
            onClick={() => setIsSosOpen(true)}
            className="hudyat-btn hudyat-btn-danger"
          >
            SOS
          </button>

          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setDuplicateNotice(null);
              setDemoOverride(!useDemoMode);
            }}
            className="hudyat-btn hudyat-btn-primary"
          >
            {useDemoMode
              ? 'Mode: Demo (Switch to Live)'
              : 'Mode: Live Firestore (Switch to Demo)'}
          </button>
        </>
      }
    >
      <div className="space-y-6">

        {isSosOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send SOS"
            className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="w-full max-w-lg my-auto">
              <SosSheet
                drillId={activeDrillId}
                studentUid={studentUid}
                studentName={studentDisplayName}
                useDemoMode={useDemoMode}
                onClose={() => setIsSosOpen(false)}
              />
            </div>
          </div>
        )}

        {!useDemoMode && (
          <section
            aria-label="Live Firestore context"
            className="bg-white border-2 border-slate-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
              <span>Campus ID</span>
              <input
                type="text"
                value={manualCampusId || authUser?.campusId || DEMO_CAMPUS_ID}
                onChange={(e) => setManualCampusId(e.target.value)}
                className="min-h-[48px] px-3 rounded-lg border border-slate-400 text-sm font-mono text-slate-950"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
              <span>Drill ID</span>
              <input
                type="text"
                value={manualDrillId || campusActiveDrillId || ''}
                onChange={(e) => setManualDrillId(e.target.value)}
                placeholder="active-drill"
                className="min-h-[48px] px-3 rounded-lg border border-slate-400 text-sm font-mono text-slate-950"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
              <span>Student UID</span>
              <input
                type="text"
                value={manualStudentUid || authUser?.uid || DEMO_STUDENT_UID}
                onChange={(e) => setManualStudentUid(e.target.value)}
                className="min-h-[48px] px-3 rounded-lg border border-slate-400 text-sm font-mono text-slate-950"
              />
            </label>
          </section>
        )}

        {/* Camera Scanner Box (matches SDD Figure 36 wireframe) */}
        <section
          aria-label="QR camera scanner"
          className="bg-white border-2 border-slate-300 rounded-2xl p-5 space-y-4"
        >
          <div className="bg-slate-100 border-2 border-dashed border-slate-400 rounded-xl p-4 flex flex-col items-center justify-center min-h-[260px]">
            <div
              id={QR_READER_ELEMENT_ID}
              className="w-full max-w-sm overflow-hidden rounded-lg"
            />
            {!isScanning && (
              <p className="text-sm font-semibold text-slate-700 mt-2 text-center">
                Camera view — tap Start Camera Scan or use the simulator below
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            {!isScanning ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="hudyat-btn hudyat-btn-primary"
              >
                Start Camera Scan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopCamera()}
                className="hudyat-btn hudyat-btn-danger"
              >
                Stop Camera
              </button>
            )}
          </div>

          {cameraError && (
            <p className="text-sm font-semibold text-amber-950 bg-amber-50 border border-amber-700 rounded-lg px-4 py-3">
              {cameraError}
            </p>
          )}
        </section>

        {/* Arrival Confirmation Banner (matches SDD Figure 36 green banner) */}
        {activeCheckIn && arrivedNodeLabel && (
          <div
            role="status"
            className="bg-emerald-800 text-white border-2 border-emerald-950 rounded-xl px-5 py-4 text-center text-lg font-extrabold tracking-wide"
          >
            ARRIVED - {arrivedNodeLabel} -{' '}
            {formatArrivalTime(activeCheckIn.checkedInAt)}
          </div>
        )}

        {duplicateNotice && (
          <div
            role="status"
            className="bg-amber-50 border-2 border-amber-700 text-amber-950 rounded-xl px-4 py-3 text-sm font-bold"
          >
            {duplicateNotice}
          </div>
        )}

        {scanError && (
          <div
            role="alert"
            className="bg-red-50 border-2 border-red-700 text-red-950 rounded-xl px-4 py-3 text-sm font-bold"
          >
            {scanError}
          </div>
        )}

        {/* Manual Input & Demo QR Simulator */}
        <section
          aria-label="Manual QR input and simulator"
          className="bg-white border-2 border-slate-300 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-extrabold text-slate-950">
            QR Simulator & Manual Test
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleDecodedQr(manualQrInput);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={manualQrInput}
              onChange={(e) => setManualQrInput(e.target.value)}
              placeholder="Paste QR payload (e.g. hudyat://citu-main/assembly-b)"
              aria-label="Manual QR payload"
              className="flex-1 min-h-[48px] px-4 rounded-lg border-2 border-slate-400 text-sm font-mono text-slate-950 bg-white"
            />
            <button
              type="submit"
              className="hudyat-btn hudyat-btn-primary"
            >
              Submit QR
            </button>
          </form>

          {useDemoMode && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleDecodedQr('hudyat://citu-main/assembly-b')}
                className="min-h-[48px] px-4 py-2 rounded-lg bg-emerald-50 border-2 border-emerald-800 text-emerald-950 font-semibold text-sm hover:bg-emerald-100 cursor-pointer"
              >
                Simulate Valid QR (Assembly Area B)
              </button>
              <button
                type="button"
                onClick={() => void handleDecodedQr('hudyat://citu-main/assembly-a')}
                className="min-h-[48px] px-4 py-2 rounded-lg bg-emerald-50 border-2 border-emerald-800 text-emerald-950 font-semibold text-sm hover:bg-emerald-100 cursor-pointer"
              >
                Simulate Alternate Assembly (Area A)
              </button>
              <button
                type="button"
                onClick={() => void handleDecodedQr('hudyat://citu-main/eng-401')}
                className="min-h-[48px] px-4 py-2 rounded-lg bg-amber-50 border-2 border-amber-800 text-amber-950 font-semibold text-sm hover:bg-amber-100 cursor-pointer"
              >
                Simulate Non-Assembly Door QR (ENG 401)
              </button>
              <button
                type="button"
                onClick={() => void handleDecodedQr('hudyat://other-campus/assembly-1')}
                className="min-h-[48px] px-4 py-2 rounded-lg bg-red-50 border-2 border-red-800 text-red-950 font-semibold text-sm hover:bg-red-100 cursor-pointer"
              >
                Simulate Wrong-Campus QR
              </button>
              <button
                type="button"
                onClick={() => void handleResetDemo()}
                className="min-h-[48px] px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 cursor-pointer"
              >
                Reset Check-In
              </button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default CheckInScreen;
