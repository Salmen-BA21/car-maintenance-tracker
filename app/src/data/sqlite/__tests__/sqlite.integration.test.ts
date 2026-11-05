import Database from 'better-sqlite3';
import type { SQLiteDatabase } from 'expo-sqlite';

import { addInspection, addServiceRecord, createCar, createCustomPart, deleteCustomPart, deleteOdometerEntry, deleteServiceRecord, exportLocalData, getDashboard, getOdometerHistory, getPartConfig, getPartDetail, hasOdometerEntryToday, setPartAlerts, setPartHidden, updateOdometer, updateOdometerEntry, updatePart, updateServiceRecord } from '../../repositories/car-repository';
import { jsDateToLocalDate } from '../../../domain/local-date';
import { migrateDbIfNeeded } from '../migrations';

let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockUuid}` }));

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
    expect((await getPartConfig(db, partId)).name).toBe('AC belt');

    await updatePart(db, partId, {
      name: 'Air-conditioning belt',
      intervalType: 'both',
      distanceKm: 25_000,
      months: 24,
      inspectionMonths: null,
    });
    expect((await getPartConfig(db, partId)).months).toBe(24);

    await deleteCustomPart(db, partId);
    expect(database.raw.prepare('SELECT deleted_at FROM parts WHERE id = ?').get(partId)).toEqual(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    await expect(getPartConfig(db, partId)).rejects.toThrow('not found');
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
    await expect(updatePart(db, 'car-1:engine-oil', {
      name: 'Renamed default',
      intervalType: 'condition',
      distanceKm: null,
      months: null,
      inspectionMonths: 6,
    })).resolves.toBeUndefined();
    expect(await getPartConfig(db, 'car-1:engine-oil')).toEqual(expect.objectContaining({
      name: 'Renamed default',
      intervalType: 'condition',
      distanceKm: null,
      months: null,
      inspectionMonths: 6,
    }));

    await expect(updatePart(db, 'car-1:engine-oil', {
      name: 'Engine oil',
      intervalType: 'distance',
      distanceKm: 15_000,
      months: null,
      inspectionMonths: null,
    })).resolves.toBeUndefined();
    expect(await getPartConfig(db, 'car-1:engine-oil')).toEqual(expect.objectContaining({
      distanceKm: 15_000,
      months: null,
      inspectionMonths: null,
    }));

    await updatePart(db, 'car-1:engine-oil', {
      name: 'Engine oil',
      intervalType: 'both',
      distanceKm: 10_000,
      months: 12,
      inspectionMonths: null,
    });
    await updatePart(db, 'car-1:engine-oil', {
      name: 'Engine oil',
      intervalType: 'time',
      distanceKm: null,
      months: 12,
      inspectionMonths: null,
    });
    expect(await getPartConfig(db, 'car-1:engine-oil')).toEqual(expect.objectContaining({
      distanceKm: null,
      months: 12,
      inspectionMonths: null,
    }));
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

  test('flags inspection-based parts and clears them when inspected', async () => {
    const database = openTestDatabase();
    const db = database as unknown as SQLiteDatabase;
    await migrateDbIfNeeded(db);

    const { carId } = await createCar(db, {
      name: 'Diesel',
      fuelType: 'diesel',
      timingDrive: 'belt',
      gearbox: 'manual',
      hasDpf: true,
      initialOdometerKm: 100_000,
      entryDate: jsDateToLocalDate(new Date()),
    });
    const partId = `${carId}:brake-pads-discs`;
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    await database.runAsync('UPDATE parts SET created_at = ? WHERE id = ?', fourMonthsAgo.toISOString(), partId);

    const due = (await getDashboard(db)).parts.find((part) => part.id === partId);
    expect(due).toEqual(expect.objectContaining({
      intervalType: 'condition',
      inspectionDue: true,
      inspectionDueDate: expect.any(String),
    }));

    await addInspection(db, { partId, inspectionDate: jsDateToLocalDate(new Date()) });
    const inspected = (await getDashboard(db)).parts.find((part) => part.id === partId);
    expect(inspected?.inspectionDue).toBe(false);

    await expect(addInspection(db, { partId: `${carId}:engine-oil`, inspectionDate: jsDateToLocalDate(new Date()) }))
      .rejects.toThrow('inspection-based');
    database.raw.close();
  });

  test('keeps mileage history and enforces the D-50 guards', async () => {
    const database = openTestDatabase();
    const db = database as unknown as SQLiteDatabase;
    await migrateDbIfNeeded(db);
    const today = jsDateToLocalDate(new Date());
    const { carId } = await createCar(db, {
      name: 'Daily driver',
      fuelType: 'petrol',
      timingDrive: 'chain',
      gearbox: 'manual',
      hasDpf: false,
      initialOdometerKm: 100_000,
      entryDate: today,
    });

    await updateOdometer(db, carId, 110_000);
    let history = await getOdometerHistory(db, carId);
    expect(history.map((entry) => entry.valueKm)).toEqual([110_000, 100_000]);

    await updateOdometerEntry(db, history[0].id, 115_000);
    history = await getOdometerHistory(db, carId);
    expect(history[0].valueKm).toBe(115_000);
    expect(await hasOdometerEntryToday(db, carId, today)).toBe(true);
    expect(await hasOdometerEntryToday(db, carId, '2000-01-01')).toBe(false);

    await expect(updateOdometerEntry(db, history[1].id, 90_000)).rejects.toThrow('Only the latest');
    await expect(updateOdometerEntry(db, history[0].id, 90_000)).rejects.toThrow('next mileage entry');

    await addServiceRecord(db, {
      partId: `${carId}:engine-oil`,
      serviceKm: 115_000,
      serviceDate: today,
      costMinor: null,
      costCurrency: null,
      notes: null,
    });
    await expect(updateOdometerEntry(db, history[0].id, 110_000)).rejects.toThrow('highest service record');
    await updateOdometerEntry(db, history[0].id, 125_000);
    await expect(deleteOdometerEntry(db, history[0].id)).rejects.toThrow('highest service record');

    const second = await createCar(db, {
      name: 'Second car',
      fuelType: 'petrol',
      timingDrive: 'chain',
      gearbox: 'manual',
      hasDpf: false,
      initialOdometerKm: 100_000,
      entryDate: today,
    });
    await updateOdometer(db, second.carId, 101_000);
    const secondHistory = await getOdometerHistory(db, second.carId);
    await deleteOdometerEntry(db, secondHistory[0].id);
    await expect(deleteOdometerEntry(db, secondHistory[1].id)).rejects.toThrow('last odometer entry');
    database.raw.close();
  });

  test('edits and deletes history records and recomputes the active record (AC-18)', async () => {
    const database = openTestDatabase();
    const db = database as unknown as SQLiteDatabase;
    await migrateDbIfNeeded(db);
    const today = jsDateToLocalDate(new Date());
    const { carId } = await createCar(db, {
      name: 'Daily driver',
      fuelType: 'petrol',
      timingDrive: 'chain',
      gearbox: 'manual',
      hasDpf: false,
      initialOdometerKm: 120_000,
      entryDate: today,
    });
    const partId = `${carId}:engine-oil`;
    await addServiceRecord(db, { partId, serviceKm: 100_000, serviceDate: '2026-01-01', costMinor: null, costCurrency: null, notes: null });
    await addServiceRecord(db, { partId, serviceKm: 110_000, serviceDate: '2026-06-01', costMinor: null, costCurrency: null, notes: null });

    let detail = await getPartDetail(db, partId);
    expect(detail.part.dueDate).toBe('2027-06-01');

    await expect(addServiceRecord(db, { partId, serviceKm: 130_000, serviceDate: today, costMinor: null, costCurrency: null, notes: null }))
      .rejects.toThrow('current odometer');

    const older = detail.history.find((record) => record.serviceDate === '2026-01-01');
    if (!older) throw new Error('older record was not found');
    await expect(updateServiceRecord(db, older.id, { serviceKm: 105_000, serviceDate: '2099-01-01', costMinor: null, costCurrency: null, notes: null }))
      .rejects.toThrow('future');
    await expect(updateServiceRecord(db, older.id, { serviceKm: 130_000, serviceDate: '2026-08-01', costMinor: null, costCurrency: null, notes: null }))
      .rejects.toThrow('current odometer');
    await updateServiceRecord(db, older.id, { serviceKm: 105_000, serviceDate: '2026-08-01', costMinor: null, costCurrency: null, notes: 'edited' });
    detail = await getPartDetail(db, partId);
    expect(detail.part.dueDate).toBe('2027-08-01');

    await deleteServiceRecord(db, older.id);
    detail = await getPartDetail(db, partId);
    expect(detail.part.dueDate).toBe('2027-06-01');
    expect(detail.history).toHaveLength(1);

    const conditionPart = `${carId}:brake-pads-discs`;
    await addInspection(db, { partId: conditionPart, inspectionDate: '2026-01-01' });
    const inspection = (await getPartDetail(db, conditionPart)).history[0];
    await updateServiceRecord(db, inspection.id, { serviceKm: null, serviceDate: today, costMinor: null, costCurrency: null, notes: null });
    const inspectedDetail = await getPartDetail(db, conditionPart);
    expect(inspectedDetail.history[0].serviceDate).toBe(today);
    expect(inspectedDetail.part.inspectionDue).toBe(false);
    database.raw.close();
  });

  test('hides user-hidden parts from the dashboard only', async () => {
    const database = openTestDatabase();
    const db = database as unknown as SQLiteDatabase;
    await migrateDbIfNeeded(db);
    const { carId } = await createCar(db, {
      name: 'Daily driver',
      fuelType: 'petrol',
      timingDrive: 'chain',
      gearbox: 'manual',
      hasDpf: false,
      initialOdometerKm: 100_000,
      entryDate: jsDateToLocalDate(new Date()),
    });
    const partId = `${carId}:air-filter`;
    await setPartHidden(db, partId, true);

    const dashboard = await getDashboard(db);
    expect(dashboard.parts.some((part) => part.id === partId)).toBe(false);
    expect(dashboard.hiddenParts).toEqual([
      expect.objectContaining({ id: partId, name: expect.any(String), categoryName: expect.any(String) }),
    ]);
    expect((await getPartDetail(db, partId)).part.id).toBe(partId);

    await setPartHidden(db, partId, false);
    expect((await getDashboard(db)).hiddenParts).toEqual([]);
    expect((await getDashboard(db)).parts.some((part) => part.id === partId)).toBe(true);
    const visibleCount = (await getDashboard(db)).parts.length;

    const oilId = `${carId}:engine-oil`;
    await setPartAlerts(db, oilId, false);
    expect((await getDashboard(db)).parts.find((part) => part.id === oilId)?.includeInReminders).toBe(false);
    await setPartAlerts(db, oilId, true);
    expect((await getDashboard(db)).parts.find((part) => part.id === oilId)?.includeInReminders).toBe(true);

    await database.runAsync('UPDATE parts SET hidden_by = ? WHERE car_id = ?', 'user', carId);
    const emptyDashboard = await getDashboard(db);
    expect(emptyDashboard.carName).toBe('Daily driver');
    expect(emptyDashboard.parts).toEqual([]);
    expect(emptyDashboard.hiddenParts).toHaveLength(visibleCount);
    database.raw.close();
  });
});
