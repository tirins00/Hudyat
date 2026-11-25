import type { HeadcountService, MissingRow } from './HeadcountService';

export interface MissingMonitorOptions {
  /** Returns the current HeadcountService snapshot (or null when no drill is loaded). */
  service: HeadcountService | (() => HeadcountService | null);
  /** Polling interval in milliseconds. Defaults to 5,000 ms (SDD 5.3). */
  intervalMs?: number;
  /** Optional error callback if writing an alert fails. */
  onError?: (error: unknown, row: MissingRow) => void;
}

/**
 * Periodically checks (every 5 seconds by default) for expected students past `deadlineAt`
 * without a verified check-in and triggers `alertNearest` once per student.
 */
export class MissingMonitor {
  private readonly getService: () => HeadcountService | null;
  private readonly intervalMs: number;
  private readonly onError?: (error: unknown, row: MissingRow) => void;
  private readonly alertedStudentUids = new Set<string>();
  private readonly inFlightStudentUids = new Set<string>();
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(options: MissingMonitorOptions) {
    const svc = options.service;
    this.getService = typeof svc === 'function' ? svc : () => svc;
    this.intervalMs = options.intervalMs ?? 5000;
    this.onError = options.onError;
  }

  /**
   * Starts the 5-second missing-student check loop. Safe to call multiple times.
   */
  start(): void {
    if (this.timerId !== null) return;
    void this.checkNow();
    this.timerId = setInterval(() => {
      void this.checkNow();
    }, this.intervalMs);
  }

  /**
   * Stops the monitor interval.
   */
  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Clears the in-memory set of alerted students (e.g., when switching drills).
   */
  reset(): void {
    this.alertedStudentUids.clear();
    this.inFlightStudentUids.clear();
  }

  /**
   * Runs a single check against `HeadcountService.missing(now)` and dispatches alerts
   * for any missing student not yet alerted.
   */
  async checkNow(now: Date = new Date()): Promise<void> {
    const service = this.getService();
    if (!service) return;

    const missingRows = service.missing(now);
    const pendingAlerts: Promise<void>[] = [];

    for (const row of missingRows) {
      if (
        row.alertedTeacherUid !== null ||
        this.alertedStudentUids.has(row.studentUid) ||
        this.inFlightStudentUids.has(row.studentUid)
      ) {
        // Ensure pre-existing Firestore alerts are also recorded locally.
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
        .catch((err: unknown) => {
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
