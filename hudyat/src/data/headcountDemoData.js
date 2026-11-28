import { Timestamp } from 'firebase/firestore';

/**
 * Generates an interactive demo drill dataset for HeadcountBoard Demo Mode.
 */
export function createInitialDemoData(pastDeadline) {
  const nowMs = Date.now();
  const startedAt = Timestamp.fromMillis(nowMs - 8 * 60 * 1000);
  const evacuateAt = Timestamp.fromMillis(nowMs - 6 * 60 * 1000);
  const deadlineAt = Timestamp.fromMillis(
    pastDeadline ? nowMs - 60 * 1000 : nowMs + 3 * 60 * 1000,
  );

  const drill = {
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

  const users = [
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

  const sections = [
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

  const mapNodes = [
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

  const expectedEntries = [];
  const checkIns = [];
  const checkedInTime = Timestamp.fromMillis(nowMs - 2 * 60 * 1000);

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

  const responses = [
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
