import SosSheet from '../SosSheet.jsx';

/**
 * Modal overlay wrapping SosSheet for quick SOS submission from CheckInScreen.
 */
export default function SosModalDialog({
  open,
  drillId,
  studentUid,
  studentName,
  useDemoMode,
  onClose,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send SOS"
      className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg my-auto">
        <SosSheet
          drillId={drillId}
          studentUid={studentUid}
          studentName={studentName}
          useDemoMode={useDemoMode}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
