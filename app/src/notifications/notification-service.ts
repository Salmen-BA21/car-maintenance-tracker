import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getAppSettings, getDashboard, hasOdometerEntryToday } from '../data/repositories/car-repository';
import { jsDateToLocalDate } from '../domain/local-date';
import { buildNotificationPlan } from './notification-plan';

const CHANNEL_ID = 'maintenance-reminders';
const WINDOW_DAYS = 7;

export type NotificationStatus = 'scheduled' | 'disabled' | 'denied';
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * D-24 simplified window: rebuild every reminder from scratch. Callers pass
 * `requestPermission` only when the user turns reminders on (AC-20).
 */
export async function rebuildNotifications(
  db: SQLiteDatabase,
  options: { requestPermission?: boolean } = {},
): Promise<NotificationStatus> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const settings = await getAppSettings(db);
  if (!settings.remindersEnabled) return 'disabled';

  let granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted && options.requestPermission) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return 'denied';

  const dashboard = await getDashboard(db);
  const now = new Date();
  const plan = buildNotificationPlan({
    enabled: true,
    now,
    reminderTime: settings.reminderTime,
    windowDays: WINDOW_DAYS,
    odometerUpdatedToday: await hasOdometerEntryToday(db, dashboard.carId, jsDateToLocalDate(now)),
    parts: dashboard.parts,
  });
  if (plan.length === 0) return 'scheduled';

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Maintenance reminders',
    importance: AndroidImportance.DEFAULT,
  });

  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        data: item.partId === undefined ? {} : { partId: item.partId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.triggerAt,
        channelId: CHANNEL_ID,
      },
    });
  }

  return 'scheduled';
}

/** The one module that may read the notification permission (D-74). */
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return 'granted';
  return permission.status === 'undetermined' ? 'undetermined' : 'denied';
}

/** The single post-write step (D-74): reminders never block the write itself. */
export async function afterWrite(db: SQLiteDatabase): Promise<void> {
  await rebuildNotifications(db).catch((cause: unknown) => {
    console.warn('Could not rebuild maintenance reminders.', cause);
  });
}
