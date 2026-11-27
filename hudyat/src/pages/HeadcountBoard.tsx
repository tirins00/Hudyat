import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { SidebarNav } from '../components/SidebarNav';
import { getHeadcountFirestore } from '../firebase/headcountClient';
import { useHudyatSession } from '../routes/useHudyatSession';
import {
  HeadcountService,
  toMillis,
  type GroupCount,
  type MissingRow,
} from '../services/HeadcountService';
import { MissingMonitor } from '../services/MissingMonitor';
import {
  SOS_PRESETS,
  acknowledgeSos,
  demoSosStore,
  resolveSos,
  sendSos,
  subscribeToSosAlerts,
} from '../services/SosService';
import type {
  Alert,
  CheckIn,
  Drill,
  ExpectedEntry,
  MapNode,
  Response,
  Section,
  Sos,
  User,
} from '../types/models';

interface DemoDataset {
  drill: Drill;
  users: User[];
  sections: Section[];
  mapNodes: MapNode[];
  expectedEntries: ExpectedEntry[];
  checkIns: CheckIn[];
  responses: Response[];
  alerts: Alert[];
}

function createInitialDemoData(pastDeadline: boolean): DemoDataset {
  const nowMs = Date.now();
  const startedAt = Timestamp.fromMillis(nowMs - 8 * 60 * 1000);
  const evacuateAt = Timestamp.fromMillis(nowMs - 6 * 60 * 1000);
  const deadlineAt = Timestamp.fromMillis(
    pastDeadline ? nowMs - 60 * 1000 : nowMs + 3 * 60 * 1000,
  );

  const drill: Drill = {
    id: 'demo-drill-2026-12-03',
    campusId: 'citu-main',
    title: 'CIT-U Campus Earthquake Drill (Demo)',
    phase: 'evacuate',
    scenario: 'normal',
    blockedNodeIds: [],
    blockedEdgeIds: [],
    createdBy: 'coord-1',
    startedAt,
    evacuateAt,
    deadlineAt,
    dchDurationSec: 60,
  };

  const users: User[] = [
    {
      uid: 'coord-1',
      email: 'drrm@cit.edu',
      displayName: 'DRRM Coordinator',
      role: 'coordinator',
      campusId: 'citu-main',
      createdAt: startedAt,
    },
    {
      uid: 'teacher-1',
      email: 'reyes@cit.edu',
      displayName: 'Ms. Reyes',
      role: 'teacher',
      campusId: 'citu-main',
      createdAt: startedAt,
    },
    {
      uid: 'teacher-2',
      email: 'santos@cit.edu',
      displayName: 'Mr. Santos',
      role: 'teacher',
      campusId: 'citu-main',
      createdAt: startedAt,
    },
  ];

  const sections: Section[] = [
    {
      id: 'sec-it332-g1',
      campusId: 'citu-main',
      code: 'IT332-G1',
      name: 'Capstone & Research 1 - G1',
      teacherUid: 'teacher-2',
    },
    {
      id: 'sec-it332-g2',
      campusId: 'citu-main',
      code: 'IT332-G2',
      name: 'Capstone & Research 1 - G2',
      teacherUid: 'teacher-1',
    },
  ];

  const mapNodes: MapNode[] = [
    {
      id: 'eng-401',
      campusId: 'citu-main',
      buildingId: 'eng',
      floor: 4,
      label: 'ENG 401',
      type: 'room',
      x: 100,
      y: 100,
    },
    {
      id: 'eng-402',
      campusId: 'citu-main',
      buildingId: 'eng',
      floor: 4,
      label: 'ENG 402',
      type: 'room',
      x: 180,
      y: 100,
    },
    {
      id: 'stair-a',
      campusId: 'citu-main',
      buildingId: 'eng',
      floor: 2,
      label: 'Stairway A',
      type: 'stair',
      x: 240,
      y: 180,
    },
    {
      id: 'canteen',
      campusId: 'citu-main',
      buildingId: 'main',
      floor: 1,
      label: 'Canteen',
      type: 'common',
      x: 320,
      y: 260,
    },
    {
      id: 'assembly-b',
      campusId: 'citu-main',
      buildingId: null,
      floor: 1,
      label: 'Assembly Area B',
      type: 'assembly',
      x: 420,
      y: 320,
    },
  ];

  const expectedEntries: ExpectedEntry[] = [];
  const checkIns: CheckIn[] = [];
  const checkedInTime = Timestamp.fromMillis(nowMs - 2 * 60 * 1000);

  // IT332-G1 (ENG 401): 22 expected, 22 accounted
  for (let i = 1; i <= 22; i++) {
    const uid = `g1-s${i}`;
    const displayName = `G1 Student ${i}`;
    users.push({
      uid,
      email: `${uid}@cit.edu`,
      displayName,
      role: 'student',
      campusId: 'citu-main',
      studentNumber: `2023-10${String(i).padStart(2, '0')}`,
      createdAt: startedAt,
    });
    expectedEntries.push({
      id: uid,
      drillId: drill.id,
      studentUid: uid,
      displayName,
      sectionId: 'sec-it332-g1',
      teacherUid: 'teacher-2',
      roomNodeId: 'eng-401',
      buildingId: 'eng',
      floor: 4,
      expectedAssemblyNodeId: 'assembly-b',
    });
    checkIns.push({
      studentUid: uid,
      drillId: drill.id,
      method: 'qr',
      assemblyNodeId: 'assembly-b',
      sectionId: 'sec-it332-g1',
      checkedInBy: uid,
      checkedInAt: checkedInTime,
    });
  }

  // IT332-G2 (ENG 402): 20 expected, 19 accounted, 1 missing (Ben Lim)
  for (let i = 1; i <= 20; i++) {
    const isBen = i === 20;
    const uid = isBen ? 'stu-ben-lim' : `g2-s${i}`;
    const displayName = isBen ? 'Ben Lim' : `G2 Student ${i}`;
    users.push({
      uid,
      email: `${uid}@cit.edu`,
      displayName,
      role: 'student',
      campusId: 'citu-main',
      studentNumber: `2023-20${String(i).padStart(2, '0')}`,
      createdAt: startedAt,
    });
    expectedEntries.push({
      id: uid,
      drillId: drill.id,
      studentUid: uid,
      displayName,
      sectionId: 'sec-it332-g2',
      teacherUid: 'teacher-1',
      roomNodeId: 'eng-402',
      buildingId: 'eng',
      floor: 4,
      expectedAssemblyNodeId: 'assembly-b',
    });
    if (!isBen) {
      checkIns.push({
        studentUid: uid,
        drillId: drill.id,
        method: i === 19 ? 'teacher' : 'qr',
        assemblyNodeId: 'assembly-b',
        sectionId: 'sec-it332-g2',
        checkedInBy: i === 19 ? 'teacher-1' : uid,
        checkedInAt: checkedInTime,
      });
    }
  }

  // Not in class: 18 expected, 15 accounted, 1 pending peer check-in (Di Uy), 2 missing (Eva Go, Di Uy)
  for (let i = 1; i <= 18; i++) {
    const isEva = i === 17;
    const isDi = i === 18;
    const uid = isEva ? 'stu-eva-go' : isDi ? 'stu-di-uy' : `nic-s${i}`;
    const displayName = isEva
      ? 'Eva Go'
      : isDi
        ? 'Di Uy'
        : `Campus Student ${i}`;
    users.push({
      uid,
      email: `${uid}@cit.edu`,
      displayName,
      role: 'student',
      campusId: 'citu-main',
      studentNumber: `2023-30${String(i).padStart(2, '0')}`,
      createdAt: startedAt,
    });
    expectedEntries.push({
      id: uid,
      drillId: drill.id,
      studentUid: uid,
      displayName,
      group: 'Not in class',
      sectionId: '',
      teacherUid: '',
      roomNodeId: '',
      buildingId: '',
      floor: 1,
      expectedAssemblyNodeId: 'assembly-b',
    });
    if (!isEva && !isDi) {
      checkIns.push({
        studentUid: uid,
        drillId: drill.id,
        method: 'qr',
        assemblyNodeId: 'assembly-b',
        checkedInBy: uid,
        checkedInAt: checkedInTime,
      });
    } else if (isDi) {
      // Unverified peer check-in -> counted in Pending, not Accounted
      checkIns.push({
        studentUid: uid,
        drillId: drill.id,
        method: 'peer',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 'nic-s1',
        verifiedBy: null,
        checkedInAt: checkedInTime,
      });
    }
  }

  const responses: Response[] = [
    {
      id: 'resp-ben',
      drillId: drill.id,
      uid: 'stu-ben-lim',
      phase: 'evacuate',
      status: 'evacuating',
      currentNodeId: 'stair-a',
      updatedAt: Timestamp.fromMillis(nowMs - 3 * 60 * 1000),
    },
    {
      id: 'resp-eva',
      drillId: drill.id,
      uid: 'stu-eva-go',
      phase: 'evacuate',
      status: 'evacuating',
      currentNodeId: 'canteen',
      updatedAt: Timestamp.fromMillis(nowMs - 3 * 60 * 1000),
    },
    {
      id: 'resp-di',
      drillId: drill.id,
      uid: 'stu-di-uy',
      phase: 'evacuate',
      status: 'evacuating',
      currentNodeId: 'canteen',
      updatedAt: Timestamp.fromMillis(nowMs - 2 * 60 * 1000),
    },
  ];

  return {
    drill,
    users,
    sections,
    mapNodes,
    expectedEntries,
    checkIns,
    responses,
    alerts: [],
  };
}

