import { addMonths, daysBetween, isLocalDate, maxLocalDate } from '../local-date';

describe('addMonths (D-30)', () => {
  test('clamps 31 Jan to the last day of February', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap year
  });

  test('plain months and years', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
  });

  test('day preserved when the target month is long enough', () => {
    expect(addMonths('2026-03-30', 1)).toBe('2026-04-30');
  });
});

describe('daysBetween', () => {
  test('positive, negative and zero, including across a leap day', () => {
    expect(daysBetween('2026-11-02', '2026-11-03')).toBe(1);
    expect(daysBetween('2026-11-03', '2026-11-02')).toBe(-1);
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(0);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('isLocalDate / maxLocalDate', () => {
  test('accepts only YYYY-MM-DD', () => {
    expect(isLocalDate('2026-11-02')).toBe(true);
    expect(isLocalDate('2026-1-2')).toBe(false);
    expect(isLocalDate('2026-11-02T10:00:00')).toBe(false);
  });

  test('maxLocalDate ignores nulls and returns null when all are null', () => {
    expect(maxLocalDate(null, '2020-05-05', '2025-01-01')).toBe('2025-01-01');
    expect(maxLocalDate(null, null)).toBeNull();
  });
});
