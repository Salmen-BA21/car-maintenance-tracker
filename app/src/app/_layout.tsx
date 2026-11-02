import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { migrateDbIfNeeded } from '../data/sqlite/migrations';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="car-maintenance.db" onInit={migrateDbIfNeeded}>
      <Stack />
    </SQLiteProvider>
  );
}
