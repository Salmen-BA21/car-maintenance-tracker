import { addMonths, daysBetween, maxLocalDate, type LocalDate } from './local-date';

/**
 * Condition-based parts (BR-08, D-52, doc 07 §6.5): due when today reaches the
 * inspection period counted from the latest of the last inspection, the last
 * service record and the part's creation. A replacement resets the cycle.
 * `createdDate` is the local calendar date of the part's `created_at`, converted
 * by the data layer.
 */
export function isInspectionDue(
  part: {
    inspectionMonths: number;
    lastInspectionDate: LocalDate | null;
    lastServiceDate: LocalDate | null;
    createdDate: LocalDate | null;
  },
  today: LocalDate,
): boolean {
  const anchor = maxLocalDate(part.lastInspectionDate, part.lastServiceDate, part.createdDate);
  if (anchor === null) return false;
  return daysBetween(today, addMonths(anchor, part.inspectionMonths)) <= 0;
}
