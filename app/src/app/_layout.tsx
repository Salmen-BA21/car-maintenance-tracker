import { Stack } from 'expo-router';
import { getLocales } from 'expo-localization';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrateDbIfNeeded } from '../data/sqlite/migrations';
import { ThemeProvider, useTheme } from '../ui/theme';

function initDatabase(db: SQLiteDatabase) {
  return migrateDbIfNeeded(db, { currency: getLocales()[0]?.currencyCode ?? undefined });
}

function RootStack() {
  const theme = useTheme();
  const detailHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.card },
    headerTintColor: theme.highlight,
    headerTitleStyle: { color: theme.ink, fontFamily: theme.font.extrabold, fontSize: 17 },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="baseline" />
      <Stack.Screen name="part/[id]" options={{ ...detailHeader, title: 'Part' }} />
      <Stack.Screen name="part/[id]/edit" options={{ ...detailHeader, title: 'Edit part' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="car-maintenance.db" onInit={initDatabase}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </SQLiteProvider>
  );
}
