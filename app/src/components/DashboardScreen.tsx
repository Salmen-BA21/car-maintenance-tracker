import { Feather } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Pressable, useWindowDimensions, View } from 'react-native';

import { deleteOdometerEntry, getAppSettings, getDashboard, getOdometerHistory, setPartHidden, updateOdometer, updateOdometerEntry, type DashboardData, type DashboardPart, type OdometerEntry } from '../data/repositories/car-repository';
import { needsAttention } from '../domain/attention';
import type { PartStatus } from '../domain/status';
import { afterWrite, getNotificationPermissionStatus } from '../notifications/notification-service';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  IconButton,
  InlineError,
  Notice,
  ProgressBar,
  StatusPill,
  TextField,
} from '../ui/kit';
import { formatDate, partDetailLine, partIcon, partProgress, statusTone, summaryCounts } from '../ui/part-view';
import { useTheme } from '../ui/theme';
import { OdometerSheet } from './OdometerSheet';

export function DashboardScreen({
  onPartPress,
  onAddPart,
  onEditPart,
  onSettings,
}: {
  onPartPress: (partId: string) => void;
  onAddPart: () => void;
  onEditPart: (partId: string) => void;
  onSettings: () => void;
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [odometerOpen, setOdometerOpen] = useState(false);
  const [odometerError, setOdometerError] = useState('');
  const [savingOdometer, setSavingOdometer] = useState(false);
  const [history, setHistory] = useState<OdometerEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryValue, setEntryValue] = useState('');
  const [newlyUrgent, setNewlyUrgent] = useState<DashboardPart[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reminderDenied, setReminderDenied] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async (): Promise<DashboardData | null> => {
    try {
      setError('');
      const next = await getDashboard(db);
      setData(next);
      setHistory(await getOdometerHistory(db, next.carId));
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.');
      return null;
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    getDashboard(db)
      .then(async (result) => {
        const odometerHistory = await getOdometerHistory(db, result.carId);
        if (active) {
          setData(result);
          setHistory(odometerHistory);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.');
      });
    return () => { active = false; };
  }, [db]);

  useEffect(() => {
    let active = true;
    const checkPermission = () => {
      Promise.all([getAppSettings(db), getNotificationPermissionStatus()])
        .then(([settings, status]) => {
          if (active) setReminderDenied(settings.remindersEnabled && status === 'denied');
        })
        .catch(() => undefined);
    };
    checkPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });
    return () => { active = false; subscription.remove(); };
  }, [db]);

  const snapshotStatuses = useCallback(
    () => new Map((data?.parts ?? []).map((part) => [part.id, part.status])),
    [data],
  );

  const refreshWithNotice = useCallback(
    async (previous: Map<string, PartStatus>) => {
      const next = await load();
      if (next) {
        setNewlyUrgent(next.parts.filter((part) => isUrgent(part.status) && !isUrgent(previous.get(part.id))));
      }
    },
    [load],
  );

  async function saveOdometer(value: number) {
    if (!data) return;
    try {
      setOdometerError('');
      setSavingOdometer(true);
      setNewlyUrgent([]);
      const previous = snapshotStatuses();
      await updateOdometer(db, data.carId, value);
      await afterWrite(db);
      setOdometerOpen(false);
      await refreshWithNotice(previous);
    } catch (cause) {
      setOdometerError(cause instanceof Error ? cause.message : 'Could not save the odometer.');
    } finally {
      setSavingOdometer(false);
    }
  }

  async function saveEntry() {
    if (editingEntryId === null) return;
    try {
      setError('');
      setNewlyUrgent([]);
      const previous = snapshotStatuses();
      if (!entryValue.trim()) throw new Error('Enter a mileage value.');
      await updateOdometerEntry(db, editingEntryId, Number(entryValue.trim()));
      setEditingEntryId(null);
      setEntryValue('');
      await afterWrite(db);
      await refreshWithNotice(previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not edit the mileage entry.');
    }
  }

  async function removeEntry(entryId: string) {
    try {
      setError('');
      setNewlyUrgent([]);
      const previous = snapshotStatuses();
      await deleteOdometerEntry(db, entryId);
      await afterWrite(db);
      await refreshWithNotice(previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the mileage entry.');
    }
  }

  async function restorePart(partId: string) {
    try {
      setError('');
      await setPartHidden(db, partId, false);
      await afterWrite(db);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not show this part.');
    }
  }

  const attention = useMemo(() => needsAttention(data?.parts ?? []), [data]);
  const summary = useMemo(() => summaryCounts(data?.parts ?? []), [data]);
  const groups = useMemo(() => {
    const grouped = new Map<string, DashboardPart[]>();
    for (const part of data?.parts ?? []) grouped.set(part.categoryName, [...(grouped.get(part.categoryName) ?? []), part]);
    return [...grouped.entries()];
  }, [data]);

  const renderCategory = useCallback(
    ({ item: [category, parts] }: { item: [string, DashboardPart[]] }) => (
      <View style={{ marginTop: 10 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Pressable
            accessibilityLabel={`${collapsed[category] ? 'Expand' : 'Collapse'} ${category}`}
            accessibilityRole="button"
            onPress={() => setCollapsed((current) => ({ ...current, [category]: !current[category] }))}
            style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minHeight: 44, minWidth: 0 }}
          >
            <AppText numberOfLines={1} style={{ flexShrink: 1 }} variant="section">{category}</AppText>
            <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>
              {parts.length} part{parts.length === 1 ? '' : 's'}
            </AppText>
            <Feather color={theme.muted} name={collapsed[category] ? 'chevron-down' : 'chevron-up'} size={16} />
          </Pressable>
          <Button icon="plus" onPress={onAddPart} style={{ flexShrink: 0, minHeight: 44, paddingHorizontal: 14 }} title="Add part" variant="quiet" />
        </View>
        <View style={{ gap: 10 }}>
          {collapsed[category] ? null : parts.map((part) => (
            <PartCard
              key={part.id}
              onAddRecord={() => onPartPress(part.id)}
              onEditInterval={() => onEditPart(part.id)}
              onPress={() => onPartPress(part.id)}
              part={part}
            />
          ))}
        </View>
      </View>
    ),
    [collapsed, onAddPart, onEditPart, onPartPress, theme],
  );

  if (error && !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <AppText variant="display">Dashboard unavailable</AppText>
        <AppText color={theme.muted} style={{ marginTop: 12 }}>{error}</AppText>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <AppText variant="display">Loading your garage…</AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
        data={groups}
        keyExtractor={([category]) => category}
        ListHeaderComponent={
          <DashboardHeader
            attention={attention}
            data={data}
            error={error}
            historyCount={history.length}
            newlyUrgent={newlyUrgent}
            onAddPart={onAddPart}
            onDismissUrgent={() => setNewlyUrgent([])}
            onEditPart={onEditPart}
            onOpenHistory={() => setHistoryOpen(true)}
            onPartPress={onPartPress}
            onRestorePart={(partId) => void restorePart(partId)}
            onSettings={onSettings}
            onToggleHidden={() => setShowHidden((value) => !value)}
            onUpdateOdometer={() => {
              setOdometerError('');
              setOdometerOpen(true);
            }}
            reminderDenied={reminderDenied}
            showHidden={showHidden}
            summary={summary}
          />
        }
        renderItem={renderCategory}
      />

      <OdometerSheet
        key={odometerOpen ? 'open' : 'closed'}
        current={data.currentOdometerKm}
        error={odometerError}
        lastDate={history[0]?.entryDate ?? null}
        onClose={() => setOdometerOpen(false)}
        onSave={(value) => void saveOdometer(value)}
        saving={savingOdometer}
        visible={odometerOpen}
      />

      <BottomSheet
        onClose={() => {
          setHistoryOpen(false);
          setEditingEntryId(null);
          setEntryValue('');
        }}
        subtitle={`${history.length} ${history.length === 1 ? 'entry' : 'entries'}`}
        title="Mileage history"
        visible={historyOpen}
      >
        {history.map((entry, index) => (
          editingEntryId === entry.id ? (
            <View key={entry.id} style={{ gap: 10 }}>
              <TextField
                accessibilityLabel="Edited odometer in kilometres"
                keyboardType="number-pad"
                onChangeText={setEntryValue}
                placeholder="New km"
                value={entryValue}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button onPress={() => void saveEntry()} style={{ flex: 1 }} title="Save" />
                <Button onPress={() => { setEditingEntryId(null); setEntryValue(''); }} style={{ flex: 1 }} title="Cancel" variant="secondary" />
              </View>
            </View>
          ) : (
            <View key={entry.id} style={{ alignItems: 'center', borderBottomColor: theme.line, borderBottomWidth: index === history.length - 1 ? 0 : 1, flexDirection: 'row', gap: 8, paddingBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 16 }}>{entry.valueKm.toLocaleString()} km</AppText>
                <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>{formatDate(entry.entryDate)}</AppText>
              </View>
              {index === 0 ? (
                <>
                  <IconButton icon="edit-2" label="Edit latest mileage entry" onPress={() => { setEditingEntryId(entry.id); setEntryValue(String(entry.valueKm)); }} variant="bare" />
                  <IconButton
                    icon="trash-2"
                    label="Delete latest mileage entry"
                    onPress={() => Alert.alert('Delete mileage entry?', `Remove ${entry.valueKm.toLocaleString()} km from the history?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeEntry(entry.id) }])}
                    variant="bare"
                  />
                </>
              ) : null}
            </View>
          )
        ))}
      </BottomSheet>
    </View>
  );
}

function DashboardHeader({
  data,
  error,
  summary,
  attention,
  newlyUrgent,
  reminderDenied,
  showHidden,
  historyCount,
  onAddPart,
  onDismissUrgent,
  onEditPart,
  onOpenHistory,
  onPartPress,
  onRestorePart,
  onSettings,
  onToggleHidden,
  onUpdateOdometer,
}: {
  data: DashboardData;
  error: string;
  summary: { upToDate: number; needRecord: number };
  attention: DashboardPart[];
  newlyUrgent: DashboardPart[];
  reminderDenied: boolean;
  showHidden: boolean;
  historyCount: number;
  onAddPart: () => void;
  onDismissUrgent: () => void;
  onEditPart: (partId: string) => void;
  onOpenHistory: () => void;
  onPartPress: (partId: string) => void;
  onRestorePart: (partId: string) => void;
  onSettings: () => void;
  onToggleHidden: () => void;
  onUpdateOdometer: () => void;
}) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // Web ignores adjustsFontSizeToFit, so size the number to the room beside the button.
  // 214 = list + card padding, Update pill, gap and km unit; 0.56em per digit is a safe estimate.
  const odometerRoom = Math.min(windowWidth, 640) - 214;
  const odometerDigits = data.currentOdometerKm.toLocaleString().length;
  const odometerFontSize = Math.max(26, Math.min(46, Math.floor(odometerRoom / (odometerDigits * 0.56))));

  return (
    <View>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <AppText variant="eyebrow">Your garage</AppText>
          <AppText numberOfLines={1} style={{ fontFamily: theme.font.extrabold, fontSize: 28, letterSpacing: -0.5 }}>{data.carName}</AppText>
        </View>
        <IconButton icon="settings" label="Open settings" onPress={onSettings} />
      </View>

      <View style={{ backgroundColor: theme.accent, borderRadius: 20, gap: 18, marginTop: 18, paddingBottom: 18, paddingHorizontal: 22, paddingTop: 22 }}>
        <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <AppText style={{ color: 'rgba(255,255,255,0.82)', fontFamily: theme.font.semibold, fontSize: 13 }}>Odometer</AppText>
            <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8, minWidth: 0 }}>
              <AppText
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                numberOfLines={1}
                style={{ color: theme.onAccent, flexShrink: 1, fontFamily: theme.font.number, fontSize: odometerFontSize, letterSpacing: -1.4 }}
                variant="number"
              >
                {data.currentOdometerKm.toLocaleString()}
              </AppText>
              <AppText style={{ color: 'rgba(255,255,255,0.82)', fontFamily: theme.font.bold, fontSize: 16 }}>km</AppText>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Update odometer"
            accessibilityRole="button"
            onPress={onUpdateOdometer}
            style={({ pressed }) => ({
              backgroundColor: theme.onAccent,
              borderRadius: 22,
              height: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.82 : 1,
              paddingHorizontal: 18,
            })}
          >
            {/* The pill stays white in both themes, so the label stays dark. */}
            <AppText style={{ color: '#1B1512', fontFamily: theme.font.extrabold, fontSize: 15 }}>Update</AppText>
          </Pressable>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.28)', height: 1 }} />
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
          <AppText style={{ color: 'rgba(255,255,255,0.82)', flex: 1, fontFamily: theme.font.semibold, fontSize: 13 }}>
            {historyCount} mileage {historyCount === 1 ? 'entry' : 'entries'} logged
          </AppText>
          <Pressable accessibilityLabel="View mileage history" accessibilityRole="button" onPress={onOpenHistory} style={{ alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 32 }}>
            <AppText style={{ color: theme.onAccent, fontFamily: theme.font.bold, fontSize: 13 }}>View history</AppText>
            <Feather color={theme.onAccent} name="chevron-right" size={14} />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <SummaryTile color={theme.ok} label="Up to date" value={summary.upToDate} />
        <SummaryTile color={theme.warn} label="Need a record" value={summary.needRecord} />
      </View>

      {error ? <View style={{ marginTop: 14 }}><InlineError>{error}</InlineError></View> : null}

      {reminderDenied ? (
        <View style={{ marginTop: 14 }}>
          <Notice title="Reminders are blocked">
            <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 14 }}>Allow notifications in your device settings to get maintenance reminders.</AppText>
            <Pressable accessibilityLabel="Open device settings" accessibilityRole="button" onPress={() => void Linking.openSettings()} style={{ minHeight: 44, justifyContent: 'center' }}>
              <AppText color={theme.link} style={{ fontFamily: theme.font.extrabold, fontSize: 14 }}>Open settings</AppText>
            </Pressable>
          </Notice>
        </View>
      ) : null}

      {newlyUrgent.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Notice title={newlyUrgent.length === 1 ? '1 part is newly urgent' : `${newlyUrgent.length} parts are newly urgent`}>
            {newlyUrgent.map((part) => (
              <AppText color={theme.muted} key={part.id} style={{ fontFamily: theme.font.semibold, fontSize: 14 }}>
                {part.name}: {part.status === 'Overdue' ? 'overdue' : 'due soon'}
              </AppText>
            ))}
            <Pressable accessibilityLabel="Dismiss notice" accessibilityRole="button" onPress={onDismissUrgent} style={{ minHeight: 36, justifyContent: 'center' }}>
              <AppText color={theme.link} style={{ fontFamily: theme.font.extrabold, fontSize: 14 }}>Dismiss</AppText>
            </Pressable>
          </Notice>
        </View>
      ) : null}

      {attention.length > 0 ? (
        <View style={{ marginTop: 22 }}>
          <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <AppText variant="section">Needs attention</AppText>
            <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>{attention.length}</AppText>
          </View>
          <View style={{ gap: 10 }}>
            {attention.map((part) => (
              <PartCard
                key={`attention-${part.id}`}
                onAddRecord={() => onPartPress(part.id)}
                onEditInterval={() => onEditPart(part.id)}
                onPress={() => onPartPress(part.id)}
                part={part}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8, marginTop: 26 }}>
        <AppText variant="section">Maintenance</AppText>
        <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>{data.parts.length} parts</AppText>
      </View>
      <HiddenParts onRestore={onRestorePart} onToggle={onToggleHidden} parts={data.hiddenParts} showHidden={showHidden} />
    </View>
  );
}

function HiddenParts({
  parts,
  showHidden,
  onRestore,
  onToggle,
}: {
  parts: DashboardData['hiddenParts'];
  showHidden: boolean;
  onRestore: (partId: string) => void;
  onToggle: () => void;
}) {
  const theme = useTheme();
  if (parts.length === 0) return null;
  return (
    <>
      <Pressable
        accessibilityLabel={showHidden ? 'Hide hidden parts' : `Show ${parts.length} hidden parts`}
        accessibilityRole="button"
        onPress={onToggle}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <AppText color={theme.link} style={{ fontFamily: theme.font.bold, fontSize: 14 }}>
          {showHidden ? 'Hide hidden parts' : `Show ${parts.length} hidden part${parts.length === 1 ? '' : 's'}`}
        </AppText>
      </Pressable>
      {showHidden ? (
        <View style={{ gap: 8, marginBottom: 4 }}>
          {parts.map((part) => (
            <Card key={part.id} style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{part.name}</AppText>
                <AppText color={theme.muted} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>{part.categoryName}</AppText>
              </View>
              <Button onPress={() => onRestore(part.id)} style={{ minHeight: 44, paddingHorizontal: 14 }} title="Show" variant="quiet" />
            </Card>
          ))}
        </View>
      ) : null}
    </>
  );
}

function SummaryTile({ color, label, value }: { color: string; label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.card, borderColor: theme.line, borderRadius: theme.radius.card, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ backgroundColor: color, borderRadius: 5, height: 10, width: 10 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontFamily: theme.font.extrabold, fontSize: 22, lineHeight: 24 }}>{value}</AppText>
        <AppText color={theme.muted} numberOfLines={2} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>{label}</AppText>
      </View>
    </View>
  );
}

function PartCard({
  part,
  onPress,
  onAddRecord,
  onEditInterval,
}: {
  part: DashboardPart;
  onPress: () => void;
  onAddRecord: () => void;
  onEditInterval: () => void;
}) {
  const theme = useTheme();
  const progress = partProgress(part);
  const needsAction = part.status === 'Unknown' || part.status === 'SetInterval';
  const tone = statusTone(part.status, theme);
  const detail = partDetailLine(part);

  return (
    <Card
      style={{
        alignItems: 'flex-start',
        borderStyle: needsAction ? 'dashed' : 'solid',
        borderWidth: needsAction ? 1.5 : 1,
        flexDirection: 'row',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View style={{ alignItems: 'center', backgroundColor: tone.bg, borderRadius: theme.radius.icon, height: 44, justifyContent: 'center', width: 44 }}>
        <Feather color={tone.fg} name={partIcon(part.categoryName)} size={24} />
      </View>
      <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
        <Pressable
          accessibilityLabel={`${part.name}, ${part.status}, ${detail}`}
          accessibilityRole="button"
          onPress={onPress}
          style={{ gap: 6, minWidth: 0 }}
        >
          <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
            <AppText numberOfLines={2} style={{ flexShrink: 1, fontFamily: theme.font.extrabold, fontSize: 16, minWidth: 0 }}>{part.name}</AppText>
            <StatusPill status={part.status} />
          </View>
          {!needsAction && progress !== null ? <ProgressBar color={tone.fg} percent={progress} /> : null}
          <AppText color={theme.muted} numberOfLines={2} style={{ fontFamily: theme.font.semibold, fontSize: 13 }}>
            {detail}
          </AppText>
        </Pressable>
        {needsAction ? (
          <Pressable
            accessibilityLabel={part.status === 'SetInterval' ? `Set interval for ${part.name}` : `Add record for ${part.name}`}
            accessibilityRole="button"
            onPress={part.status === 'SetInterval' ? onEditInterval : onAddRecord}
            style={({ pressed }) => ({
              alignItems: 'center',
              alignSelf: 'flex-end',
              backgroundColor: part.status === 'SetInterval' ? theme.accent : theme.warnBg,
              borderRadius: theme.radius.button,
              flexDirection: 'row',
              flexShrink: 0,
              gap: 4,
              justifyContent: 'center',
              minHeight: 44,
              opacity: pressed ? 0.8 : 1,
              paddingHorizontal: 12,
            })}
          >
            <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ color: part.status === 'SetInterval' ? theme.onAccent : theme.warn, fontFamily: theme.font.extrabold, fontSize: 13 }}>
              {part.status === 'SetInterval' ? 'Set interval' : 'Add record'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function isUrgent(status: PartStatus | undefined): boolean {
  return status === 'DueSoon' || status === 'Overdue';
}
