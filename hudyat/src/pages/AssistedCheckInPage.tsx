import { useEffect, useMemo, useState } from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { SidebarNav } from '../components/SidebarNav';
import {
  getHeadcountFirestore,
  isFirebaseConfigured,
} from '../firebase/headcountClient';
import {
  CheckInService,
  createFirestoreCheckInStore,
  createMemoryCheckInStore,
} from '../services/CheckInService';
import { isVerifiedCheckIn } from '../services/HeadcountService';
import { QrCodeParser } from '../services/QrCodeParser';
import type { CheckIn, MapNode, User } from '../types/models';

const DEMO_CAMPUS_ID = 'citu-main';
const DEMO_DRILL_ID = 'demo-drill-2026-12-03';
const DEMO_TEACHER_UID = 'teacher-1';
const DEMO_PEER_UID = 'stu-ana-cruz';

function createDemoRoster(): {
  users: User[];
  mapNodes: MapNode[];
  initialCheckIns: CheckIn[];
} {
  const createdAt = Timestamp.fromMillis(1_700_000_000_000);
  const users: User[] = [
    {
      uid: 'stu-cy-tan',
      email: 'cytan@cit.edu',
      displayName: 'Cy Tan',
      role: 'student',
      campusId: DEMO_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0101',
      createdAt,
    },
    {
      uid: 'stu-di-uy',
      email: 'diuy@cit.edu',
      displayName: 'Di Uy',
      role: 'student',
      campusId: DEMO_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0102',
      createdAt,
    },
    {
      uid: 'stu-ana-cruz',
      email: 'anacruz@cit.edu',
      displayName: 'Ana Cruz',
      role: 'student',
      campusId: DEMO_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0012',
      createdAt,
    },
    {
      uid: 'stu-ben-lim',
      email: 'benlim@cit.edu',
      displayName: 'Ben Lim',
      role: 'student',
      campusId: DEMO_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0045',
      createdAt,
    },
    {
      uid: 'stu-eva-go',
      email: 'evago@cit.edu',
      displayName: 'Eva Go',
      role: 'student',
      campusId: DEMO_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0188',
      createdAt,
    },
  ];

  const mapNodes: MapNode[] = [
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
  ];

  const initialCheckIns: CheckIn[] = [
    {
      studentUid: 'stu-di-uy',
      drillId: DEMO_DRILL_ID,
      method: 'peer',
      assemblyNodeId: 'assembly-b',
      checkedInBy: DEMO_PEER_UID,
      byUid: DEMO_PEER_UID,
      verifiedBy: null,
      checkedInAt: Timestamp.fromMillis(Date.now() - 90_000),
    },
    {
      studentUid: 'stu-ana-cruz',
      drillId: DEMO_DRILL_ID,
      method: 'qr',
      assemblyNodeId: 'assembly-b',
      checkedInBy: 'stu-ana-cruz',
      byUid: 'stu-ana-cruz',
      verifiedBy: null,
      checkedInAt: Timestamp.fromMillis(Date.now() - 120_000),
    },
  ];

  return { users, mapNodes, initialCheckIns };
}

