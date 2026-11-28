import { Timestamp } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';
import {
  CheckInService,
  createMemoryCheckInStore,
} from '../src/services/CheckInService.js';
import { isVerifiedCheckIn } from '../src/services/HeadcountService.js';
import { QrCodeError, QrCodeParser } from '../src/services/QrCodeParser.js';

const campusId = 'citu-main';
const drillId = 'drill-1';

const mapNodes = [
  {
    id: 'assembly-a',
    campusId,
    buildingId: null,
    floor: 1,
    label: 'Assembly Area A',
    type: 'assembly',
    x: 100,
    y: 300,
    qrCode: 'hudyat://citu-main/assembly-a',
  },
  {
    id: 'assembly-b',
    campusId,
    buildingId: null,
    floor: 1,
    label: 'Assembly Area B',
    type: 'assembly',
    x: 400,
    y: 300,
    qrCode: 'hudyat://citu-main/assembly-b',
  },
  {
    id: 'eng-401',
    campusId,
    buildingId: 'eng',
    floor: 4,
    label: 'ENG 401',
    type: 'room',
    x: 100,
    y: 100,
    qrCode: 'hudyat://citu-main/eng-401',
  },
  {
    id: 'other-assembly',
    campusId: 'other-campus',
    buildingId: null,
    floor: 1,
    label: 'Other Campus Area',
    type: 'assembly',
    x: 0,
    y: 0,
    qrCode: 'hudyat://other-campus/other-assembly',
  },
];

describe('QrCodeParser', () => {
  const parser = new QrCodeParser(campusId, mapNodes);

  it('resolves valid assembly and room QR codes on the campus', () => {
    const assemblyRef = parser.parseAssembly('hudyat://citu-main/assembly-b');
    expect(assemblyRef).toMatchObject({
      nodeId: 'assembly-b',
      campusId,
      label: 'Assembly Area B',
      type: 'assembly',
    });

    const roomRef = parser.parse('hudyat://citu-main/eng-401');
    expect(roomRef).toMatchObject({
      nodeId: 'eng-401',
      type: 'room',
    });

    const pipeRef = parser.parseAssembly('HUDYAT|citu-main|assembly|assembly-b');
    expect(pipeRef).toMatchObject({
      nodeId: 'assembly-b',
      campusId,
      type: 'assembly',
    });
  });

  it('rejects non-assembly nodes when used for assembly check-in', () => {
    expect(() => parser.parseAssembly('hudyat://citu-main/eng-401')).toThrow(
      QrCodeError,
    );
    expect(() => parser.parseAssembly('hudyat://citu-main/eng-401')).toThrow(
      /not an assembly area/i,
    );
  });

  it('rejects QR codes from another campus or unrecognized codes', () => {
    expect(() =>
      parser.parseAssembly('hudyat://other-campus/other-assembly'),
    ).toThrow(/another campus/i);

    expect(() => parser.parseAssembly('unknown-qr-code')).toThrow(
      /not recognized/i,
    );

    expect(() => parser.parseAssembly('   ')).toThrow(/empty qr code/i);
  });
});

