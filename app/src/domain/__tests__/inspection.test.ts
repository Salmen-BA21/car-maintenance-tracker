import { isInspectionDue } from '../inspection';

describe('isInspectionDue (BR-08, D-52)', () => {
  const base = { inspectionMonths: 3, lastInspectionDate: null, lastServiceDate: null, createdDate: null };

  test('created today → not due', () => {
    expect(isInspectionDue({ ...base, createdDate: '2026-11-02' }, '2026-11-02')).toBe(false);
    expect(isInspectionDue({ ...base, createdDate: '2026-08-02' }, '2026-11-02')).toBe(true);
  });

  test('anchor is the latest of inspection, service and creation (D-52)', () => {
    // A replacement on 2026-10-01 resets a 3-month cycle started on creation 2026-01-01.
    expect(isInspectionDue({ ...base, createdDate: '2026-01-01', lastServiceDate: '2026-10-01' }, '2026-11-02')).toBe(false);
    // An explicit inspection before the service is ignored by the anchor.
    expect(isInspectionDue({ ...base, lastInspectionDate: '2026-05-01', lastServiceDate: '2026-10-01' }, '2026-11-02')).toBe(false);
  });

  test('all anchors null → not due', () => {
    expect(isInspectionDue(base, '2026-11-02')).toBe(false);
  });

  test('calendar-month clamping at period end', () => {
    // 1-month cycle anchored on 31 Jan is due on 28/29 Feb.
    expect(isInspectionDue({ inspectionMonths: 1, lastInspectionDate: null, lastServiceDate: '2026-01-31', createdDate: null }, '2026-02-27')).toBe(false);
    expect(isInspectionDue({ inspectionMonths: 1, lastInspectionDate: null, lastServiceDate: '2026-01-31', createdDate: null }, '2026-02-28')).toBe(true);
  });
});
