import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { CarInputError } from '../data/repositories/car-input';
import { createCar } from '../data/repositories/car-repository';
import { jsDateToLocalDate } from '../domain/local-date';
import { ChoiceField, Field } from './ui';
import { colors, styles } from './uiStyles';

export function SetupScreen({ onCreated }: { onCreated: (carId: string) => void }) {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [fuelType, setFuelType] = useState<'petrol' | 'diesel'>('petrol');
  const [timingDrive, setTimingDrive] = useState<'belt' | 'chain'>('belt');
  const [gearbox, setGearbox] = useState<'manual' | 'automatic'>('manual');
  const [hasDpf, setHasDpf] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError('');
    const initialOdometerKm = Number(odometer.trim());
    if (!Number.isInteger(initialOdometerKm)) {
      setError('Enter the current odometer as a whole number.');
      return;
    }
    setSaving(true);
    try {
      const { carId } = await createCar(db, { name, fuelType, timingDrive, gearbox, hasDpf, initialOdometerKm, entryDate: jsDateToLocalDate(new Date()) });
      onCreated(carId);
    } catch (cause) {
      setError(cause instanceof CarInputError ? cause.message : 'Could not save your car. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Your garage</Text>
        <Text style={styles.title}>Set up your car</Text>
        <Text style={styles.intro}>Start with the details that shape your maintenance schedule.</Text>
        <Field label="Car name">
          <TextInput accessibilityLabel="Car name" autoCapitalize="words" onChangeText={setName} placeholder="e.g. Daily driver" placeholderTextColor={colors.muted} style={styles.input} value={name} />
        </Field>
        <ChoiceField label="Fuel type" options={[['petrol', 'Petrol'], ['diesel', 'Diesel']]} selected={fuelType} onSelect={(value) => { setFuelType(value as 'petrol' | 'diesel'); if (value === 'petrol') setHasDpf(false); }} />
        <ChoiceField label="Timing drive" options={[['belt', 'Belt'], ['chain', 'Chain']]} selected={timingDrive} onSelect={(value) => setTimingDrive(value as 'belt' | 'chain')} />
        <ChoiceField label="Gearbox" options={[['manual', 'Manual'], ['automatic', 'Automatic']]} selected={gearbox} onSelect={(value) => setGearbox(value as 'manual' | 'automatic')} />
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}><Text style={styles.label}>Diesel particulate filter</Text><Text style={styles.helper}>Only applies to diesel cars.</Text></View>
          <Switch accessibilityLabel="Diesel particulate filter" disabled={fuelType !== 'diesel'} onValueChange={setHasDpf} trackColor={{ false: colors.line, true: colors.accent }} value={hasDpf} />
        </View>
        <Field label="Current odometer (km)">
          <TextInput accessibilityLabel="Current odometer in kilometres" keyboardType="number-pad" onChangeText={setOdometer} placeholder="e.g. 128500" placeholderTextColor={colors.muted} style={styles.input} value={odometer} />
        </Field>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save car'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
