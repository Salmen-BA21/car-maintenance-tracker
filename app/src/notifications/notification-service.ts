import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getAppSettings, getDashboard } from '../data/repositories/car-repository';

const CHANNEL_ID = 'maintenance-reminders';
const WINDOW_DAYS = 7;

export async function rebuildNotifications(db: SQLiteDatabase): Promise<void> {
  const settings = await getAppSettings(db);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.remindersEnabled) return;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) return;
  }

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Maintenance reminders',
    importance: AndroidImportance.DEFAULT,
  });

  const dashboard = await getDashboard(db);
  const parts = dashboard.parts.filter((part) => part.status !== 'OK');
  if (parts.length === 0) return;

  const [hours, minutes] = settings.reminderTime.split(':').map(Number);
  const now = new Date();
  for (let day = 0; day < WINDOW_DAYS; day += 1) {
    const trigger = new Date(now);
    trigger.setDate(now.getDate() + day);
    trigger.setHours(hours, minutes, 0, 0);
    if (trigger <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Maintenance check',
        body: `${parts.length} part${parts.length === 1 ? '' : 's'} need your attention.`,
        data: { screen: 'dashboard' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
        channelId: CHANNEL_ID,
      },
    });
  }
}
