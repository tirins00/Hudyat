import { NODE_TYPES } from '../../types/models.js';
import CampusMapSvg from '../CampusMapSvg.jsx';
import Card from '../ui/Card.jsx';

/**
 * Interactive indoor campus map card wrapping `<CampusMapSvg>`.
 */
export default function RouteMapCard({
  mapNodes,
  mapEdges,
  floorPlans,
  selectedFloor,
  route,
  startNodeId,
  blockedNodeIds,
  blockedEdgeIds,
  onSelectStartNode,
}) {
  return (
    <Card
      title="Indoor Campus Map"
      subtitle="Tip: Click any room or node to set as start location"
      padding="compact"
      className="lg:col-span-7"
    >
      <CampusMapSvg
        mapNodes={mapNodes}
        mapEdges={mapEdges}
        floorPlans={floorPlans}
        selectedFloor={selectedFloor}
        route={route}
        startNodeId={startNodeId}
        blockedNodeIds={blockedNodeIds}
        blockedEdgeIds={blockedEdgeIds}
        onNodeClick={(node) => {
          if (node.type !== NODE_TYPES.LIFT) {
            onSelectStartNode(node.id);
          }
        }}
      />
    </Card>
  );
}
