export const DEMO_CHECKIN_CAMPUS_ID = 'citu-main';
export const DEMO_CHECKIN_DRILL_ID = 'demo-drill-2026-12-03';
export const DEMO_CHECKIN_STUDENT_UID = 'stu-ana-cruz';

export const DEMO_CHECKIN_MAP_NODES = Object.freeze([
  {
    id: 'assembly-b',
    campusId: DEMO_CHECKIN_CAMPUS_ID,
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
    campusId: DEMO_CHECKIN_CAMPUS_ID,
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
    campusId: DEMO_CHECKIN_CAMPUS_ID,
    buildingId: 'eng',
    floor: 4,
    label: 'ENG 401',
    type: 'room',
    x: 100,
    y: 100,
    qrCode: 'hudyat://citu-main/eng-401',
  },
]);
