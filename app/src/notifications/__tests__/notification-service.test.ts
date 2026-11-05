import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getAppSettings, getDashboard, hasOdometerEntryToday } from '../../data/repositories/car-repository';
import { afterWrite, getNotificationPermissionStatus, rebuildNotifications } from '../notification-service';

jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('../../data/repositories/car-repository', () => ({
  getAppSettings: jest.fn(),
  getDashboard: jest.fn(),
  hasOdometerEntryToday: jest.fn(),
}));

const db = {} as SQLiteDatabase;

describe('notification service (D-24, AC-20)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(getAppSettings).mockResolvedValue({ remindersEnabled: true, reminderTime: '23:59', currency: 'EUR' });
    jest.mocked(getDashboard).mockResolvedValue({ carId: 'car-1', carName: 'Car', currentOdometerKm: 100_000, parts: [] });
    jest.mocked(hasOdometerEntryToday).mockResolvedValue(false);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true, status: 'granted' } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: true, status: 'granted' } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('cancels and stops when reminders are disabled', async () => {
    jest.mocked(getAppSettings).mockResolvedValue({ remindersEnabled: false, reminderTime: '23:59', currency: 'EUR' });

    await expect(rebuildNotifications(db)).resolves.toBe('disabled');
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns denied without asking when permission was already refused', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, status: 'denied' } as never);

    await expect(rebuildNotifications(db)).resolves.toBe('denied');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('asks for permission only when the caller requests it', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, status: 'undetermined' } as never);

    await expect(rebuildNotifications(db, { requestPermission: true })).resolves.toBe('scheduled');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  test('maps permission states for the dashboard notice', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: true, status: 'granted' } as never);
    await expect(getNotificationPermissionStatus()).resolves.toBe('granted');

    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false, status: 'undetermined' } as never);
    await expect(getNotificationPermissionStatus()).resolves.toBe('undetermined');

    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false, status: 'denied' } as never);
    await expect(getNotificationPermissionStatus()).resolves.toBe('denied');
  });

  test('afterWrite never rejects and logs the failure', async () => {
    jest.mocked(getAppSettings).mockRejectedValue(new Error('database unavailable'));

    await expect(afterWrite(db)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });
});
