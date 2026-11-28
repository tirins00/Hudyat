import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SosSheet from '../components/SosSheet.jsx';
import SosHeaderActions from '../components/student/SosHeaderActions.jsx';
import SosLiveContextCard from '../components/student/SosLiveContextCard.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import { useHudyatSession } from '../routes/useHudyatSession.js';

const DEMO_DRILL_ID = 'demo-drill-2026-12-03';
const DEMO_STUDENT_UID = 'stu-ben-lim';

export function SosPage() {
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
  const [manualStudentUid, setManualStudentUid] = useState('');

  const drillId = manualDrillId.trim() || campusActiveDrillId || 'active-drill';
  const studentUid =
    manualStudentUid.trim() || authUser?.uid || DEMO_STUDENT_UID;
  const studentName =
    authUser?.displayName ||
    authUser?.email ||
    (studentUid === DEMO_STUDENT_UID ? 'Ben Lim' : undefined);

  return (
    <AppShell
      title="SOS"
      subtitle="Send a silent emergency alert with your last known campus zone"
      maxWidth="max-w-3xl"
      actions={
        <SosHeaderActions
          useDemoMode={useDemoMode}
          onToggleMode={() => setDemoOverride(!useDemoMode)}
        />
      }
    >
      <PageStack gap="lg">
        {!useDemoMode && (
          <SosLiveContextCard
            drillIdValue={manualDrillId || campusActiveDrillId || ''}
            onDrillIdChange={setManualDrillId}
            studentUidValue={manualStudentUid || authUser?.uid || DEMO_STUDENT_UID}
            onStudentUidChange={setManualStudentUid}
          />
        )}

        <SosSheet
          drillId={useDemoMode ? DEMO_DRILL_ID : drillId}
          studentUid={studentUid}
          studentName={studentName}
          useDemoMode={useDemoMode}
        />
      </PageStack>
    </AppShell>
  );
}

export default SosPage;
