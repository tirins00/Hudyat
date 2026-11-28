import Button from '../ui/Button.jsx';

/**
 * Header quick-links for CampusSetupPage.
 */
export default function CampusSetupHeaderActions({ rolePrefix }) {
  return (
    <>
      <Button to={`${rolePrefix}/qr-sheet`} variant="secondary">
        Assembly QR Sheets
      </Button>
      <Button to={`${rolePrefix}/route`} variant="primary">
        Open Full Route Screen
      </Button>
    </>
  );
}
