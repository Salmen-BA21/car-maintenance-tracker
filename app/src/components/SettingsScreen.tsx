import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { exportLocalData, getAppSettings, saveAppSettings, type AppSettings } from '../data/repositories/car-repository';
import { rebuildNotifications } from '../notifications/notification-service';
import { AppText, Button, Card, InlineError, PageHeader, TextField, Toggle } from '../ui/kit';
import { useTheme } from '../ui/theme';

const CURRENCIES = ['EUR', 'USD', 'TND'];

export function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    getAppSettings(db)
      .then((value) => { if (active) setSettings(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load settings.'); });
    return () => { active = false; };
  }, [db]);

  async function save() {
    if (!settings) return;
    try {
      setError('');
      const next = {
        ...settings,
        reminderTime: settings.reminderTime.trim(),
        currency: settings.currency.trim().toUpperCase(),
      };
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.reminderTime)) throw new Error('Reminder time must use HH:MM, e.g. 20:00.');
      if (!/^[A-Z]{3}$/.test(next.currency)) throw new Error('Currency must be a three-letter code, e.g. EUR.');
      setSettings(next);
      await saveAppSettings(db, next);
      const status = await rebuildNotifications(db, { requestPermission: next.remindersEnabled });
      setSaved(status !== 'denied');
      if (status === 'denied') setError('Notifications are blocked. Enable them in your device settings.');
    } catch (cause) {
      setSaved(false);
      setError(cause instanceof Error ? cause.message : 'Could not save settings.');
    }
  }

  async function exportData() {
    setError('');
    setExporting(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const file = new File(Paths.cache, 'car-maintenance-export.json');
      file.write(await exportLocalData(db));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export maintenance data' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export your data.');
    } finally {
      setExporting(false);
    }
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <AppText variant="display">{error || 'Loading settings…'}</AppText>
      </View>
    );
  }

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ gap: 22, padding: 20, paddingBottom: 34 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    >
      <PageHeader eyebrow="Preferences" subtitle="Choose how your local reminders and costs behave." title="Settings" />

      <Card style={{ alignItems: 'center', flexDirection: 'row', gap: 12, paddingLeft: 18, paddingRight: 8, paddingVertical: 14 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Maintenance reminders</AppText>
          <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13, lineHeight: 18 }}>
            Notifications are requested only when enabled.
          </AppText>
        </View>
        <Toggle label="Maintenance reminders" onChange={(value) => setSettings({ ...settings, remindersEnabled: value })} value={settings.remindersEnabled} />
      </Card>

      <TextField
        accessibilityLabel="Reminder time"
        autoCapitalize="none"
        label="Reminder time"
        maxLength={5}
        onChangeText={(value) => setSettings({ ...settings, reminderTime: value })}
        placeholder="20:00"
        value={settings.reminderTime}
      />

      <View style={{ gap: 8 }}>
        <AppText variant="label">Currency</AppText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {CURRENCIES.map((currency) => {
            const selected = settings.currency === currency;
            return (
              <Pressable
                accessibilityLabel={currency}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={currency}
                onPress={() => setSettings({ ...settings, currency })}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  backgroundColor: selected ? theme.tint : theme.card,
                  borderColor: selected ? theme.highlight : theme.border,
                  borderRadius: theme.radius.field,
                  borderWidth: selected ? 2 : 1.5,
                  flex: 1,
                  height: 56,
                  justifyContent: 'center',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <AppText style={{ color: selected ? theme.highlight : theme.ink, fontFamily: theme.font.extrabold, fontSize: 16 }}>{currency}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <InlineError>{error}</InlineError> : null}
      {saved ? <AppText color={theme.ok} style={{ fontFamily: theme.font.bold, fontSize: 15 }}>Settings saved.</AppText> : null}

      <View style={{ gap: 12 }}>
        <Button onPress={() => void save()} title="Save settings" />
        <Button icon="download" onPress={() => void exportData()} title={exporting ? 'Preparing export…' : 'Export data as JSON'} variant="secondary" />
        <AppText align="center" color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13, marginTop: 4 }}>
          App version {Constants.expoConfig?.version ?? 'unknown'}
        </AppText>
      </View>
    </ScrollView>
  );
}
