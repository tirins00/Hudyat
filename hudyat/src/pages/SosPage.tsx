import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { SosSheet } from '../components/SosSheet';
import { useHudyatSession } from '../routes/useHudyatSession';

const DEMO_DRILL_ID = 'demo-drill-2026-12-03';
const DEMO_STUDENT_UID = 'stu-ben-lim';

export function SosPage() {
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
  const [manualStudentUid, setManualStudentUid] = useState<string>('');

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
        <button
          type="button"
          onClick={() => setDemoOverride(!useDemoMode)}
          className="hudyat-btn hudyat-btn-primary"
        >
          {useDemoMode
            ? 'Mode: Demo (Switch to Live)'
            : 'Mode: Live Firestore (Switch to Demo)'}
        </button>
      }
    >
      <div className="space-y-6">

        {!useDemoMode && (
          <section
            aria-label="Live Firestore context"
            className="bg-white border-2 border-slate-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
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

        <SosSheet
          drillId={useDemoMode ? DEMO_DRILL_ID : drillId}
          studentUid={studentUid}
          studentName={studentName}
          useDemoMode={useDemoMode}
        />
      </div>
    </AppShell>
  );
}

export default SosPage;
