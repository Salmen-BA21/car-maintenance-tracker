import { addMonths, daysBetween, maxLocalDate, type LocalDate } from './local-date';

/**
 * Condition-based parts (BR-08, D-52, doc 07 §6.5): the inspection period is
 * counted from the latest of the last inspection, the last service record and
 * the part's creation. A replacement resets the cycle. `createdDate` is the
 * local calendar date of the part's `created_at`, converted by the data layer.
 */
export function inspectionDueDate(part: {
  inspectionMonths: number;
  lastInspectionDate: LocalDate | null;
  lastServiceDate: LocalDate | null;
  createdDate: LocalDate | null;
}): LocalDate | null {
  const anchor = maxLocalDate(part.lastInspectionDate, part.lastServiceDate, part.createdDate);
  return anchor === null ? null : addMonths(anchor, part.inspectionMonths);
}

export function isInspectionDue(
  part: Parameters<typeof inspectionDueDate>[0],
  today: LocalDate,
): boolean {
  const due = inspectionDueDate(part);
  return due !== null && daysBetween(today, due) <= 0;
}
