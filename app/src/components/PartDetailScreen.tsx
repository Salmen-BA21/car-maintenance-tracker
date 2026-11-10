import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';

import { addInspection, addServiceRecord, deleteCustomPart, deleteServiceRecord, getAppSettings, getPartDetail, setPartAlerts, setPartHidden, updateServiceRecord, type PartDetail } from '../data/repositories/car-repository';
import { daysBetween, jsDateToLocalDate } from '../domain/local-date';
import { afterWrite } from '../notifications/notification-service';
import { AppText, BottomSheet, Button, Card, IconButton, InlineError, PageHeader, ProgressBar, StatusPill, TextField, Toggle } from '../ui/kit';
import { formatDate, partProgress, statusTone } from '../ui/part-view';
import { useTheme } from '../ui/theme';

type Database = ReturnType<typeof useSQLiteContext>;
type ServiceRecord = PartDetail['history'][number];

export function PartDetailScreen({ partId, onBack, onEdit }: { partId: string; onBack: () => void; onEdit: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [detail, setDetail] = useState<PartDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [km, setKm] = useState('');
  const [date, setDate] = useState<string>(() => jsDateToLocalDate(new Date()));
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [defaultCurrency, setDefaultCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getPartDetail(db, partId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this part.');
    }
  }, [db, partId]);

  useEffect(() => {
    let active = true;
    getPartDetail(db, partId)
      .then((result) => { if (active) setDetail(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load this part.'); });
    getAppSettings(db)
      .then((settings) => {
        if (active) {
          setCurrency(settings.currency);
          setDefaultCurrency(settings.currency);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [db, partId]);

  async function save() {
    setError('');
    setSaving(true);
    try {
      await persistRecord(db, {
        partId,
        editingRecord: detail?.history.find((record) => record.id === editingRecordId) ?? null,
        partIsInspection: detail?.part.intervalType === 'condition',
        km,
        date,
        cost,
        currency,
        notes,
      });
      resetForm();
      await afterWrite(db);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this record.');
    } finally {
      setSaving(false);
    }
  }

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingRecordId(null);
    setKm('');
    setCost('');
    setNotes('');
    setDate(jsDateToLocalDate(new Date()));
  }, []);

  function openNewForm() {
    setError('');
    setEditingRecordId(null);
    setKm(detail?.part.intervalType === 'condition' ? '' : String(detail?.currentOdometerKm ?? ''));
    setDate(jsDateToLocalDate(new Date()));
    setCost('');
    setCurrency(defaultCurrency);
    setNotes('');
    setShowForm(true);
  }

  const startEdit = useCallback((record: ServiceRecord) => {
    setError('');
    setEditingRecordId(record.id);
    setKm(record.serviceKm?.toString() ?? '');
    setDate(record.serviceDate ?? jsDateToLocalDate(new Date()));
    setCost(record.costMinor !== null ? (record.costMinor / 100).toFixed(2) : '');
    if (record.costCurrency !== null) setCurrency(record.costCurrency);
    setNotes(record.notes ?? '');
    setShowForm(true);
  }, []);

  const removeRecord = useCallback(async (recordId: string) => {
    setError('');
    setSaving(true);
    try {
      await deleteServiceRecord(db, recordId);
      if (editingRecordId === recordId) resetForm();
      await afterWrite(db);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this record.');
    } finally {
      setSaving(false);
    }
  }, [db, editingRecordId, load, resetForm]);

  async function removeCustomPart() {
    setError('');
    setDeleting(true);
    try {
      await deleteCustomPart(db, partId);
      await afterWrite(db);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this part.');
    } finally {
      setDeleting(false);
    }
  }

  async function hidePart() {
    setError('');
    setConfiguring(true);
    try {
      await setPartHidden(db, partId, true);
      await afterWrite(db);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not hide this part.');
    } finally {
      setConfiguring(false);
    }
  }

  async function toggleAlerts(enabled: boolean) {
    setError('');
    setConfiguring(true);
    try {
      await setPartAlerts(db, partId, enabled);
      await afterWrite(db);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change alerts for this part.');
    } finally {
      setConfiguring(false);
    }
  }

  const renderItem = useCallback(({ item }: { item: ServiceRecord }) => (
    <HistoryRow onDelete={removeRecord} onEdit={startEdit} record={item} />
  ), [removeRecord, startEdit]);

  if (!detail) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <AppText variant="display">{error || 'Loading part…'}</AppText>
      </View>
    );
  }

  const { part } = detail;
  const isInspection = part.intervalType === 'condition';
  const editingRecord = detail.history.find((record) => record.id === editingRecordId) ?? null;
  const formInspection = editingRecord ? editingRecord.kind === 'inspection' : isInspection;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ gap: 14, padding: 20, paddingBottom: 40 }}
        data={detail.history}
        keyExtractor={(record) => record.id}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <PageHeader
              backLabel="Dashboard"
              eyebrow={`${part.categoryName} · ${detail.carName}`}
              onBack={onBack}
              title={part.name}
            />

            <PartActions
              configuring={configuring}
              deleting={deleting}
              onDelete={() => void removeCustomPart()}
              onEdit={onEdit}
              onHide={() => void hidePart()}
              part={part}
            />

            {error ? <InlineError>{error}</InlineError> : null}

            <PartSummaryCard currentOdometerKm={detail.currentOdometerKm} part={part} />

            <Card style={{ alignItems: 'center', flexDirection: 'row', gap: 12, paddingLeft: 18, paddingRight: 8, paddingVertical: 14 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>Alerts</AppText>
                <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13, lineHeight: 18 }}>
                  Include this part in reminders and due-date alerts.
                </AppText>
              </View>
              <Toggle label={`Alerts for ${part.name}`} onChange={(value) => void toggleAlerts(value)} value={part.includeInReminders} />
            </Card>

            <Button disabled={showForm} icon="plus" onPress={openNewForm} title={isInspection ? 'Record inspection' : 'Record service'} />

            <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <AppText variant="section">History</AppText>
              <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>
                {detail.history.length} {detail.history.length === 1 ? 'record' : 'records'}
              </AppText>
            </View>
          </View>
        }
        renderItem={renderItem}
      />

      <BottomSheet
        onClose={resetForm}
        subtitle={part.name}
        title={recordSheetTitle(editingRecordId, formInspection)}
        visible={showForm}
      >
        <RecordFields
          cost={cost}
          currency={currency}
          currentOdometerKm={detail.currentOdometerKm}
          date={date}
          error={error}
          formInspection={formInspection}
          km={km}
          notes={notes}
          onCostChange={setCost}
          onDateChange={setDate}
          onKmChange={setKm}
          onNotesChange={setNotes}
        />

        <Button disabled={saving} onPress={() => void save()} title={saving ? 'Saving…' : formInspection ? 'Save inspection' : 'Save service'} />
      </BottomSheet>
    </View>
  );
}

