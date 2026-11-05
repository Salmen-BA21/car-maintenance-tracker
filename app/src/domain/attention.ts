import type { LocalDate } from './local-date';
import type { PartStatus } from './status';

export interface AttentionInput {
  status: PartStatus;
  remainingKm: number | null;
  remainingDays: number | null;
  dueDate: LocalDate | null;
  inspectionDue: boolean;
  inspectionDueDate: LocalDate | null;
}

/**
 * FR-047 / DB 04 §6.6: Overdue first (most negative remaining value), then
 * inspection due (nearest date), then Due soon (nearest date, else smallest km).
 */
export function needsAttention<T extends AttentionInput>(parts: T[]): T[] {
  return [
    ...parts.filter((part) => part.status === 'Overdue').sort((a, b) => urgency(a) - urgency(b)),
    ...parts
      .filter((part) => part.status !== 'Overdue' && part.inspectionDue)
      .sort((a, b) => compareDates(a.inspectionDueDate, b.inspectionDueDate)),
    ...parts.filter((part) => part.status === 'DueSoon').sort(compareDueSoon),
  ];
}

function urgency(part: AttentionInput): number {
  const values = [part.remainingKm, part.remainingDays].filter((value): value is number => value !== null);
  return values.length === 0 ? 0 : Math.min(...values);
}

function compareDates(a: LocalDate | null, b: LocalDate | null): number {
  return (a ?? '9999-12-31').localeCompare(b ?? '9999-12-31');
}

function compareDueSoon(a: AttentionInput, b: AttentionInput): number {
  if (a.dueDate !== null && b.dueDate !== null) return compareDates(a.dueDate, b.dueDate);
  if (a.dueDate !== null) return -1;
  if (b.dueDate !== null) return 1;
  return (a.remainingKm ?? Infinity) - (b.remainingKm ?? Infinity);
}
