import { NODE_TYPES } from '../../types/models.js';
import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Responsive grid of printable campus QR poster cards.
 */
export default function QrSheetCardGrid({
  nodes,
  selectedIds,
  qrDataUrls,
  onToggleSelection,
  onDownloadPng,
}) {
  return (
    <section
      aria-label="Printable QR cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-5"
    >
      {nodes.map((node) => {
        const isIncluded = !selectedIds || selectedIds.has(node.id);
        const isAssembly = node.type === NODE_TYPES.ASSEMBLY;
        const qrUrl = qrDataUrls[node.id];

        return (
          <article
            key={node.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm flex flex-col justify-between break-inside-avoid ${
              isIncluded
                ? isAssembly
                  ? 'border-emerald-400'
                  : 'border-slate-300'
                : 'border-slate-200 opacity-50 print:hidden'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    {isAssembly
                      ? 'HUDYAT ASSEMBLY CHECK-IN'
                      : 'HUDYAT LOCATION TAG'}
                  </p>
                  <h2 className="mt-0.5 text-lg font-extrabold text-slate-950 leading-tight">
                    {node.label}
                  </h2>
                </div>
                <StatusBadge status={isAssembly ? 'safe' : 'idle'}>
                  {node.type}
                </StatusBadge>
              </div>

              <div className="my-3 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={`QR code for ${node.label}: ${node.qrPayload}`}
                    className="h-48 w-48 object-contain"
                  />
                ) : (
                  <div className="h-48 w-48 flex items-center justify-center text-xs font-bold text-slate-600">
                    Rendering QR…
                  </div>
                )}
              </div>

              <p className="text-xs font-bold text-slate-700">
                ID:{' '}
                <span className="font-extrabold text-slate-950">{node.id}</span>
                {node.buildingId ? ` · Bldg ${node.buildingId}` : ' · Grounds'}
                {typeof node.floor === 'number' ? ` · Floor ${node.floor}` : ''}
              </p>
              <p className="mt-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-950 break-all">
                {node.qrPayload}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2 print:hidden">
              <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIncluded}
                  onChange={() => onToggleSelection(node.id)}
                  className="h-5 w-5 rounded border-slate-900 accent-slate-950"
                />
                Include in print
              </label>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onDownloadPng(node)}
                disabled={!qrUrl}
              >
                Download PNG
              </Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
