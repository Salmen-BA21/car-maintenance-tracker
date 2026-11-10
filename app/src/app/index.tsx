import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { BaselineScreen } from '../components/BaselineScreen';
import { DashboardScreen } from '../components/DashboardScreen';
import { OnboardingScreen } from '../components/OnboardingScreen';
import { PartConfigScreen } from '../components/PartConfigScreen';
import { PartDetailScreen } from '../components/PartDetailScreen';
import { SettingsScreen } from '../components/SettingsScreen';
import { SetupScreen } from '../components/SetupScreen';
import { getActiveCar, getCarCount, hasSeenOnboarding, setOnboardingSeen } from '../data/repositories/car-repository';
import { afterWrite } from '../notifications/notification-service';
import { AppText, BottomNav, Screen, type NavTab } from '../ui/kit';
import { PageTransition } from '../ui/PageTransition';
import type { PageMotion } from '../ui/page-motion';
import { useTheme } from '../ui/theme';

export default function Home() {
  const db = useSQLiteContext();
  const [hasCar, setHasCar] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [newCarId, setNewCarId] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<string | null>(null);
  const [activeCar, setActiveCar] = useState<{ id: string; name: string } | null>(null);
  const [tab, setTab] = useState<NavTab>('garage');
  const [motion, setMotion] = useState<PageMotion>('fade');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getCarCount(db), hasSeenOnboarding(db), getActiveCar(db)])
      .then(([count, seen, car]) => {
        if (!active) return;
        setHasCar(count > 0);
        setOnboardingDone(seen);
        setActiveCar(car);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not open your local garage.');
      });
    return () => {
      active = false;
    };
  }, [db]);

  useEffect(() => {
    if (!hasCar) return;
    void afterWrite(db);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void afterWrite(db);
    });
    return () => subscription.remove();
  }, [db, hasCar]);

  function navigate(next: NavTab) {
    setSelectedPartId(null);
    setEditingPart(null);
    setMotion('fade');
    setTab(next);
  }

  function openPart(partId: string) {
    setMotion('push');
    setSelectedPartId(partId);
  }

  function editPart(partId: string) {
    setMotion('push');
    setEditingPart(partId);
  }

  function backToGarage() {
    setMotion('pop');
    setSelectedPartId(null);
    setEditingPart(null);
  }

  if (loadError !== null) return <MessageScreen message={loadError} title="Your garage could not open." />;
  if (hasCar === null || onboardingDone === null) return <MessageScreen title="Loading your garage…" />;

  if (!onboardingDone) {
    return (
      <Page key="onboarding" motion={motion}>
        <OnboardingScreen
          onDone={() => {
            setMotion('fade');
            void setOnboardingSeen(db).finally(() => setOnboardingDone(true));
          }}
        />
      </Page>
    );
  }

  if (!hasCar) {
    return (
      <Page key="setup" motion={motion}>
        <SetupScreen
          onCreated={(carId) => {
            setMotion('push');
            setHasCar(true);
            setNewCarId(carId);
            void getActiveCar(db).then(setActiveCar).catch(() => undefined);
          }}
        />
      </Page>
    );
  }

  if (newCarId !== null) {
    return (
      <Page key={`baseline-${newCarId}`} motion={motion}>
        <BaselineScreen
          carId={newCarId}
          onDone={() => {
            setMotion('fade');
            setNewCarId(null);
          }}
        />
      </Page>
    );
  }

  if (activeCar === null) return <MessageScreen title="Loading your garage…" />;

  if (editingPart !== null) {
    return (
      <Page key={`edit-${editingPart}`} motion={motion}>
        <PartConfigScreen carName={activeCar?.name} onDone={backToGarage} partId={editingPart} />
      </Page>
    );
  }

  if (selectedPartId !== null) {
    return (
      <Page key={`part-${selectedPartId}`} motion={motion}>
        <PartDetailScreen
          onBack={backToGarage}
          onEdit={() => editPart(selectedPartId)}
          partId={selectedPartId}
        />
      </Page>
    );
  }

  return (
    <Page
      key={`tab-${tab}`}
      motion={motion}
      edges={['top', 'left', 'right']}
      footer={<BottomNav active={tab} onNavigate={navigate} />}
    >
      {tab === 'garage' ? (
        <DashboardScreen
          onAddPart={() => navigate('add')}
          onEditPart={editPart}
          onPartPress={openPart}
          onSettings={() => navigate('settings')}
        />
      ) : null}
      {tab === 'add' ? (
        <PartConfigScreen carId={activeCar?.id} carName={activeCar?.name} onDone={() => navigate('garage')} />
      ) : null}
      {tab === 'settings' ? <SettingsScreen /> : null}
    </Page>
  );
}

function Page({
  motion,
  children,
  edges,
  footer,
}: {
  motion: PageMotion;
  children: ReactNode;
  edges?: Edge[];
  footer?: ReactNode;
}) {
  return (
    <Screen edges={edges}>
      <PageTransition motion={motion}>
        <View style={{ flex: 1 }}>{children}</View>
      </PageTransition>
      {footer}
    </Screen>
  );
}

function MessageScreen({ title, message }: { title: string; message?: string }) {
  const theme = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <AppText variant="display">{title}</AppText>
        {message ? <AppText align="center" color={theme.muted} style={{ marginTop: 12 }}>{message}</AppText> : null}
      </View>
    </Screen>
  );
}
