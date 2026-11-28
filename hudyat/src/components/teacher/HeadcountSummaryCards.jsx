import StatCard from '../ui/StatCard.jsx';

/**
 * Top 4 headcount KPI summary cards (Expected, Accounted, Pending, Missing).
 */
export default function HeadcountSummaryCards({ totals }) {
  return (
    <section
      aria-label="Headcount summary"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <StatCard label="Expected" value={totals.expected} />

      <StatCard
        label="Accounted"
        value={totals.accounted}
        tone="success"
        helper={
          totals.late > 0 ? `Includes ${totals.late} late check-in` : undefined
        }
      />

      <StatCard label="Pending" value={totals.pending} tone="warning" />

      <StatCard label="Missing" value={totals.missing} tone="danger" />
    </section>
  );
}
