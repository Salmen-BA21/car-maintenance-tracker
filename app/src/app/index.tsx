import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BaselineScreen } from '../components/BaselineScreen';
import { DashboardScreen } from '../components/DashboardScreen';
import { CustomPartScreen } from '../components/CustomPartScreen';
import { SettingsScreen } from '../components/SettingsScreen';
import { PartDetailScreen } from '../components/PartDetailScreen';
import { SetupScreen } from '../components/SetupScreen';
import { styles } from '../components/uiStyles';
import { getCarCount } from '../data/repositories/car-repository';
import { rebuildNotifications } from '../notifications/notification-service';

export default function Home() {
  const db = useSQLiteContext();
  const [hasCar, setHasCar] = useState<boolean | null>(null);
  const [newCarId, setNewCarId] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [editingCustomPart, setEditingCustomPart] = useState<string | null>(null);
  const [addingCustomPart, setAddingCustomPart] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCarCount(db)
      .then((count) => {
        if (active) setHasCar(count > 0);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not open your local garage.');
      });
    return () => {
      active = false;
    };
  }, [db]);

  useEffect(() => {
    if (hasCar) {
      void rebuildNotifications(db).catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? `Notifications unavailable: ${cause.message}` : 'Notifications are unavailable.');
      });
    }
  }, [db, hasCar]);

  if (loadError !== null) return <MessageScreen title="Your garage could not open." message={loadError} />;
  if (hasCar === null) return <MessageScreen title="Loading your garage…" />;
  if (!hasCar) {
    return (
      <SetupScreen
        onCreated={(carId) => {
          setHasCar(true);
          setNewCarId(carId);
        }}
      />
    );
  }
  if (newCarId !== null) return <BaselineScreen carId={newCarId} onDone={() => setNewCarId(null)} />;
  if (editingCustomPart !== null) return <CustomPartScreen partId={editingCustomPart} onDone={() => { setEditingCustomPart(null); setSelectedPartId(null); }} />;
  if (selectedPartId !== null) return <PartDetailScreen partId={selectedPartId} onBack={() => setSelectedPartId(null)} onEdit={() => setEditingCustomPart(selectedPartId)} />;
  if (addingCustomPart !== null) return <CustomPartScreen carId={addingCustomPart} onDone={() => setAddingCustomPart(null)} />;
  if (showSettings) return <SettingsScreen onBack={() => setShowSettings(false)} />;
  return <DashboardScreen onPartPress={setSelectedPartId} onAddCustomPart={(carId) => setAddingCustomPart(carId)} onSettings={() => setShowSettings(true)} />;
}

function MessageScreen({ kicker, title, message }: { kicker?: string; title: string; message?: string }) {
  return (
    <View style={styles.loading}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={[styles.intro, { textAlign: 'center' }]}>{message}</Text> : null}
    </View>
  );
}
