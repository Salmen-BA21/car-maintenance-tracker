import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { addServiceRecord, deleteCustomPart, getPartDetail, type PartDetail } from '../data/repositories/car-repository';
import { jsDateToLocalDate } from '../domain/local-date';
import { colors, styles } from './uiStyles';

export function PartDetailScreen({ partId, onBack, onEdit }: { partId: string; onBack: () => void; onEdit: () => void }) {
  const db = useSQLiteContext();
  const [detail, setDetail] = useState<PartDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [km, setKm] = useState('');
  const [date, setDate] = useState<string>(() => jsDateToLocalDate(new Date()));
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setDetail(await getPartDetail(db, partId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this part.');
    }
  }
  useEffect(() => {
    let active = true;
    getPartDetail(db, partId)
      .then((result) => { if (active) setDetail(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load this part.'); });
    return () => { active = false; };
  }, [db, partId]);

  async function save() {
    setError('');
    setSaving(true);
    try {
      await addServiceRecord(db, {
        partId,
        serviceKm: Number(km.trim()),
        serviceDate: date as `${number}-${number}-${number}`,
        costMinor: cost.trim() ? Math.round(Number(cost) * 100) : null,
        costCurrency: cost.trim() ? currency.trim().toUpperCase() : null,
        notes: notes.trim() || null,
      });
      setShowForm(false);
      setKm('');
      setCost('');
      setNotes('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this record.');
    } finally {
      setSaving(false);
    }

  }

  async function removeCustomPart() {
    setError('');
    setDeleting(true);
    try {
      await deleteCustomPart(db, partId);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this part.');
    } finally {
      setDeleting(false);
    }
  }

  if (!detail) return <View style={styles.loading}><Text style={styles.title}>{error || 'Loading part…'}</Text></View>;
  const { part } = detail;
  const statusLabel = part.status === 'DueSoon' ? 'Due soon' : part.status === 'SetInterval' ? 'Set interval' : part.status;
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={detail.history}
      keyExtractor={(record) => record.id}
      ListHeaderComponent={
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onBack}><Text style={styles.linkText}>Back to dashboard</Text></Pressable>
          <Text style={styles.kicker}>{part.categoryName}</Text>
          <Text style={styles.title}>{part.name}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {part.isCustom ? <View style={styles.actionRow}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${part.name}`} onPress={onEdit}><Text style={styles.linkText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${part.name}`} accessibilityState={{ disabled: deleting, busy: deleting }} disabled={deleting} onPress={() => Alert.alert('Delete custom part?', 'Its history will be kept but it will disappear from the dashboard.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: removeCustomPart }])}><Text style={styles.dangerText}>{deleting ? 'Deleting…' : 'Delete'}</Text></Pressable></View> : null}
          <Text style={styles.statusLarge}>{statusLabel}</Text>
          <Text style={styles.intro}>{part.remainingKm !== null ? `${part.remainingKm.toLocaleString()} km remaining` : part.dueDate ? `Due ${part.dueDate}` : 'Add a service record to start tracking.'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={showForm ? 'Cancel service record' : 'Record service'} onPress={() => setShowForm((value) => !value)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{showForm ? 'Cancel' : 'Record service'}</Text></Pressable>
          {showForm ? <ServiceRecordForm
            currency={currency}
            cost={cost}
            date={date}
            error={error}
            km={km}
            notes={notes}
            onChangeCurrency={setCurrency}
            onChangeCost={setCost}
            onChangeDate={setDate}
            onChangeKm={setKm}
            onChangeNotes={setNotes}
            onSave={save}
            saving={saving}
          /> : null}
          <Text style={styles.sectionTitle}>History</Text>
        </View>
      }

      renderItem={renderHistory}
    />
  );

  function renderHistory({ item }: { item: PartDetail['history'][number] }) {
    return <View style={styles.historyRow}><View><Text style={styles.partName}>{item.isBaseline ? 'Initial' : 'Service'}</Text><Text style={styles.helper}>{item.serviceDate ?? 'Date unknown'} · {item.serviceKm === null ? 'km unknown' : `${item.serviceKm.toLocaleString()} km`}</Text></View>{item.costMinor !== null ? <Text style={styles.helper}>{(item.costMinor / 100).toFixed(2)} {item.costCurrency}</Text> : null}</View>;
  }
}

function ServiceRecordForm({
    currency,
    cost,
    date,
    error,
    km,
    notes,
    onChangeCurrency,
    onChangeCost,
    onChangeDate,
    onChangeKm,
    onChangeNotes,
    onSave,
    saving,
  }: {
    currency: string;
    cost: string;
    date: string;
    error: string;
    km: string;
    notes: string;
    onChangeCurrency: (value: string) => void;
    onChangeCost: (value: string) => void;
    onChangeDate: (value: string) => void;
    onChangeKm: (value: string) => void;
    onChangeNotes: (value: string) => void;
    onSave: () => void;
    saving: boolean;
  }) {
    return (
      <View style={styles.formPanel}>
        <Text style={styles.label}>Service km</Text><TextInput accessibilityLabel="Service kilometres" keyboardType="number-pad" onChangeText={onChangeKm} placeholder="e.g. 128500" placeholderTextColor={colors.muted} style={styles.input} value={km} />
        <Text style={styles.label}>Service date</Text><TextInput accessibilityLabel="Service date, YYYY-MM-DD" onChangeText={onChangeDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={date} />
        <Text style={styles.label}>Cost (optional)</Text><TextInput accessibilityLabel="Service cost, optional" keyboardType="decimal-pad" onChangeText={onChangeCost} placeholder="e.g. 89.90" placeholderTextColor={colors.muted} style={styles.input} value={cost} />
        {cost ? <TextInput accessibilityLabel="Currency code" autoCapitalize="characters" maxLength={3} onChangeText={onChangeCurrency} placeholder="EUR" placeholderTextColor={colors.muted} style={styles.input} value={currency} /> : null}
        <Text style={styles.label}>Notes (optional)</Text><TextInput accessibilityLabel="Service notes, optional" onChangeText={onChangeNotes} placeholder="What was done?" placeholderTextColor={colors.muted} style={styles.input} value={notes} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Save service record" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={onSave} style={({ pressed }) => [styles.smallButton, pressed && styles.pressed, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save record'}</Text></Pressable>
      </View>
    );
}
