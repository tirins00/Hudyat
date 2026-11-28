import Button from '../ui/Button.jsx';

/**
 * Header actions bar for DrillDashboard.
 */
export default function DrillHeaderActions() {
  return (
    <>
      <Button to="/alert" variant="danger">
        Visual Alert Screen
      </Button>
      <Button to="/steps" variant="secondary">
        Step Confirmation
      </Button>
    </>
  );
}
