import Card from '../ui/Card.jsx';

/**
 * Search bar card for filtering campus students on AssistedCheckInPage.
 */
export default function AssistedSearchCard({ value, onChange }) {
  return (
    <Card
      aria-label="Search campus roster"
      padding="compact"
      className="space-y-2"
    >
      <label
        htmlFor="assisted-search"
        className="block text-xs font-extrabold uppercase tracking-wider text-slate-700"
      >
        Search student name or number
      </label>
      <input
        id="assisted-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Cy Tan or 2023-0101"
        className="w-full min-h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-950 text-sm font-semibold focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
      />
    </Card>
  );
}
