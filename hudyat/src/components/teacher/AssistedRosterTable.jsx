import { isVerifiedCheckIn } from '../../services/HeadcountService.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Student check-in status table for AssistedCheckInPage with teacher mark-present,
 * peer submission, and peer verification actions.
 */
export default function AssistedRosterTable({
  students,
  checkInByStudent,
  canVerifyOrMarkPresent,
  onMarkPresent,
  onSubmitPeerCheckIn,
  onConfirmPeer,
  onRejectPeer,
}) {
  return (
    <Card
      aria-label="Student check-in status table"
      padding="none"
      className="overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Name
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-6 px-4 text-center text-sm font-medium text-slate-700"
                >
                  No matching students found in campus roster.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const checkIn = checkInByStudent.get(student.uid);
                const verified = isVerifiedCheckIn(checkIn);
                const isPendingPeer = Boolean(
                  checkIn && checkIn.method === 'peer' && !verified,
                );

                return (
                  <tr key={student.uid} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <p className="text-sm font-bold text-slate-950">
                        {student.displayName}
                      </p>
                      {student.studentNumber && (
                        <p className="text-xs font-medium text-slate-600">
                          {student.studentNumber}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {verified ? (
                        <StatusBadge status="safe">
                          Accounted ({checkIn?.method})
                        </StatusBadge>
                      ) : isPendingPeer ? (
                        <StatusBadge status="pending">
                          Pending (peer)
                        </StatusBadge>
                      ) : (
                        <StatusBadge status="danger">Unaccounted</StatusBadge>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {!checkIn ? (
                        canVerifyOrMarkPresent ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void onMarkPresent(student)}
                          >
                            Mark present
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void onSubmitPeerCheckIn(student)}
                          >
                            Check in (Peer)
                          </Button>
                        )
                      ) : isPendingPeer ? (
                        canVerifyOrMarkPresent ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => void onConfirmPeer(student)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void onRejectPeer(student)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-amber-900">
                            Awaiting teacher verification
                          </span>
                        )
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">
                          Verified
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
