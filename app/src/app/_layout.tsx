import { Stack } from 'expo-router';
import { getLocales } from 'expo-localization';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrateDbIfNeeded } from '../data/sqlite/migrations';
import { ThemeProvider } from '../ui/theme';

function initDatabase(db: SQLiteDatabase) {
  return migrateDbIfNeeded(db, { currency: getLocales()[0]?.currencyCode ?? undefined });
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="car-maintenance.db" onInit={initDatabase}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </SafeAreaProvider>
    </SQLiteProvider>
  );
}
