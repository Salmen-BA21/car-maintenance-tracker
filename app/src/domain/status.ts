import { addMonths, daysBetween, type LocalDate } from './local-date';

/**
 * The status engine (BR-05, DB doc §6.3–6.4, D-22, D-32, D-33). Status is
 * derived on read and never stored (D-33). The first matching precendence
 * entry wins; "both unknown sides" means a part cannot be judged at all.
 */
export type IntervalType = 'distance' | 'time' | 'both' | 'condition';

/** Precedence order (BR-05 / doc 07 §6.4): Inspect, Set interval, Unknown, Overdue, Due soon, OK. */
export type PartStatus =
  | 'Inspect'
  | 'SetInterval'
  | 'Unknown'
  | 'Overdue'
  | 'DueSoon'
  | 'OK';

/** Anchors of the part's active service record (doc 07 §6.2). Null = unknown (D-32). */
export interface ActiveRecord {
  serviceKm: number | null;
  serviceDate: LocalDate | null;
}

export interface StatusInput {
  intervalType: IntervalType;
  /** Required for `distance` and `both`; null = not set yet (Set interval, DB-13). */
  distanceKm: number | null;
  /** Required for `time` and `both`; null = not set yet (Set interval, DB-13). */
  months: number | null;
}

export interface StatusResult {
  status: PartStatus;
  /** Remaining distance to the next due point; null when the distance side is unknown. */
  remainingKm: number | null;
  dueDate: LocalDate | null;
  /** Whole days from `today` to `dueDate`; negative when overdue; null when the time side is unknown. */
  remainingDays: number | null;
}

const UNKNOWN: StatusResult = { status: 'Unknown', remainingKm: null, dueDate: null, remainingDays: null };

export function computeStatus(
  part: StatusInput,
  active: ActiveRecord | null,
  currentOdometerKm: number | null,
  today: LocalDate,
): StatusResult {
  if (part.intervalType === 'condition') {
    return { status: 'Inspect', remainingKm: null, dueDate: null, remainingDays: null };
  }

  const missingDistance =
    (part.intervalType === 'distance' || part.intervalType === 'both') && part.distanceKm === null;
  const missingTime =
    (part.intervalType === 'time' || part.intervalType === 'both') && part.months === null;
  if (missingDistance || missingTime) {
    return { status: 'SetInterval', remainingKm: null, dueDate: null, remainingDays: null };
  }

  // A side is computable only when all of its inputs are known (BR-20), and it
  // only exists for the interval types that use it: distance for `distance`/`both`,
  // time for `time`/`both`.
  const distanceSide = part.intervalType === 'distance' || part.intervalType === 'both';
  const timeSide = part.intervalType === 'time' || part.intervalType === 'both';
  const hasDistance =
    distanceSide && active !== null && active.serviceKm !== null && currentOdometerKm !== null && part.distanceKm !== null;
  const hasTime = timeSide && active !== null && active.serviceDate !== null;

  // Unknown: no active record at all, or every judgeable side is unknown (precedence 3).
  if (active === null || (!hasDistance && !hasTime)) {
    return UNKNOWN;
  }

  const remainingKm = hasDistance
    ? (part.distanceKm as number) - ((currentOdometerKm as number) - (active.serviceKm as number))
    : null;

  const dueDate = hasTime ? addMonths(active.serviceDate as LocalDate, part.months as number) : null;
  const remainingDays = dueDate !== null ? daysBetween(today, dueDate) : null;

  if (remainingKm !== null && remainingKm <= 0) {
    return { status: 'Overdue', remainingKm, dueDate, remainingDays };
  }
  if (remainingDays !== null && remainingDays <= 0) {
    return { status: 'Overdue', remainingKm, dueDate, remainingDays };
  }

  if (
    remainingKm !== null &&
    remainingKm <= Math.min(Math.floor((part.distanceKm as number) / 2), 1000)
  ) {
    return { status: 'DueSoon', remainingKm, dueDate, remainingDays };
  }
  if (
    remainingDays !== null &&
    remainingDays <= Math.min(30, Math.floor(daysBetween(active.serviceDate as LocalDate, dueDate as LocalDate) / 2))
  ) {
    return { status: 'DueSoon', remainingKm, dueDate, remainingDays };
  }

  return { status: 'OK', remainingKm, dueDate, remainingDays };
}
