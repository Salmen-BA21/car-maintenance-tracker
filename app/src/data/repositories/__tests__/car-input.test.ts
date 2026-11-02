import { CarInputError, parseCreateCarInput } from '../car-input';

const validCar = {
  name: '  My car  ',
  fuelType: 'diesel' as const,
  timingDrive: 'belt' as const,
  gearbox: 'manual' as const,
  hasDpf: true,
  initialOdometerKm: 120_000,
  entryDate: '2026-11-02',
};

describe('parseCreateCarInput', () => {
  test('normalizes a valid car profile', () => {
    expect(parseCreateCarInput(validCar).name).toBe('My car');
  });

  test('rejects invalid car data before a write starts', () => {
    expect(() => parseCreateCarInput({ ...validCar, fuelType: 'petrol', hasDpf: true })).toThrow(CarInputError);
    expect(() => parseCreateCarInput({ ...validCar, entryDate: '2026-02-30' })).toThrow(CarInputError);
    expect(() => parseCreateCarInput({ ...validCar, initialOdometerKm: -1 })).toThrow(CarInputError);
  });
});
