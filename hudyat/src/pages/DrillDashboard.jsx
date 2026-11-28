import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ActiveDrillStatusCard from '../components/coordinator/ActiveDrillStatusCard.jsx';
import DrillControlBar from '../components/coordinator/DrillControlBar.jsx';
import DrillHeaderActions from '../components/coordinator/DrillHeaderActions.jsx';
import DrillMetricsSummary from '../components/coordinator/DrillMetricsSummary.jsx';
import DrillPhaseTracker from '../components/coordinator/DrillPhaseTracker.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import PageGrid from '../components/ui/PageGrid.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import { useAuth } from '../routes/authContext.js';
import {
  DRILL_PHASE_ORDER,
  DrillService,
} from '../services/DrillService.js';
import { isVerifiedEvacuationResponse } from '../services/QrCodeParser.js';
import {
  DRILL_PHASES,
  DRILL_SCENARIOS,
  ROLES,
} from '../types/models.js';

const PHASE_LABELS = Object.freeze({
  [DRILL_PHASES.DCH]: 'Drop, Cover & Hold',
  [DRILL_PHASES.EVACUATE]: 'Evacuate',
  [DRILL_PHASES.ENDED]: 'Ended',
});

export default function DrillDashboard({ drillService = DrillService }) {
  const { user } = useAuth();
  const [drills, setDrills] = useState([]);
  const [selectedDrillId, setSelectedDrillId] = useState('');
  const [expectedEntries, setExpectedEntries] = useState([]);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [campusId, setCampusId] = useState(user?.campusId || 'cit-u');
  const [scenario, setScenario] = useState(DRILL_SCENARIOS.NORMAL);
  const [dchDurationSec, setDchDurationSec] = useState(60);

  useEffect(() => {
    const unsub = drillService.subscribeToDrills((list) => {
      setDrills(list);
      setSelectedDrillId((prev) => prev || list[0]?.id || '');
    });
    return unsub;
  }, [drillService]);

  const activeDrill =
    drills.find((d) => d.id === selectedDrillId) || drills[0] || null;

  useEffect(() => {
    if (!activeDrill?.id) {
      return;
    }
    const unsubExp = drillService.subscribeToExpectedEntries(
      activeDrill.id,
      setExpectedEntries,
    );
    const unsubResp = drillService.subscribeToResponses(
      activeDrill.id,
      setResponses,
    );
    return () => {
      unsubExp();
      unsubResp();
    };
  }, [drillService, activeDrill?.id]);

  const isCoordinator =
    user?.role === ROLES.COORDINATOR || user?.role === ROLES.ADMIN;

  async function runAction(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStartNewDrill(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Drill title is required.');
      return;
    }
    await runAction(async () => {
      const created = await drillService.startDrill({
        title: title.trim(),
        campusId: campusId.trim() || 'cit-u',
        scenario,
        dchDurationSec: Number(dchDurationSec) || 60,
        createdBy: user?.uid || 'coordinator',
      });
      setTitle('');
      setShowCreate(false);
      setSelectedDrillId(created.id);
    });
  }

  const currentIdx = activeDrill
    ? DRILL_PHASE_ORDER.indexOf(activeDrill.phase)
    : -1;
  const nextPhase =
    currentIdx >= 0 && currentIdx < DRILL_PHASE_ORDER.length - 1
      ? DRILL_PHASE_ORDER[currentIdx + 1]
      : null;

  const requiresQrVerification =
    activeDrill &&
    (activeDrill.phase === DRILL_PHASES.EVACUATE ||
      activeDrill.phase === DRILL_PHASES.ENDED);
  const countedResponses = requiresQrVerification
    ? responses.filter((r) =>
        isVerifiedEvacuationResponse(r, activeDrill.campusId || 'cit-u'),
      )
    : responses;

  const isLive =
    activeDrill?.phase === DRILL_PHASES.DCH ||
    activeDrill?.phase === DRILL_PHASES.EVACUATE;

  return (
    <AppShell
      title="Drill Dashboard"
      subtitle="Start, advance, and monitor campus earthquake drills."
      actions={<DrillHeaderActions />}
    >
      <PageStack>
        <ErrorBanner message={error} />

        <DrillControlBar
          drills={drills}
          activeDrill={activeDrill}
          phaseLabels={PHASE_LABELS}
          onSelectDrill={setSelectedDrillId}
          isCoordinator={isCoordinator}
          showCreate={showCreate}
          onToggleCreate={() => setShowCreate((prev) => !prev)}
          nextPhase={nextPhase}
          busy={busy}
          onAdvancePhase={() =>
            runAction(() => drillService.advanceDrillPhase(activeDrill.id))
          }
          onEndDrill={() =>
            runAction(() => drillService.endDrill(activeDrill.id))
          }
          formProps={{
            title,
            onTitleChange: setTitle,
            campusId,
            onCampusIdChange: setCampusId,
            dchDurationSec,
            onDchDurationChange: setDchDurationSec,
            scenario,
            onScenarioChange: setScenario,
            onSubmit: handleStartNewDrill,
          }}
        />

        {activeDrill && (
          <PageStack>
            <ActiveDrillStatusCard
              drill={activeDrill}
              phaseLabel={PHASE_LABELS[activeDrill.phase] || activeDrill.phase}
              isLive={isLive}
              countedResponsesCount={countedResponses.length}
              expectedCount={expectedEntries.length}
              requiresQrVerification={Boolean(requiresQrVerification)}
            />

            <PageGrid cols={2}>
              <DrillPhaseTracker
                phaseOrder={DRILL_PHASE_ORDER}
                currentIdx={currentIdx}
                phaseLabels={PHASE_LABELS}
              />

              <DrillMetricsSummary
                expectedCount={expectedEntries.length}
                countedResponses={countedResponses}
                requiresQrVerification={Boolean(requiresQrVerification)}
              />
            </PageGrid>
          </PageStack>
        )}
      </PageStack>
    </AppShell>
  );
}
