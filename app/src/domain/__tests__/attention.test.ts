import { needsAttention } from '../attention';

const base = {
  remainingKm: null,
  remainingDays: null,
  dueDate: null,
  inspectionDue: false,
  inspectionDueDate: null,
};

describe('needsAttention (FR-047, DB 04 §6.6)', () => {
  test('orders Overdue, then inspection due, then Due soon', () => {
    const parts = needsAttention([
      { ...base, id: 'soon', status: 'DueSoon' as const, remainingKm: 800 },
      { ...base, id: 'inspect', status: 'Inspect' as const, inspectionDue: true, inspectionDueDate: '2026-10-01' },
      { ...base, id: 'overdue', status: 'Overdue' as const, remainingKm: -5_000 },
      { ...base, id: 'ok', status: 'OK' as const },
      { ...base, id: 'unknown', status: 'Unknown' as const },
    ]);

    expect(parts.map((part) => part.id)).toEqual(['overdue', 'inspect', 'soon']);
  });

  test('sorts Overdue by the most negative remaining value', () => {
    const parts = needsAttention([
      { ...base, id: 'late', status: 'Overdue' as const, remainingDays: -3 },
      { ...base, id: 'later', status: 'Overdue' as const, remainingKm: -2_000 },
    ]);

    expect(parts.map((part) => part.id)).toEqual(['later', 'late']);
  });

  test('sorts inspection due and Due soon by nearest date', () => {
    const parts = needsAttention([
      { ...base, id: 'inspect-later', status: 'Inspect' as const, inspectionDue: true, inspectionDueDate: '2026-12-01' },
      { ...base, id: 'inspect-sooner', status: 'Inspect' as const, inspectionDue: true, inspectionDueDate: '2026-11-10' },
      { ...base, id: 'soon-later', status: 'DueSoon' as const, dueDate: '2027-02-01' },
      { ...base, id: 'soon-sooner', status: 'DueSoon' as const, dueDate: '2027-01-01' },
      { ...base, id: 'soon-km', status: 'DueSoon' as const, remainingKm: 500 },
    ]);

    expect(parts.map((part) => part.id)).toEqual([
      'inspect-sooner',
      'inspect-later',
      'soon-sooner',
      'soon-later',
      'soon-km',
    ]);
  });

  test('returns an empty list when nothing needs attention', () => {
    expect(needsAttention([{ ...base, id: 'ok', status: 'OK' as const }])).toEqual([]);
  });
});
