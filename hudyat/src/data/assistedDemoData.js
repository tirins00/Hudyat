import { Timestamp } from 'firebase/firestore';

export const DEMO_ASSISTED_CAMPUS_ID = 'citu-main';
export const DEMO_ASSISTED_DRILL_ID = 'demo-drill-2026-12-03';
export const DEMO_ASSISTED_TEACHER_UID = 'teacher-1';
export const DEMO_ASSISTED_PEER_UID = 'stu-ana-cruz';

export function createDemoRoster() {
  const createdAt = Timestamp.fromMillis(1_700_000_000_000);
  const users = [
    {
      uid: 'stu-cy-tan',
      email: 'cytan@cit.edu',
      displayName: 'Cy Tan',
      role: 'student',
      campusId: DEMO_ASSISTED_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0101',
      createdAt,
    },
    {
      uid: 'stu-di-uy',
      email: 'diuy@cit.edu',
      displayName: 'Di Uy',
      role: 'student',
      campusId: DEMO_ASSISTED_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0102',
      createdAt,
    },
    {
      uid: 'stu-ana-cruz',
      email: 'anacruz@cit.edu',
      displayName: 'Ana Cruz',
      role: 'student',
      campusId: DEMO_ASSISTED_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0012',
      createdAt,
    },
    {
      uid: 'stu-ben-lim',
      email: 'benlim@cit.edu',
      displayName: 'Ben Lim',
      role: 'student',
      campusId: DEMO_ASSISTED_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0045',
      createdAt,
    },
    {
      uid: 'stu-eva-go',
      email: 'evago@cit.edu',
      displayName: 'Eva Go',
      role: 'student',
      campusId: DEMO_ASSISTED_CAMPUS_ID,
      active: true,
      studentNumber: '2023-0188',
      createdAt,
    },
  ];

  const mapNodes = [
    {
      id: 'assembly-b',
      campusId: DEMO_ASSISTED_CAMPUS_ID,
      buildingId: null,
      floor: 1,
      label: 'Assembly Area B',
      type: 'assembly',
      x: 420,
      y: 320,
      qrCode: 'hudyat://citu-main/assembly-b',
    },
  ];

  const initialCheckIns = [
    {
      studentUid: 'stu-di-uy',
      drillId: DEMO_ASSISTED_DRILL_ID,
      method: 'peer',
      assemblyNodeId: 'assembly-b',
      checkedInBy: DEMO_ASSISTED_PEER_UID,
      byUid: DEMO_ASSISTED_PEER_UID,
      verifiedBy: null,
      checkedInAt: Timestamp.fromMillis(Date.now() - 90_000),
    },
    {
      studentUid: 'stu-ana-cruz',
      drillId: DEMO_ASSISTED_DRILL_ID,
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
