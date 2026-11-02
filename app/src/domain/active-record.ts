import type { LocalDate } from './local-date';

/** Picks the active record of a part: greatest service date, ties to greatest km (D-25). */
export interface AnchoredRecord {
  /** PK of the service_records row. */
  id: string;
  kind: 'service' | 'inspection';
  /** Null = unknown; only baselines may be null (D-32). */
  serviceKm: number | null;
  serviceDate: LocalDate | null;
}

/**
 * Mirrors doc 07 §6.2's SQL ordering for one `kind`:
 * `ORDER BY service_date IS NULL, service_date DESC, service_km IS NULL, service_km DESC`.
 * Undated records rank after every dated record (DB-19).
 */
export function pickActiveRecord<T extends AnchoredRecord>(records: T[], kind: AnchoredRecord['kind']): T | null {
  let best: T | null = null;
  for (const r of records) {
    if (r.kind !== kind) continue;
    if (
      best === null ||
      compareRank(rank(r), rank(best)) > 0 // later record wins
    ) {
      best = r;
    }
  }
  return best;
}

/** Sort keys of the SQL ordering; smaller null watermarks rank before known values. */
function rank(r: AnchoredRecord): [0 | 1, string, 0 | 1, number] {
  return [
    r.serviceDate === null ? 1 : 0,
    r.serviceDate === null ? '' : r.serviceDate,
    r.serviceKm === null ? 1 : 0,
    r.serviceKm === null ? 0 : r.serviceKm,
  ];
}

function compareRank(a: [0 | 1, string, 0 | 1, number], b: [0 | 1, string, 0 | 1, number]): number {
  // true = the greater value is the better (later) record
  const greaterWins = [false, true, false, true];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const aWins = a[i] < b[i] ? !greaterWins[i] : greaterWins[i];
      return aWins ? 1 : -1;
    }
  }
  return 0;
}
