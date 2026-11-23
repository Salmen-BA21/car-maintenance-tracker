import { Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { afterWrite } from '../../notifications/notification-service';
import { BottomNav, type NavTab } from '../../ui/kit';

export default function TabsLayout() {
  return (
    <>
      <ReminderSync />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ navigateToTab, state }) => (
          <BottomNav
            active={state.routes[state.index].name as NavTab}
            onNavigate={(tab) => {
              const route = state.routes.find((candidate) => candidate.name === tab);
              if (route) navigateToTab(route.key);
            }}
          />
        )}
      >
        <Tabs.Screen name="garage" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </>
  );
}

function ReminderSync() {
  const db = useSQLiteContext();

  useEffect(() => {
    void afterWrite(db);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void afterWrite(db);
    });
    return () => subscription.remove();
  }, [db]);

  return null;
}
