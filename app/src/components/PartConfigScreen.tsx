import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';

import { createCustomPart, getPartConfig, updatePart, type PartConfig } from '../data/repositories/car-repository';
import { afterWrite } from '../notifications/notification-service';
import { ChoiceField, Field } from './ui';
import { colors, styles } from './uiStyles';

type IntervalType = 'distance' | 'time' | 'both' | 'condition';

export function PartConfigScreen({ carId, partId, onDone }: { carId?: string; partId?: string; onDone: () => void }) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [intervalType, setIntervalType] = useState<IntervalType>('distance');
  const [distance, setDistance] = useState('');
  const [months, setMonths] = useState('');
  const [inspectionMonths, setInspectionMonths] = useState('3');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = partId !== undefined;

  useEffect(() => {
    if (!partId) return;
    getPartConfig(db, partId)
      .then((part: PartConfig) => {
        setName(part.name);
        setIntervalType(part.intervalType);
        setDistance(part.distanceKm?.toString() ?? '');
        setMonths(part.months?.toString() ?? '');
        setInspectionMonths(part.inspectionMonths?.toString() ?? '');
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load the part.'));
  }, [db, partId]);

  async function save() {
    setError('');
    setSaving(true);
    try {
      const input = {
        name,
        intervalType,
        distanceKm: (intervalType === 'distance' || intervalType === 'both') && distance.trim() ? Number(distance.trim()) : null,
        months: (intervalType === 'time' || intervalType === 'both') && months.trim() ? Number(months.trim()) : null,
        inspectionMonths: intervalType === 'condition' && inspectionMonths.trim() ? Number(inspectionMonths.trim()) : null,
      };
      if (partId) await updatePart(db, partId, input);
      else if (carId) await createCustomPart(db, { carId, ...input });
      else throw new Error('Could not identify your car.');
      await afterWrite(db);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the part.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onDone}><Text style={styles.linkText}>Back to dashboard</Text></Pressable>
      <Text style={styles.kicker}>Your garage</Text>
      <Text style={styles.title}>{editing ? 'Edit part' : 'Add a part'}</Text>
      <Text style={styles.intro}>{editing ? 'Change the name or how this part falls due.' : 'Track something outside the default maintenance list.'}</Text>
      <Field label="Part name">
        <TextInput accessibilityLabel="Part name" autoCapitalize="words" onChangeText={setName} placeholder="e.g. AC belt" placeholderTextColor={colors.muted} style={styles.input} value={name} />
      </Field>
      <ChoiceField
        label="How is it due?"
        options={[['distance', 'Distance'], ['time', 'Time'], ['both', 'Both'], ['condition', 'Inspect']]}
        selected={intervalType}
        onSelect={(value) => setIntervalType(value as IntervalType)}
      />
      {intervalType === 'distance' || intervalType === 'both' ? <Field label="Distance interval (km)"><TextInput accessibilityLabel="Distance interval in kilometres" keyboardType="number-pad" onChangeText={setDistance} placeholder="e.g. 20000" placeholderTextColor={colors.muted} style={styles.input} value={distance} /></Field> : null}
      {intervalType === 'time' || intervalType === 'both' ? <Field label="Time interval (months)"><TextInput accessibilityLabel="Time interval in months" keyboardType="number-pad" onChangeText={setMonths} placeholder="e.g. 12" placeholderTextColor={colors.muted} style={styles.input} value={months} /></Field> : null}
      {intervalType === 'condition' ? <Field label="Inspection interval (months)"><TextInput accessibilityLabel="Inspection interval in months" keyboardType="number-pad" onChangeText={setInspectionMonths} placeholder="e.g. 3" placeholderTextColor={colors.muted} style={styles.input} value={inspectionMonths} /></Field> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save part changes' : 'Add custom part'} accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={save} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add part'}</Text></Pressable>
    </ScrollView>
  );
}
