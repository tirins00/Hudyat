/**
 * Periodically checks (every 5 seconds by default) for expected students past `deadlineAt`
 * without a verified check-in and triggers `alertNearest` once per student.
 */
export class MissingMonitor {
  constructor(options) {
    const svc = options.service;
    this.getService = typeof svc === 'function' ? svc : () => svc;
    this.intervalMs = options.intervalMs ?? 5000;
    this.onError = options.onError;
    this.alertedStudentUids = new Set();
    this.inFlightStudentUids = new Set();
    this.timerId = null;
  }

  /**
   * Starts the 5-second missing-student check loop. Safe to call multiple times.
   */
  start() {
    if (this.timerId !== null) return;
    void this.checkNow();
    this.timerId = setInterval(() => {
      void this.checkNow();
    }, this.intervalMs);
  }

  /**
   * Stops the monitor interval.
   */
  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Clears the in-memory set of alerted students (e.g., when switching drills).
   */
  reset() {
    this.alertedStudentUids.clear();
    this.inFlightStudentUids.clear();
  }

  /**
   * Runs a single check against `HeadcountService.missing(now)` and dispatches alerts
   * for any missing student not yet alerted.
   */
  async checkNow(now = new Date()) {
    const service = this.getService();
    if (!service) return;

    const missingRows = service.missing(now);
    const pendingAlerts = [];

    for (const row of missingRows) {
      if (
        row.alertedTeacherUid !== null ||
        this.alertedStudentUids.has(row.studentUid) ||
        this.inFlightStudentUids.has(row.studentUid)
      ) {
        if (row.alertedTeacherUid !== null) {
          this.alertedStudentUids.add(row.studentUid);
        }
        continue;
      }

      this.inFlightStudentUids.add(row.studentUid);
      const task = Promise.resolve(service.alertNearest(row))
        .then(() => {
          this.alertedStudentUids.add(row.studentUid);
        })
        .catch((err) => {
          this.onError?.(err, row);
        })
        .finally(() => {
          this.inFlightStudentUids.delete(row.studentUid);
        });
      pendingAlerts.push(task);
    }

    if (pendingAlerts.length > 0) {
      await Promise.all(pendingAlerts);
    }
  }
}
