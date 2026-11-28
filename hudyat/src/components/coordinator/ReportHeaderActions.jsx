import Button from '../ui/Button.jsx';

/**
 * Header export & print actions for ReportPage.
 */
export default function ReportHeaderActions({
  onExportSummaryCsv,
  onExportCheckInsCsv,
  onPrint,
}) {
  return (
    <>
      <Button variant="secondary" onClick={onExportSummaryCsv}>
        Export Summary CSV
      </Button>
      <Button variant="secondary" onClick={onExportCheckInsCsv}>
        Export Student List CSV
      </Button>
      <Button variant="primary" onClick={onPrint}>
        Print / Save PDF
      </Button>
    </>
  );
}
