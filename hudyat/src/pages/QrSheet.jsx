import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../routes/authContext.js';
import { NODE_TYPES } from '../types/models.js';
import { loadCampusBundle } from '../services/CampusRepository.js';
import { CIT_U_SEED_DATA } from '../services/CampusSeeder.js';
import { formatQrPayload } from '../services/QrCodeParser.js';
import AppShell from '../components/AppShell.jsx';

const FILTER_MODES = Object.freeze({
  ASSEMBLY: 'assembly',
  ROOMS: 'rooms',
  EXITS_STAIRS: 'exits_stairs',
  ALL: 'all',
});

function QrSheet() {
  const { user } = useAuth();
  const campusId = user?.campusId || 'cit-u';

  const [bundle, setBundle] = useState(null);
  const [isUsingSample, setIsUsingSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [filterMode, setFilterMode] = useState(FILTER_MODES.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(null); // null = all filtered included
  const [qrDataUrls, setQrDataUrls] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg('');
      try {
        const campusBundle = await loadCampusBundle(campusId);
        if (cancelled) return;

        if (campusBundle.mapNodes.length > 0) {
          setBundle(campusBundle);
          setIsUsingSample(false);
        } else {
          setBundle({
            campus: CIT_U_SEED_DATA.campus,
            buildings: CIT_U_SEED_DATA.buildings,
            mapNodes: CIT_U_SEED_DATA.mapNodes,
          });
          setIsUsingSample(true);
        }
      } catch (error) {
        console.error('Failed to load campus nodes for QR sheet:', error);
        if (!cancelled) {
          setErrorMsg(
            error instanceof Error
              ? error.message
              : 'Could not load campus nodes from Firestore. Showing CIT-U sample nodes.',
          );
          setBundle({
            campus: CIT_U_SEED_DATA.campus,
            buildings: CIT_U_SEED_DATA.buildings,
            mapNodes: CIT_U_SEED_DATA.mapNodes,
          });
          setIsUsingSample(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  const effectiveCampusId = bundle?.campus?.id || campusId;
  const allNodes = useMemo(
    () =>
      (bundle?.mapNodes || []).map((node) => ({
        ...node,
        qrPayload:
          node.qrCode ||
          formatQrPayload({
            campusId: effectiveCampusId,
            nodeType: node.type,
            nodeId: node.id,
          }),
      })),
    [bundle, effectiveCampusId],
  );

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allNodes.filter((node) => {
      if (filterMode === FILTER_MODES.ASSEMBLY && node.type !== NODE_TYPES.ASSEMBLY) {
        return false;
      }
      if (filterMode === FILTER_MODES.ROOMS && node.type !== NODE_TYPES.ROOM) {
        return false;
      }
      if (
        filterMode === FILTER_MODES.EXITS_STAIRS &&
        node.type !== NODE_TYPES.EXIT &&
        node.type !== NODE_TYPES.STAIR
      ) {
        return false;
      }
      if (q) {
        const hay = `${node.id} ${node.label} ${node.type} ${node.buildingId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allNodes, filterMode, searchQuery]);

  const printableNodes = useMemo(() => {
    if (!selectedIds) {
      return filteredNodes;
    }
    return filteredNodes.filter((n) => selectedIds.has(n.id));
  }, [filteredNodes, selectedIds]);

  useEffect(() => {
    let cancelled = false;

    async function generateAll() {
      const entries = await Promise.all(
        allNodes.map(async (node) => {
          try {
            const url = await QRCode.toDataURL(node.qrPayload, {
              width: 260,
              margin: 2,
              errorCorrectionLevel: 'M',
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            return [node.id, url];
          } catch (err) {
            console.error(`QR generation failed for ${node.id}:`, err);
            return [node.id, ''];
          }
        }),
      );

      if (!cancelled) {
        setQrDataUrls(Object.fromEntries(entries));
      }
    }

    if (allNodes.length > 0) {
      generateAll();
    }

    return () => {
      cancelled = true;
    };
  }, [allNodes]);

  function toggleNodeSelection(nodeId) {
    setSelectedIds((prev) => {
      const base = prev ? new Set(prev) : new Set(filteredNodes.map((n) => n.id));
      if (base.has(nodeId)) {
        base.delete(nodeId);
      } else {
        base.add(nodeId);
      }
      return base;
    });
  }

  function handleDownloadPng(node) {
    const dataUrl = qrDataUrls[node.id];
    if (!dataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `hudyat-qr-${node.id.toLowerCase()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return (
    <AppShell
      title="Assembly & Campus QR Sheets"
      subtitle="Generate and print standardized HUDYAT|<campusId>|<nodeType>|<nodeId> QR posters for assembly check-in and room location tagging."
      actions={
        <button
          type="button"
          onClick={() => window.print()}
          disabled={printableNodes.length === 0}
          className="min-h-12 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800 disabled:opacity-50"
        >
          Print / Save PDF ({printableNodes.length})
        </button>
      }
    >
      {isUsingSample && (
        <div
          role="status"
          className="mb-5 rounded-lg border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 print:hidden"
        >
          Previewing CIT-U sample campus QR codes (no map nodes found in
          Firestore yet).
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mb-5 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950 print:hidden"
        >
          {errorMsg}
        </div>
      )}

      {/* Filter Toolbar (hidden when printing) */}
      <section
        aria-label="QR sheet filters"
        className="mb-6 rounded-xl border-2 border-slate-900 bg-white p-4 space-y-4 print:hidden"
      >
        <div className="flex flex-wrap gap-2">
          {[
            { id: FILTER_MODES.ALL, label: 'All Nodes' },
            { id: FILTER_MODES.ASSEMBLY, label: 'Assembly Areas (Check-In)' },
            { id: FILTER_MODES.ROOMS, label: 'Rooms' },
            { id: FILTER_MODES.EXITS_STAIRS, label: 'Exits & Stairs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterMode(tab.id);
                setSelectedIds(null);
              }}
              aria-pressed={filterMode === tab.id}
              className={`min-h-12 rounded-lg border-2 px-4 py-2 text-sm font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800 ${
                filterMode === tab.id
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-700 bg-white text-slate-950 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex-1">
            <label htmlFor="qr-search" className="sr-only">
              Search map nodes
            </label>
            <input
              id="qr-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by node ID, label, building…"
              className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(null)}
              className="min-h-12 rounded-lg border-2 border-slate-900 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-200"
            >
              Select All ({filteredNodes.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-12 rounded-lg border-2 border-slate-700 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-200"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section
          role="status"
          className="rounded-xl border-2 border-slate-300 bg-white p-8 text-center"
        >
          <p className="text-base font-bold text-slate-800">
            Generating campus QR sheets…
          </p>
        </section>
      ) : filteredNodes.length === 0 ? (
        <section className="rounded-xl border-2 border-slate-400 bg-white p-8 text-center">
          <h2 className="text-lg font-extrabold text-slate-950">
            No matching nodes found
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Adjust your filter or add nodes in Campus Setup.
          </p>
        </section>
      ) : (
        <section
          aria-label="Printable QR cards"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-5"
        >
          {filteredNodes.map((node) => {
            const isIncluded = !selectedIds || selectedIds.has(node.id);
            const isAssembly = node.type === NODE_TYPES.ASSEMBLY;
            const qrUrl = qrDataUrls[node.id];

            return (
              <article
                key={node.id}
                className={`rounded-xl border-2 bg-white p-5 flex flex-col justify-between break-inside-avoid ${
                  isIncluded
                    ? isAssembly
                      ? 'border-emerald-900'
                      : 'border-slate-950'
                    : 'border-slate-300 opacity-50 print:hidden'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-700">
                        {isAssembly
                          ? 'HUDYAT ASSEMBLY CHECK-IN'
                          : 'HUDYAT LOCATION TAG'}
                      </p>
                      <h2 className="mt-0.5 text-lg font-extrabold text-slate-950 leading-tight">
                        {node.label}
                      </h2>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white ${
                        isAssembly ? 'bg-emerald-800' : 'bg-slate-900'
                      }`}
                    >
                      {node.type}
                    </span>
                  </div>

                  <div className="my-3 flex items-center justify-center rounded-lg border-2 border-slate-200 bg-white p-3">
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt={`QR code for ${node.label}: ${node.qrPayload}`}
                        className="h-48 w-48 object-contain"
                      />
                    ) : (
                      <div className="h-48 w-48 flex items-center justify-center text-xs font-bold text-slate-700">
                        Rendering QR…
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-800">
                    ID: <span className="font-extrabold text-slate-950">{node.id}</span>
                    {node.buildingId ? ` · Bldg ${node.buildingId}` : ' · Grounds'}
                    {typeof node.floor === 'number' ? ` · Floor ${node.floor}` : ''}
                  </p>
                  <p className="mt-1.5 rounded bg-slate-100 border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-950 break-all">
                    {node.qrPayload}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2 print:hidden">
                  <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isIncluded}
                      onChange={() => toggleNodeSelection(node.id)}
                      className="h-5 w-5 rounded border-2 border-slate-900"
                    />
                    Include in print
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDownloadPng(node)}
                    disabled={!qrUrl}
                    className="min-h-12 rounded-lg border-2 border-slate-950 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-50"
                  >
                    Download PNG
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}

export default QrSheet;
