import { addServiceRecord, createCustomPart, updateOdometer } from '../car-repository';
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
