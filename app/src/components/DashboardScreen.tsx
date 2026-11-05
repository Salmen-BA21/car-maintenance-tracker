import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Pressable, Text, TextInput, View } from 'react-native';

import { deleteOdometerEntry, getAppSettings, getDashboard, getOdometerHistory, setPartHidden, updateOdometer, updateOdometerEntry, type DashboardData, type DashboardPart, type OdometerEntry } from '../data/repositories/car-repository';
import { needsAttention } from '../domain/attention';
import type { PartStatus } from '../domain/status';
import { afterWrite, getNotificationPermissionStatus } from '../notifications/notification-service';
import { colors, styles } from './uiStyles';

export function DashboardScreen({ onPartPress, onAddCustomPart, onSettings }: { onPartPress: (partId: string) => void; onAddCustomPart: (carId: string) => void; onSettings: () => void }) {
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [editingOdometer, setEditingOdometer] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [history, setHistory] = useState<OdometerEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryValue, setEntryValue] = useState('');
  const [newlyUrgent, setNewlyUrgent] = useState<DashboardPart[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reminderDenied, setReminderDenied] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async (): Promise<DashboardData | null> => {
    try {
      setError('');
      const next = await getDashboard(db);
      setData(next);
      setHistory(await getOdometerHistory(db, next.carId));
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.');
      return null;
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    getDashboard(db)
      .then(async (result) => {
        const odometerHistory = await getOdometerHistory(db, result.carId);
        if (active) {
          setData(result);
          setHistory(odometerHistory);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.');
      });
    return () => { active = false; };
  }, [db]);

  useEffect(() => {
    let active = true;
    const checkPermission = () => {
      Promise.all([getAppSettings(db), getNotificationPermissionStatus()])
        .then(([settings, status]) => {
          if (active) setReminderDenied(settings.remindersEnabled && status === 'denied');
        })
        .catch(() => undefined);
    };
    checkPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });
    return () => { active = false; subscription.remove(); };
  }, [db]);

  const snapshotStatuses = useCallback(
    () => new Map((data?.parts ?? []).map((part) => [part.id, part.status])),
    [data],
  );

  const refreshWithNotice = useCallback(
    async (previous: Map<string, PartStatus>) => {
      const next = await load();
      if (next) {
        setNewlyUrgent(next.parts.filter((part) => isUrgent(part.status) && !isUrgent(previous.get(part.id))));
      }
    },
    [load],
  );

  async function saveOdometer() {
    if (!data) return;
    try {
      setNewlyUrgent([]);
      const previous = snapshotStatuses();
      if (!odometer.trim()) throw new Error('Enter the new mileage.');
      await updateOdometer(db, data.carId, Number(odometer.trim()));
      setEditingOdometer(false);
      setOdometer('');
      await afterWrite(db);
      await refreshWithNotice(previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the odometer.');
    }
  }

  async function saveEntry() {
    if (editingEntryId === null) return;
    try {
      setError('');
      setNewlyUrgent([]);
      const previous = snapshotStatuses();
      if (!entryValue.trim()) throw new Error('Enter a mileage value.');
      await updateOdometerEntry(db, editingEntryId, Number(entryValue.trim()));
      setEditingEntryId(null);
      setEntryValue('');
      await afterWrite(db);
      await refreshWithNotice(previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not edit the mileage entry.');
    }
  }

  async function removeEntry(entryId: string) {
    try {
      setError('');
      setNewlyUrgent([]);
      const previous = snapshotStatuses();
      await deleteOdometerEntry(db, entryId);
      await afterWrite(db);
      await refreshWithNotice(previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the mileage entry.');
    }
  }

  async function restorePart(partId: string) {
    try {
      setError('');
      await setPartHidden(db, partId, false);
      await afterWrite(db);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not show this part.');
    }
  }

  const attention = useMemo(() => needsAttention(data?.parts ?? []), [data]);
  const groups = useMemo(() => {
    const grouped = new Map<string, DashboardPart[]>();
    for (const part of data?.parts ?? []) grouped.set(part.categoryName, [...(grouped.get(part.categoryName) ?? []), part]);
    return [...grouped.entries()];
  }, [data]);
  const renderCategory = useCallback(
    ({ item: [category, parts] }: { item: [string, DashboardPart[]] }) => (
      <CategoryRow
        category={category}
        collapsed={Boolean(collapsed[category])}
        parts={parts}
        onPartPress={onPartPress}
        onToggle={() => setCollapsed((current) => ({ ...current, [category]: !current[category] }))}
      />
    ),
    [collapsed, onPartPress],
  );

  if (error && !data) return <View style={styles.loading}><Text style={styles.title}>Dashboard unavailable</Text><Text style={styles.intro}>{error}</Text></View>;
  if (!data) return <View style={styles.loading}><Text style={styles.title}>Loading your garage…</Text></View>;

  return (
    <FlatList
      data={groups}
      keyExtractor={([category]) => category}
      contentContainerStyle={styles.content}
      style={styles.screen}
      ListHeaderComponent={
        <View>
          <Text style={styles.kicker}>Your garage</Text>
          <Text style={styles.title}>{data.carName}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={onSettings}><Text style={styles.linkText}>Settings</Text></Pressable>
          <View style={styles.odometerCard}>
            <View><Text style={styles.helper}>Current odometer</Text><Text style={styles.odometerValue}>{data.currentOdometerKm.toLocaleString()} km</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={editingOdometer ? 'Cancel odometer update' : 'Update odometer'} onPress={() => setEditingOdometer((value) => !value)}><Text style={styles.linkText}>{editingOdometer ? 'Cancel' : 'Update'}</Text></Pressable>
          </View>
          {editingOdometer ? <View style={styles.inlineEditor}><TextInput accessibilityLabel="New odometer in kilometres" keyboardType="number-pad" onChangeText={setOdometer} placeholder="New km" placeholderTextColor={colors.muted} style={styles.partInput} value={odometer} /><Pressable accessibilityRole="button" accessibilityLabel="Save odometer" onPress={saveOdometer} style={styles.smallButton}><Text style={styles.primaryButtonText}>Save</Text></Pressable></View> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {reminderDenied ? <View style={styles.notice}>
            <Text style={styles.label}>Reminders are blocked</Text>
            <Text style={styles.helper}>Allow notifications in your device settings to get maintenance reminders.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open device settings" onPress={() => void Linking.openSettings()}><Text style={styles.linkText}>Open settings</Text></Pressable>
          </View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={showHistory ? 'Hide mileage history' : 'Show mileage history'} onPress={() => setShowHistory((value) => !value)}><Text style={styles.linkText}>{showHistory ? 'Hide mileage history' : `Mileage history (${history.length})`}</Text></Pressable>
          {showHistory ? <MileageHistory
            editingId={editingEntryId}
            entries={history}
            onCancel={() => { setEditingEntryId(null); setEntryValue(''); }}
            onChangeValue={setEntryValue}
            onDelete={(entry) => Alert.alert('Delete mileage entry?', `Remove ${entry.valueKm.toLocaleString()} km from the history?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeEntry(entry.id) }])}
            onEdit={(entry) => { setEditingEntryId(entry.id); setEntryValue(String(entry.valueKm)); }}
            onSave={saveEntry}
            value={entryValue}
          /> : null}
          {newlyUrgent.length > 0 ? <View style={styles.notice}>
            <Text style={styles.label}>{newlyUrgent.length === 1 ? '1 part is newly urgent' : `${newlyUrgent.length} parts are newly urgent`}</Text>
            {newlyUrgent.map((part) => <Text key={part.id} style={styles.helper}>{part.name}: {part.status === 'Overdue' ? 'overdue' : 'due soon'}</Text>)}
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notice" onPress={() => setNewlyUrgent([])}><Text style={styles.linkText}>Dismiss</Text></Pressable>
          </View> : null}
          {attention.length > 0 ? <View style={styles.category}>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            {attention.map((part) => <PartRow key={part.id} part={part} onPress={() => onPartPress(part.id)} />)}
          </View> : null}
          <Text style={styles.sectionTitle}>Maintenance</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add custom part" onPress={() => onAddCustomPart(data.carId)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>＋ Add custom part</Text></Pressable>
          {data.hiddenParts.length > 0 ? <>
            <Pressable accessibilityRole="button" accessibilityLabel={showHidden ? 'Hide hidden parts' : `Show ${data.hiddenParts.length} hidden parts`} onPress={() => setShowHidden((value) => !value)}><Text style={styles.linkText}>{showHidden ? 'Hide hidden parts' : `Show ${data.hiddenParts.length} hidden part${data.hiddenParts.length === 1 ? '' : 's'}`}</Text></Pressable>
            {showHidden ? data.hiddenParts.map((part) => <View key={part.id} style={styles.dashboardRow}><View style={styles.partCopy}><Text style={styles.partName}>{part.name}</Text><Text style={styles.helper}>{part.categoryName}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Show ${part.name}`} onPress={() => void restorePart(part.id)}><Text style={styles.linkText}>Show</Text></Pressable></View>) : null}
          </> : null}
        </View>
      }
      renderItem={renderCategory}
    />
  );
}

function MileageHistory({
  editingId,
  entries,
  onCancel,
  onChangeValue,
  onDelete,
  onEdit,
  onSave,
  value,
}: {
  editingId: string | null;
  entries: OdometerEntry[];
  onCancel: () => void;
  onChangeValue: (value: string) => void;
  onDelete: (entry: OdometerEntry) => void;
  onEdit: (entry: OdometerEntry) => void;
  onSave: () => void;
  value: string;
}) {
  return (
    <View>
      {entries.map((entry, index) => editingId === entry.id ? (
        <View key={entry.id} style={styles.historyRow}>
          <TextInput accessibilityLabel="Edited odometer in kilometres" keyboardType="number-pad" onChangeText={onChangeValue} placeholder="New km" placeholderTextColor={colors.muted} style={[styles.partInput, { flex: 1, marginBottom: 0 }]} value={value} />
          <Pressable accessibilityRole="button" accessibilityLabel="Save mileage entry" onPress={onSave} style={[styles.smallButton, { minHeight: 44 }]}><Text style={styles.primaryButtonText}>Save</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel mileage edit" onPress={onCancel}><Text style={styles.linkText}>Cancel</Text></Pressable>
        </View>
      ) : (
        <View key={entry.id} style={styles.historyRow}>
          <View><Text style={styles.partName}>{entry.valueKm.toLocaleString()} km</Text><Text style={styles.helper}>{entry.entryDate}</Text></View>
          {index === 0 ? <View style={[styles.actionRow, { marginTop: 0 }]}><Pressable accessibilityRole="button" accessibilityLabel="Edit latest mileage entry" onPress={() => onEdit(entry)}><Text style={styles.linkText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Delete latest mileage entry" onPress={() => onDelete(entry)}><Text style={styles.dangerText}>Delete</Text></Pressable></View> : null}
        </View>
      ))}
    </View>
  );
}

function CategoryRow({ category, collapsed, parts, onPartPress, onToggle }: { category: string; collapsed: boolean; parts: DashboardPart[]; onPartPress: (partId: string) => void; onToggle: () => void }) {
  return <View style={styles.category}><Pressable accessibilityRole="button" accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${category}`} onPress={onToggle}><Text style={styles.categoryTitle}>{category} {collapsed ? '▸' : '▾'}</Text></Pressable>{collapsed ? null : parts.map((part) => <PartRow key={part.id} part={part} onPress={() => onPartPress(part.id)} />)}</View>;
}

function isUrgent(status: PartStatus | undefined): boolean {
  return status === 'DueSoon' || status === 'Overdue';
}

function PartRow({ part, onPress }: { part: DashboardPart; onPress: () => void }) {
  const label = part.status === 'DueSoon' ? 'Due soon' : part.status === 'SetInterval' ? 'Set interval' : part.status;
  const detail = part.intervalType === 'condition'
    ? part.inspectionDue ? 'Inspection due' : part.inspectionDueDate ? `Inspect by ${part.inspectionDueDate}` : 'Set inspection interval'
    : part.remainingKm !== null ? `${part.remainingKm.toLocaleString()} km left` : part.dueDate ? `Due ${part.dueDate}` : 'Needs a record';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${part.name}, ${label}, ${detail}`} onPress={onPress} style={({ pressed }) => [styles.dashboardRow, pressed && styles.pressed]}><View style={styles.partCopy}><Text style={styles.partName}>{part.name}</Text><Text style={styles.helper}>{detail}</Text></View><Text style={[styles.status, statusStyles[part.status]]}>{label}</Text></Pressable>;
}

const statusStyles: Record<PartStatus, object> = {
  OK: { color: colors.accent },
  DueSoon: { color: '#A66B00' },
  Overdue: { color: colors.error },
  Unknown: { color: colors.muted },
  SetInterval: { color: '#7A5A9A' },
  Inspect: { color: '#8C4B28' },
};
