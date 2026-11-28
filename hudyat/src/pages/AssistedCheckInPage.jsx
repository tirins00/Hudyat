import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import AssistedHeaderActions from '../components/teacher/AssistedHeaderActions.jsx';
import AssistedLiveContextCard from '../components/teacher/AssistedLiveContextCard.jsx';
import AssistedRosterTable from '../components/teacher/AssistedRosterTable.jsx';
import AssistedSearchCard from '../components/teacher/AssistedSearchCard.jsx';
import PeerCheckInModal from '../components/teacher/PeerCheckInModal.jsx';
import Button from '../components/ui/Button.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import StatusBanner from '../components/ui/StatusBanner.jsx';
import {
  DEMO_ASSISTED_CAMPUS_ID,
  DEMO_ASSISTED_DRILL_ID,
  DEMO_ASSISTED_PEER_UID,
  DEMO_ASSISTED_TEACHER_UID,
  createDemoRoster,
} from '../data/assistedDemoData.js';
import { getHeadcountFirestore } from '../firebase/headcountClient.js';
import { useHudyatSession } from '../routes/useHudyatSession.js';
import {
  CheckInService,
  createFirestoreCheckInStore,
  createMemoryCheckInStore,
} from '../services/CheckInService.js';
import { QrCodeParser } from '../services/QrCodeParser.js';