function PartActions({
  part,
  deleting,
  configuring,
  onDelete,
  onEdit,
  onHide,
}: {
  part: PartDetail['part'];
  deleting: boolean;
  configuring: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onHide: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button icon="edit-2" onPress={onEdit} style={{ flex: 1, minHeight: 44 }} title="Edit" variant="secondary" />
      {part.isCustom ? (
        <Button
          disabled={deleting}
          icon="trash-2"
          onPress={() => Alert.alert('Delete custom part?', 'Its history will be kept but it will disappear from the dashboard.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }])}
          style={{ flex: 1, minHeight: 44 }}
          title={deleting ? 'Deleting…' : 'Delete'}
          variant="danger"
        />
      ) : (
        <Button
          disabled={configuring}
          icon="eye-off"
          onPress={() => Alert.alert('Hide this part?', 'It leaves the dashboard until you show it again. Its history is kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Hide', style: 'destructive', onPress: onHide }])}
          style={{ flex: 1, minHeight: 44 }}
          title={configuring ? 'Hiding…' : 'Hide'}
          variant="danger"
        />
      )}
    </View>
  );
}

function recordSheetTitle(editingRecordId: string | null, formInspection: boolean): string {
  if (editingRecordId) return formInspection ? 'Edit inspection' : 'Edit service';
  return formInspection ? 'Record inspection' : 'Record service';
}

