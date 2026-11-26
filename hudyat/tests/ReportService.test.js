import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/firebase/config.js', () => ({
  app: {},
  auth: {},
  db: {},
}));

import { CHECKIN_METHODS } from '../src/types/models.js';
import {
  SAMPLE_DEMO_DRILL_INPUT,
  computeDrillReport,
  formatCheckInsCsv,
  formatDrillSummaryCsv,
  formatDuration,
  toMillis,
} from '../src/services/ReportService.js';

describe('ReportService', () => {
  it('computes accurate KPIs, timings, section breakdown, SOS metrics, and compliance on sample drill', () => {
    const report = computeDrillReport(SAMPLE_DEMO_DRILL_INPUT);

    expect(report.kpis.expectedCount).toBe(6);
    expect(report.kpis.checkedInCount).toBe(5);
    expect(report.kpis.unaccountedCount).toBe(1);
    expect(report.kpis.accountedRate).toBe(83.3);
    expect(report.kpis.drillDurationSec).toBe(330);
    expect(report.kpis.dchDurationSec).toBe(60);
    expect(report.kpis.evacuationDurationSec).toBe(270);
    expect(report.kpis.fastestCheckInSec).toBe(78);
    expect(report.kpis.slowestCheckInSec).toBe(140);
    expect(report.kpis.sosTotal).toBe(1);
    expect(report.kpis.sosResolved).toBe(1);
    expect(report.kpis.sosActive).toBe(0);

    // Check-in method breakdown: 3 QR, 1 Teacher, 1 Peer
    const qrRow = report.methodBreakdown.find(
      (m) => m.method === CHECKIN_METHODS.QR,
    );
    const teacherRow = report.methodBreakdown.find(
      (m) => m.method === CHECKIN_METHODS.TEACHER,
    );
    const peerRow = report.methodBreakdown.find(
      (m) => m.method === CHECKIN_METHODS.PEER,
    );
    expect(qrRow.count).toBe(3);
    expect(teacherRow.count).toBe(1);
    expect(peerRow.count).toBe(1);

    // Sections: BSIT-3A (3/3 = 100%) and BSIT-3B (2/3 = 66.7%)
    expect(report.sectionBreakdown).toHaveLength(2);
    expect(report.sectionBreakdown[0].sectionName).toBe('BSIT-3A');
    expect(report.sectionBreakdown[0].rate).toBe(100);
    expect(report.sectionBreakdown[1].sectionName).toBe('BSIT-3B');
    expect(report.sectionBreakdown[1].unaccounted).toBe(1);

    // Unaccounted student list
    expect(report.unaccountedStudents).toHaveLength(1);
    expect(report.unaccountedStudents[0].displayName).toBe('Rafael Luis Gomez');

    // SOS timings: created 09:02:10, ack 09:02:35 (+25s), resolved 09:04:40 (+150s)
    expect(report.sosIncidents[0].responseTimeSec).toBe(25);
    expect(report.sosIncidents[0].resolutionTimeSec).toBe(150);

    // Safety compliance
    expect(report.safetyCompliance.passed).toBe(true);
    expect(report.safetyCompliance.violations).toEqual([]);
  });

  it('deduplicates check-ins by studentUid and tracks unplanned walk-ins', () => {
    const report = computeDrillReport({
      drill: { id: 'd1', title: 'Test Drill' },
      expectedEntries: [
        { studentUid: 's1', displayName: 'Student One', sectionId: 'sec1' },
      ],
      checkIns: [
        {
          studentUid: 's1',
          method: CHECKIN_METHODS.QR,
          assemblyNodeId: 'ASM-QUAD',
        },
        // Duplicate check-in for s1 should overwrite rather than double count
        {
          studentUid: 's1',
          method: CHECKIN_METHODS.QR,
          assemblyNodeId: 'ASM-QUAD',
        },
        // Unplanned walk-in student
        {
          studentUid: 'walkin-1',
          method: CHECKIN_METHODS.PEER,
          assemblyNodeId: 'ASM-QUAD',
        },
      ],
    });

    expect(report.kpis.expectedCount).toBe(1);
    expect(report.kpis.checkedInCount).toBe(1);
    expect(report.kpis.unplannedCheckInsCount).toBe(1);
    expect(report.kpis.totalCheckInsCount).toBe(2);
    expect(report.kpis.accountedRate).toBe(100);
  });

  it('flags sound-only alerts and >= 3 Hz flashing alerts in safetyCompliance', () => {
    const report = computeDrillReport({
      drill: { id: 'd-unsafe', title: 'Unsafe Alert Test' },
      alerts: [
        {
          id: 'a-sound',
          title: 'Siren Only',
          visualCue: false,
          hapticCue: false,
          flashHz: 1,
        },
        {
          id: 'a-strobe',
          title: 'Fast Strobe',
          visualCue: true,
          hapticCue: true,
          flashHz: 4,
        },
      ],
    });

    expect(report.safetyCompliance.passed).toBe(false);
    expect(report.safetyCompliance.violations).toHaveLength(2);
  });

  it('handles empty drill data without NaN or division-by-zero errors', () => {
    const report = computeDrillReport({ drill: { id: 'empty' } });
    expect(report.kpis.expectedCount).toBe(0);
    expect(report.kpis.accountedRate).toBe(0);
    expect(report.kpis.avgCheckInTimeSec).toBeNull();
    expect(report.kpis.drillDurationSec).toBeNull();
  });

  it('converts Firestore-like timestamps and formats durations cleanly', () => {
    const fakeTimestamp = { toMillis: () => 1700000000000 };
    expect(toMillis(fakeTimestamp)).toBe(1700000000000);
    expect(toMillis({ seconds: 100, nanoseconds: 500000000 })).toBe(100500);
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 05s');
    expect(formatDuration(null)).toBe('—');
  });

  it('generates valid CSV exports for summary and per-student accountability', () => {
    const report = computeDrillReport(SAMPLE_DEMO_DRILL_INPUT);

    const summaryCsv = formatDrillSummaryCsv(report);
    expect(summaryCsv).toContain('HUDYAT DRILL SUMMARY REPORT');
    expect(summaryCsv).toContain('BSIT-3A');
    expect(summaryCsv).toContain('BSIT-3B');

    const studentCsv = formatCheckInsCsv(report);
    expect(studentCsv).toContain('Student UID,Name,Section');
    expect(studentCsv).toContain('Ana Marie Cruz');
    expect(studentCsv).toContain('Unaccounted');
  });
});
