import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';

import { createCustomPart, getCustomPart, updateCustomPart, type CustomPart } from '../data/repositories/car-repository';
import { ChoiceField, Field } from './ui';
import { colors, styles } from './uiStyles';

type IntervalType = 'distance' | 'time' | 'both' | 'condition';

export function CustomPartScreen({ carId, partId, onDone }: { carId?: string; partId?: string; onDone: () => void }) {
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
    getCustomPart(db, partId)
      .then((part: CustomPart) => {
        setName(part.name);
        setIntervalType(part.intervalType);
        setDistance(part.distanceKm?.toString() ?? '');
        setMonths(part.months?.toString() ?? '');
        setInspectionMonths(part.inspectionMonths?.toString() ?? '');
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load the custom part.'));
  }, [db, partId]);

  async function save() {
    setError('');
    setSaving(true);
    try {
      const input = {
        name,
        intervalType,
        distanceKm: intervalType === 'distance' || intervalType === 'both' ? Number(distance) : null,
        months: intervalType === 'time' || intervalType === 'both' ? Number(months) : null,
        inspectionMonths: intervalType === 'condition' ? Number(inspectionMonths) : null,
      };
      if (partId) await updateCustomPart(db, partId, input);
      else if (carId) await createCustomPart(db, { carId, ...input });
      else throw new Error('Could not identify your car.');
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the custom part.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onDone}><Text style={styles.linkText}>Back to dashboard</Text></Pressable>
      <Text style={styles.kicker}>Your garage</Text>
      <Text style={styles.title}>{editing ? 'Edit part' : 'Add a part'}</Text>
      <Text style={styles.intro}>Track something outside the default maintenance list.</Text>
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
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save custom part changes' : 'Add custom part'} accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={save} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add part'}</Text></Pressable>
    </ScrollView>
  );
}
