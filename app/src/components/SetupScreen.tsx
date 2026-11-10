import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { CarInputError } from '../data/repositories/car-input';
import { createCar } from '../data/repositories/car-repository';
import { jsDateToLocalDate } from '../domain/local-date';
import { AppText, Button, Card, InlineError, PageHeader, TextField, Toggle } from '../ui/kit';
import { useTheme } from '../ui/theme';

export function SetupScreen({ onCreated }: { onCreated: (carId: string) => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ gap: 22, padding: 20, paddingBottom: 34 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow="Your garage" subtitle="Start with the details that shape your maintenance schedule." title="Set up your car" />

        <TextField accessibilityLabel="Car name" autoCapitalize="words" label="Car name" onChangeText={setName} placeholder="e.g. Golf 4" value={name} />
        <Choices label="Fuel type" onSelect={(value) => { setFuelType(value as 'petrol' | 'diesel'); if (value === 'petrol') setHasDpf(false); }} options={[['petrol', 'Petrol'], ['diesel', 'Diesel']]} selected={fuelType} />
        <Choices label="Timing drive" onSelect={(value) => setTimingDrive(value as 'belt' | 'chain')} options={[['belt', 'Belt'], ['chain', 'Chain']]} selected={timingDrive} />
        <Choices label="Gearbox" onSelect={(value) => setGearbox(value as 'manual' | 'automatic')} options={[['manual', 'Manual'], ['automatic', 'Automatic']]} selected={gearbox} />

        <Card style={{ alignItems: 'center', flexDirection: 'row', gap: 12, paddingLeft: 18, paddingRight: 8, paddingVertical: 14 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Diesel particulate filter</AppText>
            <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>Only applies to diesel cars.</AppText>
          </View>
          <Toggle disabled={fuelType !== 'diesel'} label="Diesel particulate filter" onChange={setHasDpf} value={hasDpf} />
        </Card>

        <TextField accessibilityLabel="Current odometer in kilometres" keyboardType="number-pad" label="Current odometer" onChangeText={setOdometer} placeholder="e.g. 128500" suffix="km" value={odometer} />
        {error ? <InlineError>{error}</InlineError> : null}
        <Button disabled={saving} onPress={() => void submit()} title={saving ? 'Saving…' : 'Save car'} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Choices({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: [string, string][];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {options.map(([value, text]) => {
          const active = selected === value;
          return (
            <Pressable
              accessibilityLabel={text}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: active ? theme.tint : theme.card,
                borderColor: active ? theme.highlight : theme.border,
                borderRadius: theme.radius.field,
                borderWidth: active ? 2 : 1.5,
                flex: 1,
                height: 52,
                justifyContent: 'center',
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <AppText style={{ color: active ? theme.highlight : theme.ink, fontFamily: theme.font.bold, fontSize: 15 }}>{text}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
