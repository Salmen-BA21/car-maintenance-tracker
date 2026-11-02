import { pickActiveRecord, type AnchoredRecord } from '../active-record';
import type { LocalDate } from '../local-date';

const rec = (
  id: string,
  date: LocalDate | null,
  km: number | null,
  kind: AnchoredRecord['kind'] = 'service',
): AnchoredRecord => ({ id, kind, serviceDate: date, serviceKm: km });

describe('pickActiveRecord (D-25, doc 07 §6.2)', () => {
  test('greatest service date wins', () => {
    const r = pickActiveRecord([rec('a', '2024-01-01', 10), rec('b', '2025-01-01', 5)], 'service');
    expect(r?.id).toBe('b');
  });

  test('tie on date goes to the greatest km', () => {
    const r = pickActiveRecord([rec('a', '2025-01-01', 40_000), rec('b', '2025-01-01', 40_100)], 'service');
    expect(r?.id).toBe('b');
  });

  test('undated records rank after dated ones and rank among themselves by km (DB-19)', () => {
    const r = pickActiveRecord([rec('undated', null, 90_000), rec('dated', '2020-01-01', 10_000)], 'service');
    expect(r?.id).toBe('dated');
    expect(pickActiveRecord([rec('a', null, 80_000), rec('b', null, 90_000)], 'service')?.id).toBe('b');
  });

  test('filters by kind and returns null when empty', () => {
    const records = [rec('insp', '2025-01-01', null, 'inspection')];
    expect(pickActiveRecord(records, 'service')).toBeNull();
    expect(pickActiveRecord(records, 'inspection')?.id).toBe('insp');
    expect(pickActiveRecord([], 'service')).toBeNull();
  });
});