describe('CheckInService', () => {
  const parser = new QrCodeParser(campusId, mapNodes);

  it('records verified QR check-in for any valid assembly area and ignores duplicates keeping original timestamp', async () => {
    const firstTs = Timestamp.fromMillis(1_700_000_100_000);
    const secondTs = Timestamp.fromMillis(1_700_000_250_000);
    let currentTs = firstTs;
    const onDuplicate = vi.fn();

    const store = createMemoryCheckInStore();
    const service = new CheckInService({
      drillId,
      actorUid: 's1',
      qrCodeParser: parser,
      store,
      now: () => currentTs,
      onDuplicate,
    });

    const first = await service.checkInQr('hudyat://citu-main/assembly-a');
    expect(first).toMatchObject({
      studentUid: 's1',
      drillId,
      method: 'qr',
      assemblyNodeId: 'assembly-a',
      checkedInBy: 's1',
      byUid: 's1',
      checkedInAt: firstTs,
    });
    expect(onDuplicate).not.toHaveBeenCalled();

    currentTs = secondTs;
    const duplicate = await service.checkInQr('hudyat://citu-main/assembly-b');
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(duplicate.assemblyNodeId).toBe('assembly-a');
    expect(duplicate.checkedInAt).toEqual(firstTs);
  });

  it('handles teacher markPresent as immediately verified with byUid and verifiedBy', async () => {
    const ts = Timestamp.fromMillis(1_700_000_150_000);
    const store = createMemoryCheckInStore();
    const teacherService = new CheckInService({
      drillId,
      actorUid: 'teacher-1',
      defaultAssemblyNodeId: 'assembly-b',
      qrCodeParser: parser,
      store,
      now: () => ts,
    });

    const checkIn = await teacherService.markPresent('stu-cy-tan');
    expect(checkIn).toMatchObject({
      studentUid: 'stu-cy-tan',
      method: 'teacher',
      assemblyNodeId: 'assembly-b',
      checkedInBy: 'teacher-1',
      byUid: 'teacher-1',
      verifiedBy: 'teacher-1',
      checkedInAt: ts,
    });
  });

  it('supports peer check-in pending -> verified flow', async () => {
    const ts = Timestamp.fromMillis(1_700_000_180_000);
    const store = createMemoryCheckInStore();

    const peerService = new CheckInService({
      drillId,
      actorUid: 'stu-peer',
      defaultAssemblyNodeId: 'assembly-b',
      qrCodeParser: parser,
      store,
      now: () => ts,
    });

    const teacherService = new CheckInService({
      drillId,
      actorUid: 'teacher-1',
      defaultAssemblyNodeId: 'assembly-b',
      qrCodeParser: parser,
      store,
    });

    const pending = await peerService.peerCheckIn('stu-di-uy');
    expect(pending).toMatchObject({
      studentUid: 'stu-di-uy',
      method: 'peer',
      checkedInBy: 'stu-peer',
      byUid: 'stu-peer',
      verifiedBy: null,
    });

    await teacherService.verify('stu-di-uy');
    const verified = await store.getCheckIn('stu-di-uy');
    expect(verified).toMatchObject({
      studentUid: 'stu-di-uy',
      method: 'peer',
      byUid: 'stu-peer',
      verifiedBy: 'teacher-1',
      checkedInAt: ts,
    });
  });

  it('rejects a pending peer check-in and returns the student to Unaccounted', async () => {
    const store = createMemoryCheckInStore();
    const peerService = new CheckInService({
      drillId,
      actorUid: 'stu-peer',
      defaultAssemblyNodeId: 'assembly-b',
      qrCodeParser: parser,
      store,
    });
    const teacherService = new CheckInService({
      drillId,
      actorUid: 'teacher-1',
      defaultAssemblyNodeId: 'assembly-b',
      qrCodeParser: parser,
      store,
    });

    await peerService.peerCheckIn('stu-di-uy');
    expect(await store.getCheckIn('stu-di-uy')).not.toBeNull();

    await teacherService.rejectPeerCheckIn('stu-di-uy');
    expect(await store.getCheckIn('stu-di-uy')).toBeNull();

    await peerService.checkInQr('hudyat://citu-main/assembly-b', 'stu-ana');
    await expect(teacherService.rejectPeerCheckIn('stu-ana')).rejects.toThrow(
      /only pending peer check-ins/i,
    );
  });

  it('records manual_code assembly check-ins idempotently and counts them as verified', async () => {
    const firstTs = Timestamp.fromMillis(1_700_000_250_000);
    const secondTs = Timestamp.fromMillis(1_700_000_300_000);
    let currentTs = firstTs;
    const onDuplicate = vi.fn();
    const store = createMemoryCheckInStore();
    const service = new CheckInService({
      drillId,
      actorUid: 'stu-manual',
      qrCodeParser: parser,
      store,
      now: () => currentTs,
      onDuplicate,
    });

    const created = await service.checkInManualCode(
      'HUDYAT|citu-main|assembly|assembly-a',
    );
    expect(created).toMatchObject({
      studentUid: 'stu-manual',
      drillId,
      method: 'manual_code',
      assemblyNodeId: 'assembly-a',
      checkedInBy: 'stu-manual',
      checkedInAt: firstTs,
    });
    expect(isVerifiedCheckIn(created)).toBe(true);

    await expect(
      service.checkInManualCode('HUDYAT|citu-main|room|eng-401'),
    ).rejects.toThrow(QrCodeError);

    currentTs = secondTs;
    const dup = await service.checkInManualCode(
      'HUDYAT|citu-main|assembly|assembly-b',
    );
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(dup.assemblyNodeId).toBe('assembly-a');
    expect(dup.checkedInAt).toEqual(firstTs);
  });
});
