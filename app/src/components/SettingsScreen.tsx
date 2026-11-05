import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { exportLocalData, getAppSettings, saveAppSettings, type AppSettings } from '../data/repositories/car-repository';
import { rebuildNotifications } from '../notifications/notification-service';
import { colors, styles } from './uiStyles';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const db = useSQLiteContext();
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
      await saveAppSettings(db, settings);
      const status = await rebuildNotifications(db, { requestPermission: settings.remindersEnabled });
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

  if (!settings) return <View style={styles.loading}><Text style={styles.title}>{error || 'Loading settings…'}</Text></View>;
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Pressable onPress={onBack}><Text style={styles.linkText}>Back to dashboard</Text></Pressable>
      <Text style={styles.kicker}>Preferences</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.intro}>Choose how your local reminders and costs behave.</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}><Text style={styles.label}>Maintenance reminders</Text><Text style={styles.helper}>Notifications are requested only when enabled.</Text></View>
        <Switch accessibilityLabel="Maintenance reminders" onValueChange={(value) => setSettings({ ...settings, remindersEnabled: value })} trackColor={{ false: colors.line, true: colors.accent }} value={settings.remindersEnabled} />
      </View>
      <Text style={styles.label}>Reminder time</Text>
      <TextInput accessibilityLabel="Reminder time" onChangeText={(value) => setSettings({ ...settings, reminderTime: value })} placeholder="09:00" placeholderTextColor={colors.muted} style={styles.input} value={settings.reminderTime} />
      <Text style={styles.label}>Currency</Text>
      <TextInput accessibilityLabel="Currency" autoCapitalize="characters" maxLength={3} onChangeText={(value) => setSettings({ ...settings, currency: value.toUpperCase() })} placeholder="EUR" placeholderTextColor={colors.muted} style={styles.input} value={settings.currency} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>Settings saved.</Text> : null}
      <Pressable onPress={save} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save settings</Text></Pressable>
      <Pressable disabled={exporting} onPress={exportData} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{exporting ? 'Preparing export…' : 'Export data as JSON'}</Text></Pressable>
    </ScrollView>
  );
}
