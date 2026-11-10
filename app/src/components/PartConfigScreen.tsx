import { Feather } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { createCustomPart, getPartConfig, updatePart, type PartConfig } from '../data/repositories/car-repository';
import { afterWrite } from '../notifications/notification-service';
import { AppText, Button, InlineError, PageHeader, TextField } from '../ui/kit';
import { useTheme } from '../ui/theme';

type IntervalType = 'distance' | 'time' | 'both' | 'condition';

const OPTIONS: { id: IntervalType; label: string; description: string }[] = [
  { id: 'distance', label: 'Distance', description: 'Every X km' },
  { id: 'time', label: 'Time', description: 'Every X months' },
  { id: 'both', label: 'Both', description: 'Whichever comes first' },
  { id: 'condition', label: 'Inspect', description: 'Check, don’t replace' },
];

export function PartConfigScreen({ carId, partId, carName, onDone }: { carId?: string; partId?: string; carName?: string; onDone: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
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
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ gap: 22, padding: 20, paddingBottom: 34 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    >
      <PageHeader
        backLabel={editing ? 'Dashboard' : undefined}
        eyebrow={carName ?? 'Your garage'}
        onBack={editing ? onDone : undefined}
        subtitle={editing ? 'Change the name or how this part falls due.' : 'Track something outside the default maintenance list.'}
        title={editing ? 'Edit part' : 'Add a part'}
      />

      <TextField accessibilityLabel="Part name" autoCapitalize="words" label="Part name" onChangeText={setName} placeholder="e.g. AC belt" value={name} />

      <View style={{ gap: 8 }}>
        <AppText variant="label">How is it due?</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {OPTIONS.map((option) => {
            const selected = intervalType === option.id;
            return (
              <Pressable
                accessibilityLabel={`${option.label}, ${option.description}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => setIntervalType(option.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? theme.tint : theme.card,
                  borderColor: selected ? theme.highlight : theme.border,
                  borderRadius: theme.radius.card,
                  borderWidth: selected ? 2 : 1.5,
                  gap: 3,
                  minHeight: 76,
                  opacity: pressed ? 0.82 : 1,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  position: 'relative',
                  width: '48%',
                })}
              >
                <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>{option.label}</AppText>
                <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>{option.description}</AppText>
                {selected ? (
                  <View style={{ position: 'absolute', right: 10, top: 10 }}>
                    <Feather color={theme.highlight} name="check-circle" size={20} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {intervalType === 'distance' || intervalType === 'both' ? (
        <TextField accessibilityLabel="Distance interval in kilometres" keyboardType="number-pad" label="Distance interval" onChangeText={setDistance} placeholder="e.g. 20000" suffix="km" value={distance} />
      ) : null}
      {intervalType === 'time' || intervalType === 'both' ? (
        <TextField accessibilityLabel="Time interval in months" keyboardType="number-pad" label="Time interval" onChangeText={setMonths} placeholder="e.g. 12" suffix="months" value={months} />
      ) : null}
      {intervalType === 'condition' ? (
        <TextField accessibilityLabel="Inspection interval in months" keyboardType="number-pad" label="Inspection interval" onChangeText={setInspectionMonths} placeholder="e.g. 3" suffix="months" value={inspectionMonths} />
      ) : null}

      {error ? <InlineError>{error}</InlineError> : null}
      <Button disabled={saving} onPress={() => void save()} title={saving ? 'Saving…' : editing ? 'Save changes' : 'Add part'} />
    </ScrollView>
  );
}
