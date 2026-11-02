import { computeStatus, type StatusInput } from '../status';

const base: StatusInput = { intervalType: 'both', distanceKm: 10_000, months: 12 };

describe('computeStatus precedence (BR-05, doc 07 §6.4)', () => {
  test('condition-based part is Inspect before anything else', () => {
    const r = computeStatus({ intervalType: 'condition', distanceKm: null, months: null }, { serviceKm: null, serviceDate: null }, 0, '2026-11-02');
    expect(r.status).toBe('Inspect');
  });

  test('Set interval before Unknown, Overdue and Due soon', () => {
    const r = computeStatus({ ...base, distanceKm: null }, { serviceKm: 0, serviceDate: '2020-01-01' }, 99_000, '2026-11-02');
    expect(r.status).toBe('SetInterval');
  });

  test('Unknown with no active record, and for missing anchors (BR-20)', () => {
    expect(computeStatus(base, null, 100_000, '2026-11-02').status).toBe('Unknown');
    // time-only part whose service date is unknown
    expect(
      computeStatus({ intervalType: 'time', distanceKm: null, months: 12 }, { serviceKm: 100, serviceDate: null }, 100_000, '2026-11-02').status,
    ).toBe('Unknown');
    // distance-only part whose service km is unknown
    expect(
      computeStatus({ intervalType: 'distance', distanceKm: 10_000, months: null }, { serviceKm: null, serviceDate: '2021-06-01' }, 50_000, '2026-11-02').status,
    ).toBe('Unknown');
  });

  test('AC-04: 12-month part serviced 2026-01-15 is Due soon on 2026-12-20 (26 days left)', () => {
    const r = computeStatus({ intervalType: 'time', distanceKm: null, months: 12 }, { serviceKm: 100, serviceDate: '2026-01-15' }, 100, '2026-12-20');
    expect(r.status).toBe('DueSoon');
    expect(r.remainingDays).toBe(26);
    expect(r.dueDate).toBe('2027-01-15');
  });

  test('AC-05: 6,000 km remaining (OK side) but 10 days past due is Overdue', () => {
    const r = computeStatus(
      { ...base, distanceKm: 40_000, months: 6 },
      { serviceKm: 10_000, serviceDate: '2026-05-01' },
      44_000, // 34,000 km since the record → 6,000 km remaining
      '2026-11-12', // due date 2026-11-01 → 11 days past
    );
    expect(r.status).toBe('Overdue');
    expect(r.remainingKm).toBe(6000);
  });

  test('time overdue wins even when the distance side still has room', () => {
    const r = computeStatus(
      { intervalType: 'both', distanceKm: 10_000, months: 1 },
      { serviceKm: 0, serviceDate: '2026-01-05' },
      500,
      '2026-02-10',
    );
    expect(dueDateIsClamped(r.dueDate)).toBe(true);
    expect(dueDateIsClamped(r.dueDate)).toBe(true);
    expect(r.status).toBe('Overdue');
  });

  test('a part replaced today is OK / not Due soon (D-22 motivation)', () => {
    const r = computeStatus(
      { intervalType: 'both', distanceKm: 10_000, months: 12 },
      { serviceKm: 100_000, serviceDate: '2026-11-02' },
      100_000,
      '2026-11-02',
    );
    expect(r.status).toBe('OK');
  });

  test('Due soon distance threshold: half the interval capped at 1,000 km (D-22)', () => {
    // I = 6,000 → threshold 1,000; 999 km left → Due soon. 6,000 − (9,001 − 4,000) = 999
    expect(
      computeStatus({ intervalType: 'distance', distanceKm: 6_000, months: null }, { serviceKm: 4_000, serviceDate: null }, 9_001, '2026-11-02').status,
    ).toBe('DueSoon');
    // 1,001 km left → OK
    expect(
      computeStatus({ intervalType: 'distance', distanceKm: 6_000, months: null }, { serviceKm: 4_000, serviceDate: null }, 8_999, '2026-11-02').status,
    ).toBe('OK');
  });

  test('Due soon time threshold: min(30, half the days between service and due) (D-53)', () => {
    // One-month interval serviced 2026-01-01 → due 2026-02-01, service→due = 31 days, threshold min(30, 15) = 15.
    const r = computeStatus({ intervalType: 'time', distanceKm: null, months: 1 }, { serviceKm: 0, serviceDate: '2026-01-01' }, 0, '2026-01-17');
    // 15 days left → threshold half of 31 days = 15; a 16th day would be OK
    expect(r.remainingDays).toBe(15);
    expect(r.status).toBe('DueSoon');
  });

  test('a both part with a known km but unknown date is judged on distance only (BR-20)', () => {
    const r = computeStatus(
      { intervalType: 'both', distanceKm: 10_000, months: 12 },
      { serviceKm: 100_000, serviceDate: null },
      111_000,
      '2026-11-02',
    );
    expect(r.remainingKm).toBe(-1_000);
    expect(r.status).toBe('Overdue');
    expect(r.dueDate).toBeNull();
  });
});

function dueDateIsClamped(d: string | null): boolean {
  return d === '2026-02-05'; // 2026-01-05 + 1 month; February never overflows
}
