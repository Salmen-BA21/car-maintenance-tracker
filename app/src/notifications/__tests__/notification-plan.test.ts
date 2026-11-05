import { jsDateToLocalDate } from '../../domain/local-date';
import type { PartStatus } from '../../domain/status';
import { buildNotificationPlan, type PlannedPart } from '../notification-plan';

const now = new Date(2026, 10, 4, 12, 0, 0, 0);

const basePart: PlannedPart = {
  id: 'part-1',
  name: 'Engine oil',
  intervalType: 'time',
  status: 'OK',
  remainingKm: null,
  remainingDays: null,
  dueDate: null,
  inspectionDue: false,
  inspectionDueDate: null,
  serviceDate: null,
  includeInReminders: true,
};

function plan(overrides: Partial<Parameters<typeof buildNotificationPlan>[0]> = {}) {
  return buildNotificationPlan({
    enabled: true,
    now,
    reminderTime: '20:00',
    windowDays: 7,
    odometerUpdatedToday: false,
    parts: [],
    ...overrides,
  });
}

function day(notification: { triggerAt: Date }): string {
  return jsDateToLocalDate(notification.triggerAt);
}

describe('buildNotificationPlan (FR-080, FR-082, FR-091, AC-09, AC-10)', () => {
  test('disabled reminders produce nothing', () => {
    expect(plan({ enabled: false })).toEqual([]);
  });

  test('schedules one reminder per day for the window and a final paused notice', () => {
    const notifications = plan();

    expect(notifications).toHaveLength(8);
    expect(notifications.filter((item) => item.title === 'Maintenance check')).toHaveLength(7);
    expect(notifications[0]).toEqual(expect.objectContaining({ title: 'Maintenance check' }));
    expect(day(notifications[0])).toBe('2026-11-04');
    expect(notifications[6].triggerAt.getHours()).toBe(20);
    expect(notifications[7]).toEqual(expect.objectContaining({ title: 'Reminders paused' }));
    expect(day(notifications[7])).toBe('2026-11-11');
  });

  test('skips today when the odometer was already updated (AC-09)', () => {
    const notifications = plan({ odometerUpdatedToday: true });

    expect(day(notifications[0])).toBe('2026-11-05');
    expect(notifications.some((item) => day(item) === '2026-11-04')).toBe(false);
    expect(notifications.filter((item) => item.title === 'Maintenance check')).toHaveLength(6);
  });

  test('skips an already-passed reminder time today', () => {
    const notifications = plan({ now: new Date(2026, 10, 4, 21, 0, 0, 0) });

    expect(day(notifications[0])).toBe('2026-11-05');
  });

  test('summarises the count and the most urgent part, respecting the alert switch', () => {
    const notifications = plan({
      parts: [
        { ...basePart, id: 'oil', name: 'Engine oil', status: 'Overdue' as PartStatus, remainingKm: -500 },
        { ...basePart, id: 'pads', name: 'Brake pads', intervalType: 'condition', status: 'Inspect' as PartStatus, inspectionDue: true, inspectionDueDate: '2026-10-01' },
        { ...basePart, id: 'air', name: 'Air filter', status: 'DueSoon' as PartStatus, dueDate: '2026-11-20' },
        { ...basePart, id: 'muted', name: 'Muted part', status: 'Overdue' as PartStatus, includeInReminders: false },
      ],
    });

    expect(notifications[0].body).toBe('3 parts need attention — Engine oil overdue.');
  });

  test('uses the generic mileage prompt when nothing needs attention', () => {
    expect(plan()[0].body).toBe('Update your mileage to keep maintenance status current.');
  });

  test('schedules part alerts at the due-soon and due dates inside the window (FR-091)', () => {
    const notifications = plan({
      parts: [
        { ...basePart, id: 'oil', name: 'Engine oil', status: 'DueSoon' as PartStatus, serviceDate: '2026-11-01', dueDate: '2026-11-07' },
        { ...basePart, id: 'km-only', name: 'Air filter', intervalType: 'distance', status: 'DueSoon' as PartStatus, remainingKm: 500 },
        { ...basePart, id: 'inspect-only', name: 'Brake pads', intervalType: 'condition', status: 'Inspect' as PartStatus, inspectionDue: true, inspectionDueDate: '2026-11-06' },
      ],
    });
    const partAlerts = notifications.filter((item) => item.title !== 'Maintenance check' && item.title !== 'Reminders paused');

    expect(partAlerts.map((item) => item.title)).toEqual(['Engine oil due soon', 'Engine oil due']);
    expect(partAlerts.map(day)).toEqual(['2026-11-04', '2026-11-07']);
    expect(partAlerts.every((item) => item.partId === 'oil')).toBe(true);
  });

  test('omits part alerts that fall outside the window', () => {
    const notifications = plan({
      parts: [{ ...basePart, status: 'OK' as PartStatus, serviceDate: '2026-10-01', dueDate: '2026-12-01' }],
    });

    expect(notifications.some((item) => item.partId !== undefined)).toBe(false);
  });
});
