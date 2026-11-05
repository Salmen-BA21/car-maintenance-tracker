import { needsAttention, type AttentionInput } from '../domain/attention';
import { daysBetween, jsDateToLocalDate, type LocalDate } from '../domain/local-date';

/** Same shape as the dashboard part plus the alert switch (FR-090). */
export interface PlannedPart extends AttentionInput {
  id: string;
  name: string;
  intervalType: 'distance' | 'time' | 'both' | 'condition';
  serviceDate: LocalDate | null;
  includeInReminders: boolean;
}

export interface PlannedNotification {
  title: string;
  body: string;
  triggerAt: Date;
  partId?: string;
}

export interface PlanInput {
  enabled: boolean;
  now: Date;
  reminderTime: string;
  windowDays: number;
  odometerUpdatedToday: boolean;
  parts: PlannedPart[];
}

/**
 * MVP notification window (D-24 simplification, FR-080 to FR-091): a daily
 * mileage reminder for the next `windowDays`, one-shots for time-based parts,
 * and a final paused notice. All text is decided here so it can be tested
 * without the notification library.
 */
export function buildNotificationPlan(input: PlanInput): PlannedNotification[] {
  if (!input.enabled) return [];

  const today = jsDateToLocalDate(input.now);
  const reminders = input.parts.filter((part) => part.includeInReminders);
  const attention = needsAttention(reminders);
  const windowEnd = at(addDays(today, input.windowDays), input.reminderTime);
  const plan: PlannedNotification[] = [];

  for (let offset = 0; offset < input.windowDays; offset += 1) {
    if (offset === 0 && input.odometerUpdatedToday) continue;
    const triggerAt = at(addDays(today, offset), input.reminderTime);
    if (triggerAt <= input.now) continue;
    plan.push({ title: 'Maintenance check', body: reminderBody(attention), triggerAt });
  }

  for (const part of reminders) {
    if (part.intervalType !== 'time' && part.intervalType !== 'both') continue;
    if (part.dueDate === null) continue;
    const dueSoon = part.serviceDate === null ? null : addDays(part.dueDate, -thresholdDays(part));
    const dates = dueSoon !== null && dueSoon !== part.dueDate ? [dueSoon, part.dueDate] : [part.dueDate];
    for (const date of dates) {
      const triggerAt = at(date, input.reminderTime);
      if (triggerAt <= input.now || triggerAt >= windowEnd) continue;
      const isDue = date === part.dueDate;
      plan.push({
        title: `${part.name} ${isDue ? 'due' : 'due soon'}`,
        body: isDue
          ? `Service it by ${part.dueDate}.`
          : `Service it by ${part.dueDate} (${daysBetween(today, part.dueDate)} days).`,
        triggerAt,
        partId: part.id,
      });
    }
  }

  plan.push({
    title: 'Reminders paused',
    body: 'Open the app to refresh your maintenance reminders.',
    triggerAt: windowEnd,
  });

  return plan.sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
}

function reminderBody(attention: PlannedPart[]): string {
  if (attention.length === 0) return 'Update your mileage to keep maintenance status current.';
  const urgent = attention[0];
  const label = urgent.status === 'Overdue'
    ? 'overdue'
    : urgent.status === 'Inspect' && urgent.inspectionDue
      ? 'inspection due'
      : 'due soon';
  return `${attention.length} part${attention.length === 1 ? '' : 's'} need${attention.length === 1 ? 's' : ''} attention — ${urgent.name} ${label}.`;
}

function thresholdDays(part: PlannedPart): number {
  if (part.serviceDate === null || part.dueDate === null) return 0;
  return Math.min(30, Math.floor(daysBetween(part.serviceDate, part.dueDate) / 2));
}

function addDays(date: LocalDate, days: number): LocalDate {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10) as LocalDate;
}

function at(date: LocalDate, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}
