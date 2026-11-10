import type { DashboardPart } from '../../data/repositories/car-repository';
import { partDetailLine, partProgress, summaryCounts } from '../part-view';

function part(overrides: Partial<DashboardPart> = {}): DashboardPart {
  return {
    id: 'part-1',
    name: 'Engine oil',
    categoryName: 'Engine',
    intervalType: 'distance',
    distanceKm: 20_000,
    months: null,
    status: 'OK',
    remainingKm: 5_000,
    dueDate: null,
    remainingDays: null,
    inspectionDue: false,
    inspectionDueDate: null,
    serviceDate: null,
    serviceKm: 100_000,
    includeInReminders: true,
    isCustom: false,
    ...overrides,
  };
}

describe('dashboard part view', () => {
  test('uses the distance side for the progress bar', () => {
    expect(partProgress(part())).toBe(25);
  });

  test('falls back to the time side when distance is unknown', () => {
    const value = partProgress(part({
      intervalType: 'time',
      distanceKm: null,
      months: 12,
      remainingKm: null,
      remainingDays: 182,
      serviceDate: '2026-01-01',
      dueDate: '2027-01-01',
    }));
    expect(value).toBeCloseTo(49.86, 1);
  });

  test('counts only healthy and record-missing parts in the summary', () => {
    expect(summaryCounts([
      part(),
      part({ id: '2', status: 'Unknown' }),
      part({ id: '3', status: 'SetInterval' }),
      part({ id: '4', status: 'Overdue' }),
    ])).toEqual({ upToDate: 1, needRecord: 2 });
  });

  test('explains missing records and intervals', () => {
    expect(partDetailLine(part({ status: 'Unknown', remainingKm: null }))).toBe('No service record yet');
    expect(partDetailLine(part({ status: 'SetInterval', remainingKm: null }))).toBe('Set a replacement interval');
  });
});
