import Database from 'better-sqlite3';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createCustomPart, deleteCustomPart, exportLocalData, getCustomPart, updateCustomPart } from '../../repositories/car-repository';
import { migrateDbIfNeeded } from '../migrations';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'part-1' }));

type SqliteTestDatabase = {
  raw: Database.Database;
  failNextPartInsert: boolean;
  execAsync: (sql: string) => Promise<void>;
  getFirstAsync: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  runAsync: (sql: string, ...params: unknown[]) => Promise<void>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
};

function openTestDatabase(): SqliteTestDatabase {
  const raw = new Database(':memory:');
  const database: SqliteTestDatabase = {
    raw,
    failNextPartInsert: false,
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    getFirstAsync: async <T>(sql: string, ...params: unknown[]) => {
      const row = raw.prepare(sql).get(...params) as T | undefined;
      return row ?? null;
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]) => raw.prepare(sql).all(...params) as T[],
    runAsync: async (sql, ...params) => {
      if (database.failNextPartInsert && sql.includes('INSERT INTO parts')) {
        database.failNextPartInsert = false;
        throw new Error('forced part insert failure');
      }
      raw.prepare(sql).run(...params);
    },
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (cause) {
        raw.exec('ROLLBACK');
        throw cause;
      }
    },
  };
  return database;
}

describe('SQLite schema and repository integration', () => {
  test('migrates schema and persists custom part lifecycle', async () => {
    const database = openTestDatabase();
    const db = database as unknown as SQLiteDatabase;

    await migrateDbIfNeeded(db);
    await database.runAsync(
      `INSERT INTO cars (id, name, fuel_type, timing_drive, gearbox, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'car-1',
      'Daily driver',
      'petrol',
      'chain',
      'manual',
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const partId = await createCustomPart(db, {
      carId: 'car-1',
      name: 'AC belt',
      intervalType: 'distance',
      distanceKm: 20_000,
      months: null,
      inspectionMonths: null,
    });
    expect(database.raw.prepare('SELECT id, template_code, deleted_at FROM parts WHERE id = ?').get(partId)).toEqual(
      expect.objectContaining({ id: partId, template_code: null, deleted_at: null }),
    );
    expect((await getCustomPart(db, partId)).name).toBe('AC belt');

    await updateCustomPart(db, partId, {
      name: 'Air-conditioning belt',
      intervalType: 'both',
      distanceKm: 25_000,
      months: 24,
      inspectionMonths: null,
    });
    expect((await getCustomPart(db, partId)).months).toBe(24);

    await deleteCustomPart(db, partId);
    expect(database.raw.prepare('SELECT deleted_at FROM parts WHERE id = ?').get(partId)).toEqual(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    await expect(getCustomPart(db, partId)).rejects.toThrow('not found');
    const exported = JSON.parse(await exportLocalData(db)) as { parts: { id: string; deleted_at: string | null }[] };
    expect(exported.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: partId, deleted_at: expect.any(String) }),
    ]));

    await database.runAsync(
      `INSERT INTO parts (
        id, car_id, category_id, template_code, name, interval_type, distance_km,
        months, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'car-1:engine-oil',
      'car-1',
      'engine',
      'engine-oil',
      'Engine oil',
      'both',
      10_000,
      12,
      1,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    await expect(updateCustomPart(db, 'car-1:engine-oil', {
      name: 'Renamed default',
      intervalType: 'distance',
      distanceKm: 20_000,
      months: null,
      inspectionMonths: null,
    })).rejects.toThrow('not found');
    await expect(deleteCustomPart(db, 'car-1:engine-oil')).rejects.toThrow('not found');

    await expect(database.withTransactionAsync(async () => {
      await database.runAsync(
        'INSERT INTO categories (id, code, name, sort_order) VALUES (?, ?, ?, ?)',
        'rollback-test',
        'rollback-test',
        'Rollback test',
        100,
      );
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');
    expect(database.raw.prepare('SELECT id FROM categories WHERE id = ?').get('rollback-test')).toBeUndefined();

    const failedDatabase = openTestDatabase();
    const failedDb = failedDatabase as unknown as SQLiteDatabase;
    await migrateDbIfNeeded(failedDb);
    await failedDatabase.runAsync(
      `INSERT INTO cars (id, name, fuel_type, timing_drive, gearbox, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'failed-car',
      'Failed car',
      'petrol',
      'chain',
      'manual',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    failedDatabase.failNextPartInsert = true;
    await expect(createCustomPart(failedDb, {
      carId: 'failed-car',
      name: 'Failed part',
      intervalType: 'distance',
      distanceKm: 10_000,
      months: null,
      inspectionMonths: null,
    })).rejects.toThrow('forced part insert failure');
    expect(failedDatabase.raw.prepare('SELECT id FROM categories WHERE id = ?').get('custom')).toBeUndefined();
    failedDatabase.raw.close();

    database.raw.close();
  });
});
