import { NODE_TYPES } from '../../types/models.js';
import Card from '../ui/Card.jsx';

/**
 * Turn-by-turn evacuation step list for RouteScreen.
 */
export default function RouteStepsCard({ route }) {
  return (
    <Card
      title="Step-by-Step Directions"
      padding="compact"
      className="lg:col-span-5"
    >
      {route && route.reachable ? (
        <ol className="space-y-3">
          {route.steps.map((step) => (
            <li
              key={`${step.stepNumber}-${step.nodeId}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                  step.nodeType === NODE_TYPES.ASSEMBLY
                    ? 'bg-emerald-700'
                    : step.stepNumber === 1
                      ? 'bg-blue-700'
                      : step.isStair
                        ? 'bg-amber-700'
                        : 'bg-[#0F172A]'
                }`}
              >
                {step.stepNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-950">
                  {step.instruction}
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-600">
                  Node: {step.nodeId} · Type: {step.nodeType.toUpperCase()}
                  {step.weight > 0 ? ` · Leg weight: ${step.weight}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm font-medium text-slate-700">
          Select an unblocked starting node to view turn-by-turn evacuation
          steps.
        </p>
      )}
    </Card>
  );
}