function PartSummaryCard({ part, currentOdometerKm }: { part: PartDetail['part']; currentOdometerKm: number }) {
  const theme = useTheme();
  const isInspection = part.intervalType === 'condition';
  const tone = statusTone(part.status, theme);
  const progress = partProgress(part);
  const sinceService = part.serviceKm === null ? null : currentOdometerKm - part.serviceKm;
  const deadline = deadlineLabel(part);
  const countdown = countdownFor(part);

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
        <StatusPill status={part.status} />
        <AppText color={theme.muted} style={{ flexShrink: 1, fontFamily: theme.font.bold, fontSize: 14, textAlign: 'right' }}>
          {deadline}
        </AppText>
      </View>

      <View style={{ alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {countdown !== null ? (
          <>
            <AppText maxFontSizeMultiplier={1.2} style={{ fontFamily: theme.font.number, fontSize: 44, letterSpacing: -1.3, lineHeight: 46 }}>
              {countdown.value.toLocaleString()}
            </AppText>
            <AppText color={theme.muted} style={{ flexShrink: 1, fontFamily: theme.font.bold, fontSize: 16 }}>
              {countdown.unit}
            </AppText>
          </>
        ) : (
          <AppText color={theme.muted} style={{ fontFamily: theme.font.bold, fontSize: 16 }}>
            {isInspection ? 'Record an inspection to start the cycle.' : 'Add a service record to start tracking.'}
          </AppText>
        )}
      </View>

      {progress !== null ? <ProgressBar color={tone.fg} percent={progress} /> : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>Since last service</AppText>
          <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>
            {sinceService === null ? '—' : `${sinceService.toLocaleString()} km`}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>Serviced at</AppText>
          <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>
            {part.serviceKm === null ? '—' : `${part.serviceKm.toLocaleString()} km`}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

function deadlineLabel(part: PartDetail['part']): string {
  if (part.intervalType === 'condition') {
    return part.inspectionDueDate ? `Inspect by ${formatDate(part.inspectionDueDate)}` : 'Inspection not scheduled';
  }
  return part.dueDate ? `Due ${formatDate(part.dueDate)}` : 'No due date yet';
}

function countdownFor(part: PartDetail['part']): { value: number; unit: string } | null {
  const isInspection = part.intervalType === 'condition';
  const days = isInspection
    ? part.inspectionDueDate === null ? null : daysBetween(jsDateToLocalDate(new Date()), part.inspectionDueDate)
    : part.remainingDays;
  if (days !== null) {
    const unit = days >= 0 ? (isInspection ? 'days until inspection' : 'days left') : 'days overdue';
    return { value: Math.abs(days), unit };
  }
  if (part.remainingKm !== null) {
    return { value: Math.abs(part.remainingKm), unit: part.remainingKm >= 0 ? 'km left' : 'km over' };
  }
  return null;
}

function HistoryRow({ record, onEdit, onDelete }: { record: ServiceRecord; onEdit: (record: ServiceRecord) => void; onDelete: (recordId: string) => void }) {
  const theme = useTheme();
  return (
    <Card style={{ alignItems: 'center', flexDirection: 'row', gap: 8, paddingLeft: 18, paddingRight: 8, paddingVertical: 10 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>
          {record.kind === 'inspection' ? 'Inspection' : record.isBaseline ? 'Initial service' : 'Service'}
        </AppText>
        <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>
          {record.serviceDate ? formatDate(record.serviceDate) : 'Date unknown'}
          {record.serviceKm === null ? '' : ` · ${record.serviceKm.toLocaleString()} km`}
          {record.costMinor !== null ? ` · ${(record.costMinor / 100).toFixed(2)} ${record.costCurrency}` : ''}
        </AppText>
      </View>
      <IconButton icon="edit-2" label="Edit service record" onPress={() => onEdit(record)} variant="bare" />
      <IconButton
        icon="trash-2"
        label="Delete service record"
        onPress={() => Alert.alert('Delete this record?', 'The counters will fall back to the previous record.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => onDelete(record.id) }])}
        variant="bare"
      />
    </Card>
  );
}

function RecordFields({
  formInspection,
  date,
  onDateChange,
  cost,
  onCostChange,
  km,
  onKmChange,
  notes,
  onNotesChange,
  currency,
  currentOdometerKm,
  error,
}: {
  formInspection: boolean;
  date: string;
  onDateChange: (value: string) => void;
  cost: string;
  onCostChange: (value: string) => void;
  km: string;
  onKmChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  currency: string;
  currentOdometerKm: number;
  error: string;
}) {
  const theme = useTheme();
  return (
    <>
      <TextField
        accessibilityLabel={formInspection ? 'Inspection date, YYYY-MM-DD' : 'Service date, YYYY-MM-DD'}
        label="Date"
        onChangeText={onDateChange}
        placeholder="YYYY-MM-DD"
        value={date}
      />

      {formInspection ? null : (
        <>
          <TextField
            accessibilityLabel="Service cost, optional"
            keyboardType="decimal-pad"
            label="Cost"
            onChangeText={onCostChange}
            optional
            placeholder="0.00"
            suffix={currency}
            value={cost}
          />
          <TextField
            accessibilityLabel="Service kilometres"
            keyboardType="number-pad"
            label="Odometer at service"
            onChangeText={onKmChange}
            placeholder={String(currentOdometerKm)}
            suffix="km"
            value={km}
          />
          <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>
            Pre-filled with your current odometer.
          </AppText>
          <TextField
            accessibilityLabel="Service notes, optional"
            label="Notes"
            onChangeText={onNotesChange}
            optional
            placeholder="e.g. oil grade, workshop"
            value={notes}
          />
        </>
      )}

      {error ? <InlineError>{error}</InlineError> : null}
    </>
  );
}

async function persistRecord(db: Database, draft: {
  partId: string;
  editingRecord: ServiceRecord | null;
  partIsInspection: boolean;
  km: string;
  date: string;
  cost: string;
  currency: string;
  notes: string;
}): Promise<void> {
  const { editingRecord, partIsInspection } = draft;
  const editingInspection = editingRecord ? editingRecord.kind === 'inspection' : partIsInspection;
  const costValue = draft.cost.trim() ? Number(draft.cost) : null;
  if (costValue !== null && !Number.isFinite(costValue)) throw new Error('Enter a valid cost.');
  if (editingRecord) {
    await updateServiceRecord(db, editingRecord.id, {
      serviceKm: editingInspection || !draft.km.trim() ? null : Number(draft.km.trim()),
      serviceDate: draft.date as `${number}-${number}-${number}`,
      costMinor: editingInspection || costValue === null ? null : Math.round(costValue * 100),
      costCurrency: editingInspection || costValue === null ? null : draft.currency.trim().toUpperCase(),
      notes: editingInspection ? null : draft.notes.trim() || null,
    });
    return;
  }
  if (partIsInspection) {
    await addInspection(db, { partId: draft.partId, inspectionDate: draft.date as `${number}-${number}-${number}` });
    return;
  }
  await addServiceRecord(db, {
    partId: draft.partId,
    serviceKm: draft.km.trim() ? Number(draft.km.trim()) : null,
    serviceDate: draft.date as `${number}-${number}-${number}`,
    costMinor: costValue === null ? null : Math.round(costValue * 100),
    costCurrency: costValue === null ? null : draft.currency.trim().toUpperCase(),
    notes: draft.notes.trim() || null,
  });
}