export function HeadcountBoard() {
  const { authUser, activeDrillId: campusActiveDrillId, firebaseReady } =
    useHudyatSession();
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);
  const useDemoMode = demoOverride ?? (!firebaseReady || !authUser);

  const [manualDrillId, setManualDrillId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('drillId') ?? '';
    }
    return '';
  });
  const drillIdInput =
    manualDrillId.trim() || campusActiveDrillId || 'active-drill';

  // Live Firestore state
  const [liveDrill, setLiveDrill] = useState<Drill | null>(null);
  const [liveExpected, setLiveExpected] = useState<ExpectedEntry[]>([]);
  const [liveCheckIns, setLiveCheckIns] = useState<CheckIn[]>([]);
  const [liveResponses, setLiveResponses] = useState<Response[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);
  const [liveUsers, setLiveUsers] = useState<User[]>([]);
  const [liveSections, setLiveSections] = useState<Section[]>([]);
  const [liveNodes, setLiveNodes] = useState<MapNode[]>([]);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Demo mode state
  const [pastDeadline, setPastDeadline] = useState<boolean>(true);
  const [demoData, setDemoData] = useState<DemoDataset>(() =>
    createInitialDemoData(true),
  );
  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  const [sosAlerts, setSosAlerts] = useState<Sos[]>([]);
  const [sosActionError, setSosActionError] = useState<string | null>(null);
  const demoSosCounterRef = useRef<number>(0);

  const monitorRef = useRef<MissingMonitor | null>(null);

  // Keep a 1-second clock tick so deadline transitions reflect immediately.
  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to Firestore real-time listeners when in Live mode.
  useEffect(() => {
    if (useDemoMode) {
      return;
    }

    const db = getHeadcountFirestore();
    if (!db) {
      return;
    }

    const drillId = drillIdInput.trim();
    if (!drillId) return;

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      onSnapshot(
        doc(db, 'drills', drillId),
        (snap) => {
          setFirestoreError(null);
          if (snap.exists()) {
            setLiveDrill({
              ...(snap.data() as Omit<Drill, 'id'>),
              id: snap.id,
            });
          } else {
            setLiveDrill(null);
          }
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'expectedEntries')),
        (snap) => {
          setLiveExpected(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<ExpectedEntry, 'id'>),
              id: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'checkIns')),
        (snap) => {
          setLiveCheckIns(
            snap.docs.map((d) => ({
              ...(d.data() as CheckIn),
              studentUid: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'responses')),
        (snap) => {
          setLiveResponses(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<Response, 'id'>),
              id: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'alerts')),
        (snap) => {
          setLiveAlerts(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<Alert, 'id'>),
              id: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(query(collection(db, 'users')), (snap) => {
        setLiveUsers(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<User, 'uid'>),
            uid: d.id,
          })),
        );
      }),
    );

    unsubscribers.push(
      onSnapshot(query(collection(db, 'sections')), (snap) => {
        setLiveSections(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<Section, 'id'>),
            id: d.id,
          })),
        );
      }),
    );

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [useDemoMode, drillIdInput]);

  // Subscribe to campus mapNodes once liveDrill.campusId is known.
  useEffect(() => {
    if (useDemoMode || !liveDrill?.campusId) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsub = onSnapshot(
      query(collection(db, 'campuses', liveDrill.campusId, 'mapNodes')),
      (snap) => {
        setLiveNodes(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<MapNode, 'id'>),
            id: d.id,
          })),
        );
      },
    );
    return () => unsub();
  }, [useDemoMode, liveDrill?.campusId]);

  const handleDemoWriteAlert = useCallback((alert: Alert) => {
    setDemoData((prev) => {
      const exists = prev.alerts.some((a) => a.id === alert.id);
      if (exists) return prev;
      return { ...prev, alerts: [...prev.alerts, alert] };
    });
  }, []);

  const headcountService = useMemo<HeadcountService | null>(() => {
    if (useDemoMode) {
      return new HeadcountService({
        drill: demoData.drill,
        expectedEntries: demoData.expectedEntries,
        checkIns: demoData.checkIns,
        responses: demoData.responses,
        alerts: demoData.alerts,
        users: demoData.users,
        sections: demoData.sections,
        mapNodes: demoData.mapNodes,
        onWriteAlert: handleDemoWriteAlert,
      });
    }

    if (!liveDrill) return null;
    return new HeadcountService({
      drill: liveDrill,
      expectedEntries: liveExpected,
      checkIns: liveCheckIns,
      responses: liveResponses,
      alerts: liveAlerts,
      users: liveUsers,
      sections: liveSections,
      mapNodes: liveNodes,
      db: getHeadcountFirestore(),
      coordinatorUid: authUser?.uid,
    });
  }, [
    useDemoMode,
    demoData,
    handleDemoWriteAlert,
    liveDrill,
    liveExpected,
    liveCheckIns,
    liveResponses,
    liveAlerts,
    liveUsers,
    liveSections,
    liveNodes,
    authUser?.uid,
  ]);

  const serviceRef = useRef<HeadcountService | null>(null);
  useEffect(() => {
    serviceRef.current = headcountService;
  }, [headcountService]);

  // Start MissingMonitor (checks every 5 seconds for missing students past deadlineAt).
  useEffect(() => {
    const monitor = new MissingMonitor({
      service: () => serviceRef.current,
      intervalMs: 5000,
    });
    monitorRef.current = monitor;
    monitor.start();
    return () => {
      monitor.stop();
      monitorRef.current = null;
    };
  }, [useDemoMode, drillIdInput]);

  const groupCounts: GroupCount[] = useMemo(
    () => (headcountService ? headcountService.counts() : []),
    [headcountService],
  );

  const totals = useMemo(
    () =>
      headcountService
        ? headcountService.totals()
        : { expected: 0, accounted: 0, pending: 0, missing: 0, late: 0 },
    [headcountService],
  );

  const missingRows: MissingRow[] = useMemo(
    () => (headcountService ? headcountService.missing(nowTick) : []),
    [headcountService, nowTick],
  );

  const activeDrill = useDemoMode ? demoData.drill : liveDrill;
  const activeDrillId = useDemoMode ? demoData.drill.id : drillIdInput.trim();

  // Subscribe to incoming SOS alerts (drills/{drillId}/sos or Demo Mode store).
  useEffect(() => {
    if (!activeDrillId) return;
    const unsub = subscribeToSosAlerts(
      activeDrillId,
      (alerts) => {
        setSosAlerts(alerts);
      },
      {
        useDemoMode,
        onError: (err) => setSosActionError(err.message),
      },
    );
    return () => unsub();
  }, [activeDrillId, useDemoMode]);

  const deadlineMs = toMillis(activeDrill?.deadlineAt);
  const isDeadlinePassed =
    deadlineMs !== null && nowTick.getTime() >= deadlineMs;

  // Demo interactive handlers
  const handleToggleDemoDeadline = () => {
    const nextPast = !pastDeadline;
    setPastDeadline(nextPast);
    const nowMs = Date.now();
    setDemoData((prev) => ({
      ...prev,
      drill: {
        ...prev.drill,
        deadlineAt: Timestamp.fromMillis(
          nextPast ? nowMs - 60 * 1000 : nowMs + 3 * 60 * 1000,
        ),
      },
      alerts: nextPast ? prev.alerts : [],
    }));
    monitorRef.current?.reset();
  };

  const handleVerifyPendingPeer = () => {
    setDemoData((prev) => ({
      ...prev,
      checkIns: prev.checkIns.map((c) =>
        c.method === 'peer' && !c.verifiedBy
          ? { ...c, verifiedBy: 'teacher-1' }
          : c,
      ),
    }));
  };

  const handleSimulateLateCheckIn = () => {
    const nextMissing = missingRows.find((r) => !r.pendingPeerCheckIn);
    if (!nextMissing) return;
    setDemoData((prev) => ({
      ...prev,
      checkIns: [
        ...prev.checkIns,
        {
          studentUid: nextMissing.studentUid,
          drillId: prev.drill.id,
          method: 'qr',
          assemblyNodeId: 'assembly-b',
          sectionId: nextMissing.sectionId ?? undefined,
          checkedInBy: nextMissing.studentUid,
          checkedInAt: Timestamp.fromMillis(Date.now()),
        },
      ],
    }));
  };

  const handleResetDemo = () => {
    setPastDeadline(true);
    setDemoData(createInitialDemoData(true));
    demoSosStore.clear(demoData.drill.id);
    setSosActionError(null);
    monitorRef.current?.reset();
  };

  const handleSimulateSos = async () => {
    setSosActionError(null);
    const idx = demoSosCounterRef.current;
    demoSosCounterRef.current += 1;
    const sampleScenarios = [
      {
        uid: 'stu-ben-lim',
        nodeId: 'stair-a',
        zoneLabel: 'Stairway A',
        message: SOS_PRESETS[1].label,
        note: 'Smoke near 2nd floor landing',
      },
      {
        uid: 'stu-eva-go',
        nodeId: 'canteen',
        zoneLabel: 'Canteen',
        message: SOS_PRESETS[0].label,
        note: 'Twisted ankle during evacuation',
      },
      {
        uid: 'stu-di-uy',
        nodeId: 'eng-402',
        zoneLabel: 'ENG 402',
        message: SOS_PRESETS[2].label,
      },
    ];
    const sample = sampleScenarios[idx % sampleScenarios.length];
    try {
      await sendSos(
        {
          drillId: demoData.drill.id,
          uid: sample.uid,
          nodeId: sample.nodeId,
          zoneLabel: sample.zoneLabel,
          message: sample.message,
          note: sample.note,
        },
        { useDemoMode: true },
      );
    } catch (err: unknown) {
      setSosActionError(
        err instanceof Error ? err.message : 'Failed to simulate SOS.',
      );
    }
  };

  const actorUid = authUser?.uid || 'coord-1';

  const handleAcknowledgeSos = async (sosId: string) => {
    setSosActionError(null);
    try {
      await acknowledgeSos(activeDrillId, sosId, actorUid, { useDemoMode });
    } catch (err: unknown) {
      setSosActionError(
        err instanceof Error ? err.message : 'Failed to acknowledge SOS.',
      );
    }
  };

  const handleResolveSos = async (sosId: string) => {
    setSosActionError(null);
    try {
      await resolveSos(activeDrillId, sosId, actorUid, { useDemoMode });
    } catch (err: unknown) {
      setSosActionError(
        err instanceof Error ? err.message : 'Failed to resolve SOS.',
      );
    }
  };

  const activeUsersList = useDemoMode ? demoData.users : liveUsers;
  const activeNodesList = useDemoMode ? demoData.mapNodes : liveNodes;
  const activeResponsesList = useDemoMode ? demoData.responses : liveResponses;
  const incomingSosAlerts = useMemo(
    () => sosAlerts.filter((s) => s.status !== 'resolved'),
    [sosAlerts],
  );
  const resolvedSosCount = sosAlerts.length - incomingSosAlerts.length;

  const hasPendingPeerInDemo = demoData.checkIns.some(
    (c) => c.method === 'peer' && !c.verifiedBy,
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row font-sans">
      <SidebarNav activePath="/headcount" />

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Header & Mode Controls */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
              Headcount Board
            </h1>
            <p className="text-sm font-medium text-slate-700 mt-1">
              {activeDrill
                ? `${activeDrill.title} • Phase: ${activeDrill.phase.toUpperCase()}`
                : 'No active drill selected'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!useDemoMode && (
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>Drill ID:</span>
                <input
                  type="text"
                  value={manualDrillId || campusActiveDrillId || ''}
                  onChange={(e) => setManualDrillId(e.target.value)}
                  className="min-h-[48px] px-3 rounded-lg border border-slate-400 bg-white text-slate-950 font-mono text-sm"
                  placeholder="active-drill"
                />
              </label>
            )}

            <button
              type="button"
              onClick={() => {
                setFirestoreError(null);
                setDemoOverride(!useDemoMode);
              }}
              className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border-2 border-slate-800 bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-400 cursor-pointer"
            >
              {useDemoMode ? 'Mode: Demo (Switch to Live)' : 'Mode: Live Firestore (Switch to Demo)'}
            </button>
          </div>
        </header>

        {/* Demo Mode / Firebase Status Banner */}
        {useDemoMode ? (
          <section
            aria-label="Demo mode controls"
            className="bg-amber-50 border-2 border-amber-700 rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm font-bold text-amber-950">
                {firebaseReady
                  ? 'Demo Mode active — showing interactive sample drill data.'
                  : 'Firebase .env keys not configured — running in interactive Demo Mode.'}
              </p>
              <span className="text-xs font-semibold text-amber-900">
                MissingMonitor checks every 5s
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleToggleDemoDeadline}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-white border-2 border-amber-800 text-amber-950 font-semibold text-sm hover:bg-amber-100 cursor-pointer"
              >
                {pastDeadline
                  ? 'Simulate Before Deadline'
                  : 'Simulate Past Deadline'}
              </button>
              <button
                type="button"
                onClick={handleVerifyPendingPeer}
                disabled={!hasPendingPeerInDemo}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-white border-2 border-slate-800 text-slate-950 font-semibold text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Verify Pending Peer Check-In
              </button>
              <button
                type="button"
                onClick={handleSimulateLateCheckIn}
                disabled={!isDeadlinePassed || missingRows.length === 0}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-white border-2 border-emerald-800 text-emerald-950 font-semibold text-sm hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Simulate Late Check-In
              </button>
              <button
                type="button"
                onClick={() => void handleSimulateSos()}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-red-700 border-2 border-red-950 text-white font-bold text-sm hover:bg-red-800 cursor-pointer"
              >
                Simulate SOS
              </button>
              <button
                type="button"
                onClick={handleResetDemo}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 cursor-pointer"
              >
                Reset Demo
              </button>
            </div>
          </section>
        ) : (
          (!firebaseReady || firestoreError) && (
            <div
              role="alert"
              className="bg-red-50 border-2 border-red-700 text-red-950 rounded-xl p-4 text-sm font-semibold"
            >
              {firestoreError ??
                'Firebase .env keys are not configured. Switch to Demo Mode to preview.'}
            </div>
          )
        )}

        {/* Active Incoming SOS Alert Cards (Module 5.4 Coordinator Panel) */}
        {(incomingSosAlerts.length > 0 || resolvedSosCount > 0 || sosActionError) && (
          <section aria-label="Incoming SOS alerts" className="space-y-3">
            {sosActionError && (
              <div
                role="alert"
                className="bg-red-50 border-2 border-red-800 text-red-950 rounded-xl px-4 py-3 text-sm font-bold"
              >
                {sosActionError}
              </div>
            )}

            {incomingSosAlerts.map((sos) => {
              const student = activeUsersList.find((u) => u.uid === sos.uid);
              const studentName = student?.displayName ?? sos.uid;
              const responseZoneId = activeResponsesList.find(
                (r) => r.uid === sos.uid,
              )?.currentNodeId;
              const zoneId = sos.nodeId || responseZoneId || '';
              const zoneNode = activeNodesList.find((n) => n.id === zoneId);
              const zoneLabel =
                zoneNode?.label ?? sos.zoneLabel ?? (zoneId || 'Unknown');
              const timeSent = sos.createdAt.toDate().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              const isAcknowledged = sos.status === 'acknowledged';

              return (
                <article
                  key={sos.id}
                  role="alert"
                  className="bg-red-50 border-2 border-red-800 rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="bg-red-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-red-900">
                        SOS
                      </span>
                      <h2 className="text-base font-extrabold">
                        {studentName}
                      </h2>
                    </div>
                    <span
                      className={
                        isAcknowledged
                          ? 'px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 text-xs font-extrabold uppercase'
                          : 'px-2.5 py-0.5 rounded-full bg-white text-red-950 text-xs font-extrabold uppercase'
                      }
                    >
                      {isAcknowledged ? 'Acknowledged' : 'Active'}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1 text-sm text-slate-950">
                      <p className="text-base font-extrabold text-red-950">
                        {sos.message || 'Emergency assistance needed'}
                      </p>
                      {sos.note && (
                        <p className="font-semibold text-slate-900">
                          Note: {sos.note}
                        </p>
                      )}
                      <p className="font-semibold text-slate-800">
                        Last known zone:{' '}
                        <span className="font-extrabold text-slate-950">
                          {zoneLabel}
                        </span>{' '}
                        • Sent at{' '}
                        <span className="font-extrabold text-slate-950">
                          {timeSent}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {!isAcknowledged && (
                        <button
                          type="button"
                          onClick={() => void handleAcknowledgeSos(sos.id)}
                          className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-amber-700 text-white font-bold text-sm hover:bg-amber-800 cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleResolveSos(sos.id)}
                        className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 cursor-pointer"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {incomingSosAlerts.length === 0 && resolvedSosCount > 0 && (
              <p className="text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-700 rounded-lg px-3 py-2">
                All SOS alerts resolved ({resolvedSosCount} resolved).
              </p>
            )}
          </section>
        )}

        {/* Top 4 Summary Cards (SDD Figure 44) */}
        <section
          aria-label="Headcount summary"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white border-2 border-slate-400 rounded-xl p-4 min-h-[88px] flex flex-col justify-center">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Expected
            </span>
            <span className="text-3xl font-extrabold text-slate-950 tabular-nums mt-1">
              {totals.expected}
            </span>
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-700 rounded-xl p-4 min-h-[88px] flex flex-col justify-center">
            <span className="text-sm font-bold uppercase tracking-wide text-emerald-900">
              Accounted
            </span>
            <span className="text-3xl font-extrabold text-emerald-950 tabular-nums mt-1">
              {totals.accounted}
            </span>
            {totals.late > 0 && (
              <span className="text-xs font-semibold text-emerald-900 mt-0.5">
                Includes {totals.late} late check-in
              </span>
            )}
          </div>

          <div className="bg-amber-50 border-2 border-amber-700 rounded-xl p-4 min-h-[88px] flex flex-col justify-center">
            <span className="text-sm font-bold uppercase tracking-wide text-amber-900">
              Pending
            </span>
            <span className="text-3xl font-extrabold text-amber-950 tabular-nums mt-1">
              {totals.pending}
            </span>
          </div>

          <div className="bg-red-50 border-2 border-red-700 rounded-xl p-4 min-h-[88px] flex flex-col justify-center">
            <span className="text-sm font-bold uppercase tracking-wide text-red-900">
              Missing
            </span>
            <span className="text-3xl font-extrabold text-red-950 tabular-nums mt-1">
              {totals.missing}
            </span>
          </div>
        </section>

        {/* Group Breakdown Table (SDD Figure 44) */}
        <section
          aria-label="Headcount by group"
          className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-950">
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Group
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Expected
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Accounted
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Missing
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {groupCounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 px-4 text-center text-sm font-medium text-slate-700"
                    >
                      No expected entries recorded for this drill yet.
                    </td>
                  </tr>
                ) : (
                  groupCounts.map((group) => (
                    <tr key={group.key} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                        {group.displayLabel}
                        {group.pending > 0 && (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-950 border border-amber-700">
                            {group.pending} pending peer
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold tabular-nums">
                        {group.expected}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold tabular-nums text-emerald-900">
                        {group.accounted}
                      </td>
                      <td
                        className={
                          group.missing > 0
                            ? 'py-3.5 px-4 text-sm font-extrabold tabular-nums text-red-800'
                            : 'py-3.5 px-4 text-sm font-semibold tabular-nums text-slate-700'
                        }
                      >
                        {group.missing}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Missing Students Table (SDD Figure 44) */}
        <section
          aria-label="Missing students list"
          className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden"
        >
          {!isDeadlinePassed ? (
            <div className="p-5 bg-slate-50 text-slate-900 text-sm font-semibold">
              {deadlineMs !== null
                ? `Assembly deadline has not passed yet (${new Date(deadlineMs).toLocaleTimeString()}). Unaccounted students will be flagged as Missing once the deadline passes.`
                : 'Assembly deadline is not set yet. Missing list activates once the drill advances to Evacuate and sets a deadline.'}
            </div>
          ) : missingRows.length === 0 ? (
            <div className="p-5 bg-emerald-50 text-emerald-950 text-sm font-bold">
              Headcount complete — all expected students are accounted for.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-950">
                    <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                      Missing student
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                      Expected room
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                      Last zone
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                      Alerted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {missingRows.map((row) => (
                    <tr key={row.studentUid} className="hover:bg-red-50/40">
                      <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                        {row.studentName}
                        {row.pendingPeerCheckIn && (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-950 border border-amber-700">
                            Pending peer verification
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold">
                        {row.expectedRoomLabel}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold">
                        {row.lastZoneLabel}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                        {row.alertedName !== '—' ? (
                          <span>{row.alertedName}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void headcountService?.alertNearest(row)}
                            className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-red-700 text-white font-semibold text-xs hover:bg-red-800 cursor-pointer"
                          >
                            Alert Nearest
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default HeadcountBoard;
