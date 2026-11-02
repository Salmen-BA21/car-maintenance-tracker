import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { getDashboard, updateOdometer, type DashboardData, type DashboardPart } from '../data/repositories/car-repository';
import type { PartStatus } from '../domain/status';
import { colors, styles } from './uiStyles';

export function DashboardScreen({ onPartPress, onAddCustomPart, onSettings }: { onPartPress: (partId: string) => void; onAddCustomPart: (carId: string) => void; onSettings: () => void }) {
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [editingOdometer, setEditingOdometer] = useState(false);
  const [odometer, setOdometer] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await getDashboard(db));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.');
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    getDashboard(db)
      .then((result) => { if (active) setData(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.'); });
    return () => { active = false; };
  }, [db]);

  async function saveOdometer() {
    if (!data) return;
    try {
      await updateOdometer(db, data.carId, Number(odometer.trim()));
      setEditingOdometer(false);
      setOdometer('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the odometer.');
    }
  }

  const groups = useMemo(() => {
    const grouped = new Map<string, DashboardPart[]>();
    for (const part of data?.parts ?? []) grouped.set(part.categoryName, [...(grouped.get(part.categoryName) ?? []), part]);
    return [...grouped.entries()];
  }, [data]);
  const renderCategory = useCallback(
    ({ item: [category, parts] }: { item: [string, DashboardPart[]] }) => (
      <CategoryRow category={category} parts={parts} onPartPress={onPartPress} />
    ),
    [onPartPress],
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
          <Text style={styles.sectionTitle}>Maintenance</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add custom part" onPress={() => onAddCustomPart(data.carId)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>＋ Add custom part</Text></Pressable>
        </View>
      }
      renderItem={renderCategory}
    />
  );
}

function CategoryRow({ category, parts, onPartPress }: { category: string; parts: DashboardPart[]; onPartPress: (partId: string) => void }) {
  return <View style={styles.category}><Text style={styles.categoryTitle}>{category}</Text>{parts.map((part) => <PartRow key={part.id} part={part} onPress={() => onPartPress(part.id)} />)}</View>;
}

function PartRow({ part, onPress }: { part: DashboardPart; onPress: () => void }) {
  const label = part.status === 'DueSoon' ? 'Due soon' : part.status === 'SetInterval' ? 'Set interval' : part.status;
  const detail = part.remainingKm !== null ? `${part.remainingKm.toLocaleString()} km left` : part.dueDate ? `Due ${part.dueDate}` : 'Needs a record';
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