export function AssistedCheckInPage() {
  const {
    authUser,
    activeDrillId: campusActiveDrillId,
    firebaseReady,
  } = useHudyatSession();
  const [demoOverride, setDemoOverride] = useState(null);
  const useDemoMode = demoOverride ?? (!firebaseReady || !authUser);

  const [manualCampusId, setManualCampusId] = useState('');
  const [manualDrillId, setManualDrillId] = useState('');
  const [manualTeacherUid, setManualTeacherUid] = useState('');

  const campusId =
    manualCampusId.trim() || authUser?.campusId || DEMO_ASSISTED_CAMPUS_ID;
  const drillId = manualDrillId.trim() || campusActiveDrillId || 'active-drill';
  const teacherUid =
    manualTeacherUid.trim() || authUser?.uid || DEMO_ASSISTED_TEACHER_UID;
  const peerActorUid = authUser?.uid || DEMO_ASSISTED_PEER_UID;
  const canVerifyOrMarkPresent =
    useDemoMode || !authUser || authUser.role !== 'student';

  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  const [peerSearchQuery, setPeerSearchQuery] = useState('');

  const [liveUsers, setLiveUsers] = useState([]);
  const [liveNodes, setLiveNodes] = useState([]);
  const [liveCheckIns, setLiveCheckIns] = useState([]);

  const initialDemo = useMemo(() => createDemoRoster(), []);
  const [demoCheckIns, setDemoCheckIns] = useState(initialDemo.initialCheckIns);
  const demoStore = useMemo(
    () =>
      createMemoryCheckInStore(initialDemo.initialCheckIns, {
        onChange: (all) => setDemoCheckIns(all),
      }),
    [initialDemo.initialCheckIns],
  );

  useEffect(() => {
    if (useDemoMode) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsubs = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users')),
        (snap) => {
          setLiveUsers(snap.docs.map((d) => ({ ...d.data(), uid: d.id })));
        },
        (err) => setActionError(err.message),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'campuses', campusId, 'mapNodes')),
        (snap) => {
          setLiveNodes(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        },
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'drills', drillId, 'checkIns')),
        (snap) => {
          setLiveCheckIns(
            snap.docs.map((d) => ({ ...d.data(), studentUid: d.id })),
          );
        },
        (err) => setActionError(err.message),
      ),
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [useDemoMode, campusId, drillId]);

  const activeCampusId = useDemoMode ? DEMO_ASSISTED_CAMPUS_ID : campusId;
  const activeDrillId = useDemoMode ? DEMO_ASSISTED_DRILL_ID : drillId;
  const activeUsers = useDemoMode ? initialDemo.users : liveUsers;
  const activeNodes = useDemoMode ? initialDemo.mapNodes : liveNodes;
  const activeCheckIns = useDemoMode ? demoCheckIns : liveCheckIns;

  const defaultAssemblyNodeId = useMemo(
    () => activeNodes.find((n) => n.type === 'assembly')?.id ?? 'assembly-b',
    [activeNodes],
  );

  const checkInByStudent = useMemo(() => {
    const map = new Map();
    for (const c of activeCheckIns) {
      map.set(c.studentUid, c);
    }
    return map;
  }, [activeCheckIns]);

  const createServiceForActor = useCallback(
    (actorUid) => {
      const db = useDemoMode ? null : getHeadcountFirestore();
      const store =
        !useDemoMode && db
          ? createFirestoreCheckInStore(db, activeDrillId)
          : demoStore;
      return new CheckInService({
        drillId: activeDrillId,
        actorUid,
        defaultAssemblyNodeId,
        qrCodeParser: new QrCodeParser(activeCampusId, activeNodes),
        store,
        onDuplicate: () => {
          setActionNotice(
            'Student already has a check-in recorded; original timestamp kept.',
          );
        },
      });
    },
    [
      useDemoMode,
      activeDrillId,
      activeCampusId,
      activeNodes,
      defaultAssemblyNodeId,
      demoStore,
    ],
  );

  const teacherService = useMemo(
    () => createServiceForActor(teacherUid),
    [createServiceForActor, teacherUid],
  );

  const peerService = useMemo(
    () => createServiceForActor(peerActorUid),
    [createServiceForActor, peerActorUid],
  );

  const students = useMemo(
    () => activeUsers.filter((u) => u.role === 'student' && u.active !== false),
    [activeUsers],
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.studentNumber ?? '').toLowerCase().includes(q),
    );
  }, [students, searchQuery]);

  const peerCandidateStudents = useMemo(() => {
    const q = peerSearchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (checkInByStudent.has(s.uid)) return false;
      if (!q) return true;
      return (
        s.displayName.toLowerCase().includes(q) ||
        (s.studentNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [students, checkInByStudent, peerSearchQuery]);

  const handleMarkPresent = async (student) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await teacherService.markPresent(student.uid);
      setActionNotice(`${student.displayName} marked present (Teacher).`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to mark present.',
      );
    }
  };

  const handleConfirmPeer = async (student) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await teacherService.verify(student.uid);
      setActionNotice(`Verified peer check-in for ${student.displayName}.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to verify peer check-in.',
      );
    }
  };

  const handleRejectPeer = async (student) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await teacherService.rejectPeerCheckIn(student.uid);
      setActionNotice(
        `Rejected peer check-in for ${student.displayName}; returned to Unaccounted.`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reject peer check-in.',
      );
    }
  };

  const handleSubmitPeerCheckIn = async (student) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await peerService.peerCheckIn(student.uid);
      setIsPeerModalOpen(false);
      setPeerSearchQuery('');
      setActionNotice(
        `Peer check-in submitted for ${student.displayName} (Pending teacher verification).`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to submit peer check-in.',
      );
    }
  };

  return (
    <AppShell
      title="Assisted Check-In"
      subtitle="Mark students without phones present or verify peer check-ins"
      actions={
        <AssistedHeaderActions
          useDemoMode={useDemoMode}
          onToggleMode={() => {
            setActionError(null);
            setActionNotice(null);
            setDemoOverride(!useDemoMode);
          }}
        />
      }
    >
      <PageStack gap="lg">
        {!useDemoMode && (
          <AssistedLiveContextCard
            campusIdValue={
              manualCampusId || authUser?.campusId || DEMO_ASSISTED_CAMPUS_ID
            }
            onCampusIdChange={setManualCampusId}
            drillIdValue={manualDrillId || campusActiveDrillId || ''}
            onDrillIdChange={setManualDrillId}
            actorUidValue={
              manualTeacherUid || authUser?.uid || DEMO_ASSISTED_TEACHER_UID
            }
            onActorUidChange={setManualTeacherUid}
          />
        )}

        <AssistedSearchCard value={searchQuery} onChange={setSearchQuery} />

        <StatusBanner tone="success" message={actionNotice} />

        <ErrorBanner message={actionError} />

        <AssistedRosterTable
          students={filteredStudents}
          checkInByStudent={checkInByStudent}
          canVerifyOrMarkPresent={canVerifyOrMarkPresent}
          onMarkPresent={handleMarkPresent}
          onSubmitPeerCheckIn={handleSubmitPeerCheckIn}
          onConfirmPeer={handleConfirmPeer}
          onRejectPeer={handleRejectPeer}
        />

        <Button
          variant="primary"
          fullWidth
          onClick={() => setIsPeerModalOpen(true)}
          className="min-h-14 text-base"
        >
          Check in a classmate
        </Button>

        <PeerCheckInModal
          open={isPeerModalOpen}
          onClose={() => setIsPeerModalOpen(false)}
          searchQuery={peerSearchQuery}
          onSearchChange={setPeerSearchQuery}
          candidates={peerCandidateStudents}
          onSubmitPeer={handleSubmitPeerCheckIn}
        />
      </PageStack>
    </AppShell>
  );
}

export default AssistedCheckInPage;
