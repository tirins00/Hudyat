import { describe, expect, it } from 'vitest';
import {
  SAMPLE_ROSTER_CSV,
  SAMPLE_SCHEDULE_CSV,
  parseRosterCsv,
  parseScheduleCsv,
} from '../src/services/RosterImporter.js';

describe('RosterImporter', () => {
  describe('parseRosterCsv', () => {
    it('parses a valid roster CSV with zero errors', () => {
      const csv = [
        'studentNo,name,email,sectionName',
        '2024-00101,Ana Cruz,Ana.Cruz@cit.edu,BSIT-3A',
        '2024-00102,Ben Reyes,ben.reyes@cit.edu,BSIT-3B',
      ].join('\n');

      const { rows, errors } = parseRosterCsv(csv);

      expect(errors).toEqual([]);
      expect(rows).toEqual([
        {
          studentNo: '2024-00101',
          name: 'Ana Cruz',
          email: 'ana.cruz@cit.edu',
          sectionName: 'BSIT-3A',
        },
        {
          studentNo: '2024-00102',
          name: 'Ben Reyes',
          email: 'ben.reyes@cit.edu',
          sectionName: 'BSIT-3B',
        },
      ]);
    });

    it('reports missing required columns at row 1', () => {
      const csv = [
        'studentNo,name,email',
        '2024-00101,Ana Cruz,ana.cruz@cit.edu',
      ].join('\n');

      const { rows, errors } = parseRosterCsv(csv);

      expect(rows).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0].rowNumber).toBe(1);
      expect(errors[0].message).toContain('sectionName');
    });

    it('reports invalid email and missing field errors with exact row numbers', () => {
      const csv = [
        'studentNo,name,email,sectionName',
        '2024-00101,Ana Cruz,ana.cruz@cit.edu,BSIT-3A',
        '2024-00102,Ben Reyes,not-an-email,BSIT-3A',
        ',Missing No,missing.no@cit.edu,BSIT-3B',
        '2024-00104,No Section,no.section@cit.edu,',
      ].join('\n');

      const { rows, errors } = parseRosterCsv(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].studentNo).toBe('2024-00101');

      expect(errors).toHaveLength(3);
      expect(errors[0].rowNumber).toBe(3);
      expect(errors[0].message.toLowerCase()).toContain('email');
      expect(errors[1].rowNumber).toBe(4);
      expect(errors[1].message).toContain('studentNo');
      expect(errors[2].rowNumber).toBe(5);
      expect(errors[2].message).toContain('sectionName');
    });

    it('validates the built-in SAMPLE_ROSTER_CSV cleanly', () => {
      const { rows, errors } = parseRosterCsv(SAMPLE_ROSTER_CSV);
      expect(errors).toEqual([]);
      expect(rows.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('parseScheduleCsv', () => {
    it('parses a valid schedule CSV with zero errors', () => {
      const csv = [
        'sectionName,day,start,end,roomId',
        'BSIT-3A,MON,08:00,10:00,NGE-301',
        'BSIT-3B,sat,13:30,15:00,NGE-302',
      ].join('\n');

      const { rows, errors } = parseScheduleCsv(csv);

      expect(errors).toEqual([]);
      expect(rows).toEqual([
        {
          sectionName: 'BSIT-3A',
          day: 'MON',
          start: '08:00',
          end: '10:00',
          roomId: 'NGE-301',
        },
        {
          sectionName: 'BSIT-3B',
          day: 'SAT',
          start: '13:30',
          end: '15:00',
          roomId: 'NGE-302',
        },
      ]);
    });

    it('rejects invalid day values (e.g. SUN or MONDAY) with exact row numbers', () => {
      const csv = [
        'sectionName,day,start,end,roomId',
        'BSIT-3A,MON,08:00,10:00,NGE-301',
        'BSIT-3A,SUN,08:00,10:00,NGE-301',
        'BSIT-3B,MONDAY,09:00,11:00,NGE-302',
      ].join('\n');

      const { rows, errors } = parseScheduleCsv(csv);

      expect(rows).toHaveLength(1);
      expect(errors).toHaveLength(2);
      expect(errors[0].rowNumber).toBe(3);
      expect(errors[0].message).toContain('SUN');
      expect(errors[1].rowNumber).toBe(4);
      expect(errors[1].message).toContain('MONDAY');
    });

    it('rejects invalid time formats and start >= end with exact row numbers', () => {
      const csv = [
        'sectionName,day,start,end,roomId',
        'BSIT-3A,MON,8:00,10:00,NGE-301',
        'BSIT-3A,TUE,09:00,25:00,NGE-301',
        'BSIT-3B,WED,10:00,10:00,NGE-302',
        'BSIT-3B,THU,14:00,13:00,NGE-302',
      ].join('\n');

      const { rows, errors } = parseScheduleCsv(csv);

      expect(rows).toEqual([]);
      expect(errors).toHaveLength(4);

      expect(errors[0].rowNumber).toBe(2);
      expect(errors[0].message).toContain('start');

      expect(errors[1].rowNumber).toBe(3);
      expect(errors[1].message).toContain('end');

      expect(errors[2].rowNumber).toBe(4);
      expect(errors[2].message).toContain('earlier than end time');

      expect(errors[3].rowNumber).toBe(5);
      expect(errors[3].message).toContain('earlier than end time');
    });

    it('validates the built-in SAMPLE_SCHEDULE_CSV cleanly', () => {
      const { rows, errors } = parseScheduleCsv(SAMPLE_SCHEDULE_CSV);
      expect(errors).toEqual([]);
      expect(rows.length).toBeGreaterThanOrEqual(12);
    });
  });
});
