import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import AppShell from '../components/AppShell.jsx';
import QrSheetCardGrid from '../components/admin/QrSheetCardGrid.jsx';
import QrSheetFilterToolbar from '../components/admin/QrSheetFilterToolbar.jsx';
import QrSheetHeaderActions from '../components/admin/QrSheetHeaderActions.jsx';
import EmptyStateCard from '../components/ui/EmptyStateCard.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import LoadingCard from '../components/ui/LoadingCard.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import StatusBanner from '../components/ui/StatusBanner.jsx';
import { useAuth } from '../routes/authContext.js';
import { loadCampusBundle } from '../services/CampusRepository.js';
import { CIT_U_SEED_DATA } from '../services/CampusSeeder.js';
import { formatQrPayload } from '../services/QrCodeParser.js';
import { NODE_TYPES } from '../types/models.js';

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
  const [selectedIds, setSelectedIds] = useState(null);
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
      if (
        filterMode === FILTER_MODES.ASSEMBLY &&
        node.type !== NODE_TYPES.ASSEMBLY
      ) {
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
        const hay =
          `${node.id} ${node.label} ${node.type} ${node.buildingId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allNodes, filterMode, searchQuery]);

  const printableNodes = useMemo(() => {
    if (!selectedIds) return filteredNodes;
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
        <QrSheetHeaderActions
          printableCount={printableNodes.length}
          onPrint={() => window.print()}
        />
      }
    >
      <PageStack gap="lg">
        {isUsingSample && (
          <StatusBanner
            tone="warning"
            className="print:hidden"
            message="Previewing CIT-U sample campus QR codes (no map nodes found in Firestore yet)."
          />
        )}

        <ErrorBanner message={errorMsg} className="print:hidden" />

        <QrSheetFilterToolbar
          filterModes={FILTER_MODES}
          filterMode={filterMode}
          onSelectFilterMode={(mode) => {
            setFilterMode(mode);
            setSelectedIds(null);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredCount={filteredNodes.length}
          onSelectAll={() => setSelectedIds(null)}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        {loading ? (
          <LoadingCard message="Generating campus QR sheets…" />
        ) : filteredNodes.length === 0 ? (
          <EmptyStateCard
            title="No matching nodes found"
            description="Adjust your filter or add nodes in Campus Setup."
          />
        ) : (
          <QrSheetCardGrid
            nodes={filteredNodes}
            selectedIds={selectedIds}
            qrDataUrls={qrDataUrls}
            onToggleSelection={toggleNodeSelection}
            onDownloadPng={handleDownloadPng}
          />
        )}
      </PageStack>
    </AppShell>
  );
}

export default QrSheet;
