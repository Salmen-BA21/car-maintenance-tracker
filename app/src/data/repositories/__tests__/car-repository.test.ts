import { addServiceRecord, createCustomPart, deleteOdometerEntry, updateOdometer, updateOdometerEntry, updateServiceRecord } from '../car-repository';
import type { SQLiteDatabase } from 'expo-sqlite';

type FakeDatabase = {
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
};

function database(overrides: Record<string, unknown> = {}) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue({ value: 100_000, id: 'car-1', carId: 'car-1' }),
    runAsync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as FakeDatabase;
}

describe('car repository write rules', () => {
  test('rejects an odometer decrease before writing', async () => {
    const db = database();

    await expect(updateOdometer(db as unknown as SQLiteDatabase, 'car-1', 99_999)).rejects.toThrow('cannot go below');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('writes a higher odometer value', async () => {
    const db = database();

    await updateOdometer(db as unknown as SQLiteDatabase, 'car-1', 100_001);

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync.mock.calls[0][3]).toBe(100_001);
  });

  test('accepts an equal odometer value as a new row (A-02)', async () => {
    const db = database();

    await updateOdometer(db as unknown as SQLiteDatabase, 'car-1', 100_000);

    expect(db.runAsync).toHaveBeenCalledTimes(1);
  });

  test('rejects editing an entry that is not the latest', async () => {
    const db = {
      getFirstAsync: jest.fn()
        .mockResolvedValueOnce({ id: 'older', carId: 'car-1', valueKm: 100_000 })
        .mockResolvedValueOnce({ id: 'latest' }),
      runAsync: jest.fn(),
    };

    await expect(updateOdometerEntry(db as unknown as SQLiteDatabase, 'older', 101_000)).rejects.toThrow('Only the latest');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('rejects an edit below the next mileage entry', async () => {
    const db = {
      getFirstAsync: jest.fn()
        .mockResolvedValueOnce({ id: 'latest', carId: 'car-1', valueKm: 110_000 })
        .mockResolvedValueOnce({ id: 'latest' })
        .mockResolvedValueOnce({ value: 100_000 }),
      runAsync: jest.fn(),
    };

    await expect(updateOdometerEntry(db as unknown as SQLiteDatabase, 'latest', 90_000)).rejects.toThrow('next mileage entry');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('rejects an edit below the highest service record', async () => {
    const db = {
      getFirstAsync: jest.fn()
        .mockResolvedValueOnce({ id: 'latest', carId: 'car-1', valueKm: 130_000 })
        .mockResolvedValueOnce({ id: 'latest' })
        .mockResolvedValueOnce({ value: null })
        .mockResolvedValueOnce({ serviceKm: 120_000 }),
      runAsync: jest.fn(),
    };

    await expect(updateOdometerEntry(db as unknown as SQLiteDatabase, 'latest', 110_000)).rejects.toThrow('highest service record');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('refuses to delete the last remaining entry', async () => {
    const db = {
      getFirstAsync: jest.fn()
        .mockResolvedValueOnce({ id: 'only', carId: 'car-1', valueKm: 100_000 })
        .mockResolvedValueOnce({ id: 'only' })
        .mockResolvedValueOnce({ value: null }),
      runAsync: jest.fn(),
    };

    await expect(deleteOdometerEntry(db as unknown as SQLiteDatabase, 'only')).rejects.toThrow('last odometer entry');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('requires interval values that match a custom part interval type', async () => {
    const db = database();

    await expect(createCustomPart(db as unknown as SQLiteDatabase, {
      carId: 'car-1',
      name: 'AC belt',
      intervalType: 'both',
      distanceKm: 20_000,
      months: null,
      inspectionMonths: null,
    })).rejects.toThrow('interval values');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('rejects a service record edit that omits an anchor on a non-baseline row', async () => {
    const db = {
      getFirstAsync: jest.fn().mockResolvedValue({ kind: 'service', isBaseline: 0 }),
      runAsync: jest.fn(),
    };

    await expect(updateServiceRecord(db as unknown as SQLiteDatabase, 'record-1', {
      serviceKm: 100_000,
      serviceDate: null,
      costMinor: null,
      costCurrency: null,
      notes: null,
    })).rejects.toThrow('Service km and date are required.');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('rejects a service record without a km value', async () => {
    const db = database();

    await expect(addServiceRecord(db as unknown as SQLiteDatabase, {
      partId: 'part-1',
      serviceKm: null,
      serviceDate: '2026-01-01',
      costMinor: null,
      costCurrency: null,
      notes: null,
    })).rejects.toThrow('Service km and date are required.');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('rejects a service record with an invalid date', async () => {
    const db = database();

    await expect(addServiceRecord(db as unknown as SQLiteDatabase, {
      partId: 'part-1',
      serviceKm: 100_000,
      serviceDate: '2026-02-30',
      costMinor: null,
      costCurrency: null,
      notes: null,
    })).rejects.toThrow('Service date');
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
