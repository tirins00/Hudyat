import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBanner from '../ui/StatusBanner.jsx';

/**
 * QR camera scanner viewport card for CheckInScreen.
 */
export default function CheckInCameraCard({
  readerElementId,
  isScanning,
  cameraError,
  onStartCamera,
  onStopCamera,
}) {
  return (
    <Card aria-label="QR camera scanner" className="space-y-4">
      <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center min-h-[260px]">
        <div
          id={readerElementId}
          className="w-full max-w-sm overflow-hidden rounded-lg"
        />
        {!isScanning && (
          <p className="text-sm font-semibold text-slate-700 mt-2 text-center">
            Camera view — tap Start Camera Scan or use the simulator below
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        {!isScanning ? (
          <Button variant="primary" onClick={() => void onStartCamera()}>
            Start Camera Scan
          </Button>
        ) : (
          <Button variant="danger" onClick={() => void onStopCamera()}>
            Stop Camera
          </Button>
        )}
      </div>

      <StatusBanner tone="warning" message={cameraError} />
    </Card>
  );
}
