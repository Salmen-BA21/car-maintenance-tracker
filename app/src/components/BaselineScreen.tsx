import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { getSetupParts, saveBaselineRecords, type SetupPart } from '../data/repositories/car-repository';
import { jsDateToLocalDate } from '../domain/local-date';
import { AppText, Button, Card, InlineError, PageHeader, TextField } from '../ui/kit';
import { useTheme } from '../ui/theme';

export function BaselineScreen({ carId, onDone }: { carId: string; onDone: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [parts, setParts] = useState<SetupPart[]>([]);
  const [values, setValues] = useState<Record<string, { km: string; date: string }>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetupParts(db, carId)
      .then((loaded) => { setParts(loaded); setValues(Object.fromEntries(loaded.map((part) => [part.id, { km: '', date: '' }]))); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load parts.'));
  }, [carId, db]);

  const update = useCallback((partId: string, field: 'km' | 'date', value: string) => {
    setValues((current) => ({ ...current, [partId]: { ...current[partId], [field]: value } }));
  }, []);

  const partNameStyle = useMemo(() => ({ fontFamily: theme.font.extrabold, fontSize: 16 }), [theme]);

  const renderItem = useCallback(({ item: part }: { item: SetupPart }) => (
    <Card style={styles.card}>
      <AppText style={partNameStyle}>{part.name}</AppText>
      <TextField
        accessibilityLabel={`${part.name} last service kilometres`}
        keyboardType="number-pad"
        onChangeText={(value) => update(part.id, 'km', value)}
        placeholder="Last km"
        suffix="km"
        value={values[part.id]?.km ?? ''}
      />
      <TextField
        accessibilityLabel={`${part.name} last service date`}
        onChangeText={(value) => update(part.id, 'date', value)}
        placeholder="YYYY-MM-DD"
        value={values[part.id]?.date ?? ''}
      />
    </Card>
  ), [partNameStyle, update, values]);

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
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ gap: 14, padding: 20, paddingBottom: 34 }}
      data={parts}
      keyExtractor={(part) => part.id}
      ListFooterComponent={
        <View style={{ gap: 12, marginTop: 8 }}>
          {error ? <InlineError>{error}</InlineError> : null}
          <Button disabled={saving} onPress={() => void save(false)} title={saving ? 'Saving…' : 'Save history'} />
          <Button disabled={saving} onPress={() => void save(true)} title="All serviced today" variant="secondary" />
        </View>
      }
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 8 }}>
          <PageHeader eyebrow="One last step" subtitle="Enter what you know. Leave a part blank to show it as unknown." title="Add service history" />
        </View>
      }
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
});

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
