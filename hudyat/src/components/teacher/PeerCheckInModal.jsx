import Button from '../ui/Button.jsx';

/**
 * Modal dialog allowing a student or staff member to submit a peer check-in
 * for an unaccounted classmate.
 */
export default function PeerCheckInModal({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  candidates,
  onSubmitPeer,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="peer-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="peer-modal-title"
            className="text-xl font-extrabold text-slate-950"
          >
            Check in a classmate
          </h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <p className="text-sm font-medium text-slate-700">
          Peer check-ins are saved as Pending until verified by a teacher.
        </p>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search classmate name or number"
          aria-label="Search classmate name or number"
          className="w-full min-h-12 px-4 rounded-xl border border-slate-300 text-slate-950 text-sm font-semibold focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {candidates.length === 0 ? (
            <p className="p-4 text-sm font-medium text-slate-700 text-center">
              No unaccounted classmates match your search.
            </p>
          ) : (
            candidates.map((student) => (
              <div
                key={student.uid}
                className="p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-950 truncate">
                    {student.displayName}
                  </p>
                  {student.studentNumber && (
                    <p className="text-xs font-medium text-slate-600">
                      {student.studentNumber}
                    </p>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onSubmitPeer(student)}
                >
                  Submit Peer
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