export function AssistedCheckInPage() {
  const firebaseReady = isFirebaseConfigured();
  const [useDemoMode, setUseDemoMode] = useState<boolean>(!firebaseReady);

  const [campusId, setCampusId] = useState<string>(DEMO_CAMPUS_ID);
  const [drillId, setDrillId] = useState<string>('active-drill');
  const [teacherUid, setTeacherUid] = useState<string>(DEMO_TEACHER_UID);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Peer check-in modal state
  const [isPeerModalOpen, setIsPeerModalOpen] = useState<boolean>(false);
  const [peerSearchQuery, setPeerSearchQuery] = useState<string>('');

  // Live Firestore state
  const [liveUsers, setLiveUsers] = useState<User[]>([]);
  const [liveNodes, setLiveNodes] = useState<MapNode[]>([]);
  const [liveCheckIns, setLiveCheckIns] = useState<CheckIn[]>([]);

  // Demo state
  const initialDemo = useMemo(() => createDemoRoster(), []);
  const [demoCheckIns, setDemoCheckIns] = useState<CheckIn[]>(
    initialDemo.initialCheckIns,
  );
  const demoStore = useMemo(
    () =>
      createMemoryCheckInStore(initialDemo.initialCheckIns, {
        onChange: (all) => setDemoCheckIns(all),
      }),
    [initialDemo.initialCheckIns],
  );

  // Subscribe to Firestore when in Live mode
  useEffect(() => {
    if (useDemoMode) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users')),
        (snap) => {
          setLiveUsers(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<User, 'uid'>),
              uid: d.id,
            })),
          );
        },
        (err) => setActionError(err.message),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'campuses', campusId, 'mapNodes')),
        (snap) => {
          setLiveNodes(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<MapNode, 'id'>),
              id: d.id,
            })),
          );
        },
      ),
    );

    unsubs.push(
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
        (err) => setActionError(err.message),
      ),
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [useDemoMode, campusId, drillId]);

  const activeCampusId = useDemoMode ? DEMO_CAMPUS_ID : campusId;
  const activeDrillId = useDemoMode ? DEMO_DRILL_ID : drillId;
  const activeUsers = useDemoMode ? initialDemo.users : liveUsers;
  const activeNodes = useDemoMode ? initialDemo.mapNodes : liveNodes;
  const activeCheckIns = useDemoMode ? demoCheckIns : liveCheckIns;

  const defaultAssemblyNodeId = useMemo(
    () => activeNodes.find((n) => n.type === 'assembly')?.id ?? 'assembly-b',
    [activeNodes],
  );

  const checkInByStudent = useMemo(() => {
    const map = new Map<string, CheckIn>();
    for (const c of activeCheckIns) {
      map.set(c.studentUid, c);
    }
    return map;
  }, [activeCheckIns]);

  const createServiceForActor = (actorUid: string) => {
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
  };

  const teacherService = useMemo(
    () => createServiceForActor(teacherUid),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useDemoMode, activeDrillId, activeCampusId, activeNodes, teacherUid, defaultAssemblyNodeId, demoStore],
  );

  const peerService = useMemo(
    () => createServiceForActor(DEMO_PEER_UID),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useDemoMode, activeDrillId, activeCampusId, activeNodes, defaultAssemblyNodeId, demoStore],
  );

  const students = useMemo(
    () =>
      activeUsers.filter((u) => u.role === 'student' && u.active !== false),
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

  const handleMarkPresent = async (student: User) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await teacherService.markPresent(student.uid);
      setActionNotice(`${student.displayName} marked present (Teacher).`);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to mark present.',
      );
    }
  };

  const handleConfirmPeer = async (student: User) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await teacherService.verify(student.uid);
      setActionNotice(`Verified peer check-in for ${student.displayName}.`);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to verify peer check-in.',
      );
    }
  };

  const handleRejectPeer = async (student: User) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await teacherService.rejectPeerCheckIn(student.uid);
      setActionNotice(
        `Rejected peer check-in for ${student.displayName}; returned to Unaccounted.`,
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reject peer check-in.',
      );
    }
  };

  const handleSubmitPeerCheckIn = async (student: User) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await peerService.peerCheckIn(student.uid);
      setIsPeerModalOpen(false);
      setPeerSearchQuery('');
      setActionNotice(
        `Peer check-in submitted for ${student.displayName} (Pending teacher verification).`,
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to submit peer check-in.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row font-sans">
      <SidebarNav activePath="/assisted-check-in" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
              Assisted Check-In
            </h1>
            <p className="text-sm font-medium text-slate-700 mt-1">
              Mark students without phones present or verify peer check-ins
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setActionNotice(null);
              setUseDemoMode((v) => !v);
            }}
            className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border-2 border-slate-800 bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 cursor-pointer self-start sm:self-auto"
          >
            {useDemoMode
              ? 'Mode: Demo (Switch to Live)'
              : 'Mode: Live Firestore (Switch to Demo)'}
          </button>
        </header>

        {!useDemoMode && (
          <section
            aria-label="Live Firestore context"
            className="bg-white border-2 border-slate-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
              <span>Campus ID</span>
              <input
                type="text"
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="min-h-[48px] px-3 rounded-lg border border-slate-400 text-sm font-mono text-slate-950"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
              <span>Drill ID</span>
              <input
                type="text"
                value={drillId}
                onChange={(e) => setDrillId(e.target.value)}
                className="min-h-[48px] px-3 rounded-lg border border-slate-400 text-sm font-mono text-slate-950"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
              <span>Teacher UID</span>
              <input
                type="text"
                value={teacherUid}
                onChange={(e) => setTeacherUid(e.target.value)}
                className="min-h-[48px] px-3 rounded-lg border border-slate-400 text-sm font-mono text-slate-950"
              />
            </label>
          </section>
        )}

        {/* Search Input (matches SDD Figure 40 wireframe) */}
        <section aria-label="Search campus roster" className="space-y-2">
          <label
            htmlFor="assisted-search"
            className="block text-sm font-bold text-slate-900"
          >
            Search student name or number
          </label>
          <input
            id="assisted-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. Cy Tan or 2023-0101"
            className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-400 bg-white text-slate-950 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-slate-400"
          />
        </section>

        {actionNotice && (
          <div
            role="status"
            className="bg-emerald-50 border-2 border-emerald-700 text-emerald-950 rounded-xl px-4 py-3 text-sm font-bold"
          >
            {actionNotice}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="bg-red-50 border-2 border-red-700 text-red-950 rounded-xl px-4 py-3 text-sm font-bold"
          >
            {actionError}
          </div>
        )}

        {/* Roster Table (matches SDD Figure 40 wireframe) */}
        <section
          aria-label="Student check-in status table"
          className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-950">
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Name
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Status
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-6 px-4 text-center text-sm font-medium text-slate-700"
                    >
                      No matching students found in campus roster.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const checkIn = checkInByStudent.get(student.uid);
                    const verified = isVerifiedCheckIn(checkIn);
                    const isPendingPeer = Boolean(
                      checkIn && checkIn.method === 'peer' && !verified,
                    );

                    return (
                      <tr key={student.uid} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-bold text-slate-950">
                            {student.displayName}
                          </p>
                          {student.studentNumber && (
                            <p className="text-xs font-medium text-slate-700">
                              {student.studentNumber}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-bold">
                          {verified ? (
                            <span className="inline-block px-2.5 py-1 rounded bg-emerald-100 text-emerald-950 border border-emerald-700 text-xs font-extrabold">
                              Accounted ({checkIn?.method})
                            </span>
                          ) : isPendingPeer ? (
                            <span className="inline-block px-2.5 py-1 rounded bg-amber-100 text-amber-950 border border-amber-700 text-xs font-extrabold">
                              Pending (peer)
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-1 rounded bg-red-100 text-red-950 border border-red-700 text-xs font-extrabold">
                              Unaccounted
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {!checkIn ? (
                            <button
                              type="button"
                              onClick={() => void handleMarkPresent(student)}
                              className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 cursor-pointer"
                            >
                              Mark present
                            </button>
                          ) : isPendingPeer ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleConfirmPeer(student)}
                                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-emerald-800 text-white font-bold text-sm hover:bg-emerald-900 cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRejectPeer(student)}
                                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-800 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-700">
                              Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Check in a classmate CTA (matches SDD Figure 40 wireframe) */}
        <button
          type="button"
          onClick={() => setIsPeerModalOpen(true)}
          className="w-full min-h-[56px] px-6 py-3 rounded-xl bg-slate-900 text-white font-extrabold text-base hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-400 cursor-pointer"
        >
          Check in a classmate
        </button>

        {/* Peer Check-In Modal */}
        {isPeerModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="peer-modal-title"
            className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          >
            <div className="bg-white border-2 border-slate-400 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="peer-modal-title"
                  className="text-xl font-extrabold text-slate-950"
                >
                  Check in a classmate
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPeerModalOpen(false)}
                  className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border-2 border-slate-400 text-slate-950 font-bold text-sm hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <p className="text-sm font-medium text-slate-700">
                Peer check-ins are saved as Pending until verified by a teacher.
              </p>

              <input
                type="search"
                value={peerSearchQuery}
                onChange={(e) => setPeerSearchQuery(e.target.value)}
                placeholder="Search classmate name or number"
                aria-label="Search classmate name or number"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-400 text-slate-950 text-sm font-semibold"
              />

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 border border-slate-300 rounded-xl">
                {peerCandidateStudents.length === 0 ? (
                  <p className="p-4 text-sm font-medium text-slate-700 text-center">
                    No unaccounted classmates match your search.
                  </p>
                ) : (
                  peerCandidateStudents.map((student) => (
                    <div
                      key={student.uid}
                      className="p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          {student.displayName}
                        </p>
                        {student.studentNumber && (
                          <p className="text-xs font-medium text-slate-700">
                            {student.studentNumber}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSubmitPeerCheckIn(student)}
                        className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 cursor-pointer"
                      >
                        Submit Peer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AssistedCheckInPage;
