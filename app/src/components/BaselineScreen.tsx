import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { getSetupParts, saveBaselineRecords, type SetupPart } from '../data/repositories/car-repository';
import { jsDateToLocalDate } from '../domain/local-date';
import { colors, styles } from './uiStyles';

export function BaselineScreen({ carId, onDone }: { carId: string; onDone: () => void }) {
  const db = useSQLiteContext();
  const [parts, setParts] = useState<SetupPart[]>([]);
  const [values, setValues] = useState<Record<string, { km: string; date: string }>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetupParts(db, carId)
      .then((loaded) => { setParts(loaded); setValues(Object.fromEntries(loaded.map((part) => [part.id, { km: '', date: '' }]))); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load parts.'));
  }, [carId, db]);

  function update(partId: string, field: 'km' | 'date', value: string) {
    setValues((current) => ({ ...current, [partId]: { ...current[partId], [field]: value } }));
  }

  async function save(allToday = false) {
    setError('');
    setSaving(true);
    try {
      const today = jsDateToLocalDate(new Date());
      const odometer = allToday ? await currentOdometer(db, carId) : null;
      await saveBaselineRecords(db, carId, parts.map((part) => ({ partId: part.id, serviceKm: allToday ? odometer : parseOptionalNumber(values[part.id]?.km), serviceDate: allToday ? today : values[part.id]?.date.trim() || null })));
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save setup.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={parts}
      keyExtractor={(part) => part.id}
      ListFooterComponent={<><>{error ? <Text style={styles.error}>{error}</Text> : null}</><Pressable disabled={saving} onPress={() => save(false)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save history'}</Text></Pressable><Pressable disabled={saving} onPress={() => save(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>All serviced today</Text></Pressable></>}
      ListHeaderComponent={<><Text style={styles.kicker}>One last step</Text><Text style={styles.title}>Add service history</Text><Text style={styles.intro}>Enter what you know. Leave a part blank to show it as unknown.</Text></>}
      renderItem={renderPart}
      style={styles.screen}
    />
  );

  function renderPart({ item: part }: { item: SetupPart }) {
    return <View style={styles.partRow}><Text style={styles.partName}>{part.name}</Text><TextInput accessibilityLabel={`${part.name} last service kilometres`} keyboardType="number-pad" onChangeText={(value) => update(part.id, 'km', value)} placeholder="Last km" placeholderTextColor={colors.muted} style={styles.partInput} value={values[part.id]?.km ?? ''} /><TextInput accessibilityLabel={`${part.name} last service date`} onChangeText={(value) => update(part.id, 'date', value)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.partInput} value={values[part.id]?.date ?? ''} /></View>;
  }
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error('Service km must be a whole number.');
  return number;
}

async function currentOdometer(db: ReturnType<typeof useSQLiteContext>, carId: string): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>('SELECT MAX(value_km) AS value FROM odometer_entries WHERE car_id = ? AND deleted_at IS NULL', carId);
  if (row?.value === null || row?.value === undefined) throw new Error('Current odometer is missing.');
  return row.value;
}
