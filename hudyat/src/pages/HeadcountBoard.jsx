import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import HeadcountDemoBanner from '../components/teacher/HeadcountDemoBanner.jsx';
import HeadcountGroupTable from '../components/teacher/HeadcountGroupTable.jsx';
import HeadcountHeaderActions from '../components/teacher/HeadcountHeaderActions.jsx';
import HeadcountMissingTable from '../components/teacher/HeadcountMissingTable.jsx';
import HeadcountSosAlertList from '../components/teacher/HeadcountSosAlertList.jsx';
import HeadcountSummaryCards from '../components/teacher/HeadcountSummaryCards.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import { createInitialDemoData } from '../data/headcountDemoData.js';
import { getHeadcountFirestore } from '../firebase/headcountClient.js';
import { useHudyatSession } from '../routes/useHudyatSession.js';
import {
  HeadcountService,
  toMillis,
} from '../services/HeadcountService.js';
import { MissingMonitor } from '../services/MissingMonitor.js';
import {
  SOS_PRESETS,
  acknowledgeSos,
  demoSosStore,
  resolveSos,
  sendSos,
  subscribeToSosAlerts,
} from '../services/SosService.js';

export function HeadcountBoard() {
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
  const drillIdInput =
    manualDrillId.trim() || campusActiveDrillId || 'active-drill';

  const [liveDrill, setLiveDrill] = useState(null);
  const [liveExpected, setLiveExpected] = useState([]);
  const [liveCheckIns, setLiveCheckIns] = useState([]);
  const [liveResponses, setLiveResponses] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [liveUsers, setLiveUsers] = useState([]);
  const [liveSections, setLiveSections] = useState([]);
  const [liveNodes, setLiveNodes] = useState([]);
  const [firestoreError, setFirestoreError] = useState(null);

  const [pastDeadline, setPastDeadline] = useState(true);
  const [demoData, setDemoData] = useState(() => createInitialDemoData(true));
  const [nowTick, setNowTick] = useState(() => new Date());
  const [sosAlerts, setSosAlerts] = useState([]);
  const [sosActionError, setSosActionError] = useState(null);
  const demoSosCounterRef = useRef(0);

  const monitorRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (useDemoMode) return;

    const db = getHeadcountFirestore();
    if (!db) return;

    const drillId = drillIdInput.trim();
    if (!drillId) return;

    const unsubscribers = [];

    unsubscribers.push(
      onSnapshot(
        doc(db, 'drills', drillId),
        (snap) => {
          setFirestoreError(null);
          if (snap.exists()) {
            setLiveDrill({ ...snap.data(), id: snap.id });
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
          setLiveExpected(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'checkIns')),
        (snap) => {
          setLiveCheckIns(
            snap.docs.map((d) => ({ ...d.data(), studentUid: d.id })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'responses')),
        (snap) => {
          setLiveResponses(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'alerts')),
        (snap) => {
          setLiveAlerts(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(query(collection(db, 'users')), (snap) => {
        setLiveUsers(snap.docs.map((d) => ({ ...d.data(), uid: d.id })));
      }),
    );

    unsubscribers.push(
      onSnapshot(query(collection(db, 'sections')), (snap) => {
        setLiveSections(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      }),
    );

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [useDemoMode, drillIdInput]);

  useEffect(() => {
    if (useDemoMode || !liveDrill?.campusId) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsub = onSnapshot(
      query(collection(db, 'campuses', liveDrill.campusId, 'mapNodes')),
      (snap) => {
        setLiveNodes(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      },
    );
    return () => unsub();
  }, [useDemoMode, liveDrill?.campusId]);

  const handleDemoWriteAlert = useCallback((alert) => {
    setDemoData((prev) => {
      const exists = prev.alerts.some((a) => a.id === alert.id);
      if (exists) return prev;
      return { ...prev, alerts: [...prev.alerts, alert] };
    });
  }, []);

  const headcountService = useMemo(() => {
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

  const serviceRef = useRef(null);
  useEffect(() => {
    serviceRef.current = headcountService;
  }, [headcountService]);

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

  const groupCounts = useMemo(
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

  const missingRows = useMemo(
    () => (headcountService ? headcountService.missing(nowTick) : []),
    [headcountService, nowTick],
  );

  const activeDrill = useDemoMode ? demoData.drill : liveDrill;
  const activeDrillId = useDemoMode ? demoData.drill.id : drillIdInput.trim();

  useEffect(() => {
    if (!activeDrillId) return;
    const unsub = subscribeToSosAlerts(
      activeDrillId,
      (alerts) => setSosAlerts(alerts),
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
    } catch (err) {
      setSosActionError(
        err instanceof Error ? err.message : 'Failed to simulate SOS.',
      );
    }
  };

  const actorUid = authUser?.uid || 'coord-1';

  const handleAcknowledgeSos = async (sosId) => {
    setSosActionError(null);
    try {
      await acknowledgeSos(activeDrillId, sosId, actorUid, { useDemoMode });
    } catch (err) {
      setSosActionError(
        err instanceof Error ? err.message : 'Failed to acknowledge SOS.',
      );
    }
  };

  const handleResolveSos = async (sosId) => {
    setSosActionError(null);
    try {
      await resolveSos(activeDrillId, sosId, actorUid, { useDemoMode });
    } catch (err) {
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
  const liveErrorBanner =
    !useDemoMode && (!firebaseReady || firestoreError)
      ? firestoreError ??
        'Firebase .env keys are not configured. Switch to Demo Mode to preview.'
      : '';

  return (
    <AppShell
      title="Headcount Board"
      subtitle={
        activeDrill
          ? `${activeDrill.title} • Phase: ${activeDrill.phase.toUpperCase()}`
          : 'No active drill selected'
      }
      maxWidth="max-w-6xl"
      actions={
        <HeadcountHeaderActions
          useDemoMode={useDemoMode}
          drillIdValue={manualDrillId || campusActiveDrillId || ''}
          onDrillIdChange={setManualDrillId}
          onToggleMode={() => {
            setFirestoreError(null);
            setDemoOverride(!useDemoMode);
          }}
        />
      }
    >
      <PageStack gap="lg">
        {useDemoMode ? (
          <HeadcountDemoBanner
            firebaseReady={firebaseReady}
            pastDeadline={pastDeadline}
            hasPendingPeerInDemo={hasPendingPeerInDemo}
            canSimulateLateCheckIn={isDeadlinePassed && missingRows.length > 0}
            onToggleDeadline={handleToggleDemoDeadline}
            onVerifyPendingPeer={handleVerifyPendingPeer}
            onSimulateLateCheckIn={handleSimulateLateCheckIn}
            onSimulateSos={handleSimulateSos}
            onResetDemo={handleResetDemo}
          />
        ) : (
          <ErrorBanner message={liveErrorBanner} />
        )}

        <HeadcountSosAlertList
          incomingSosAlerts={incomingSosAlerts}
          resolvedSosCount={resolvedSosCount}
          sosActionError={sosActionError}
          activeUsersList={activeUsersList}
          activeNodesList={activeNodesList}
          activeResponsesList={activeResponsesList}
          onAcknowledgeSos={handleAcknowledgeSos}
          onResolveSos={handleResolveSos}
        />

        <HeadcountSummaryCards totals={totals} />

        <HeadcountGroupTable groupCounts={groupCounts} />

        <HeadcountMissingTable
          isDeadlinePassed={isDeadlinePassed}
          deadlineMs={deadlineMs}
          missingRows={missingRows}
          onAlertNearest={(row) => headcountService?.alertNearest(row)}
        />
      </PageStack>
    </AppShell>
  );
}

export default HeadcountBoard;
