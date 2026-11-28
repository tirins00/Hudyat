import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Reusable camera QR code scanner based on Dev 3's Html5Qrcode implementation.
 * Uses rear camera (`facingMode: 'environment'`) and safely releases the stream on unmount.
 */
export default function QrCameraScanner({
  elementId = 'hudyat-step-qr-reader',
  onScan,
  disabled = false,
  idleHint = 'Point your camera at the Assembly Area QR code, then tap Start Camera Scan.',
}) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanning(false);
      return;
    }
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Ignore cleanup errors when stream is already stopped
    } finally {
      scannerRef.current = null;
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  async function startCamera() {
    if (disabled || scannerRef.current?.isScanning) {
      return;
    }

    setCameraError('');

    try {
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;
      setIsScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          void stopCamera().then(() => {
            if (typeof onScanRef.current === 'function') {
              onScanRef.current(decodedText);
            }
          });
        },
        () => {
          // Ignore per-frame decode misses while camera searches for a QR code
        },
      );
    } catch (err) {
      setIsScanning(false);
      scannerRef.current = null;
      setCameraError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Check camera permissions and try again.`
          : 'Camera unavailable. Check camera permissions and try again.',
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-dashed border-slate-400 bg-slate-100 p-4 flex flex-col items-center justify-center min-h-[240px]">
        <div
          id={elementId}
          className="w-full max-w-sm overflow-hidden rounded-lg"
        />
        {!isScanning && (
          <p className="mt-2 text-center text-sm font-semibold text-slate-700">
            {idleHint}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        {!isScanning ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void startCamera()}
            className="hudyat-btn hudyat-btn-primary"
          >
            Start Camera Scan
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stopCamera()}
            className="hudyat-btn hudyat-btn-danger"
          >
            Stop Camera
          </button>
        )}
      </div>

      {cameraError && (
        <p
          role="alert"
          className="rounded-lg border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
        >
          {cameraError}
        </p>
      )}
    </div>
  );
}
