/**
 * High-contrast green arrival confirmation banner for CheckInScreen.
 */
export default function CheckInArrivalBanner({ nodeLabel, arrivalTime }) {
  if (!nodeLabel || !arrivalTime) return null;

  return (
    <div
      role="status"
      className="bg-emerald-700 text-white border border-emerald-900 rounded-2xl px-5 py-4 text-center text-lg font-extrabold tracking-wide shadow-sm"
    >
      ARRIVED - {nodeLabel} - {arrivalTime}
    </div>
  );
}
