import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { parseCreateCarInput, type CreateCarInput } from './car-input';
import { inspectionDueDate, isInspectionDue } from '../../domain/inspection';
import { jsDateToLocalDate, type LocalDate } from '../../domain/local-date';
import { computeStatus, type PartStatus, type StatusResult } from '../../domain/status';

export interface CreatedCar {
  carId: string;
  odometerEntryId: string;
}

export async function getCarCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM cars WHERE deleted_at IS NULL',
  );
  return row?.count ?? 0;
}

export interface AppSettings {
  remindersEnabled: boolean;
  reminderTime: string;
  currency: string;
}

export async function getAppSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const row = await db.getFirstAsync<{ remindersEnabled: number; reminderTime: string; currency: string }>(
    'SELECT reminders_enabled AS remindersEnabled, reminder_time AS reminderTime, currency FROM app_settings WHERE id = 1',
  );
  if (!row) throw new Error('App settings are unavailable.');
  return { remindersEnabled: Boolean(row.remindersEnabled), reminderTime: row.reminderTime, currency: row.currency };
}

export async function saveAppSettings(db: SQLiteDatabase, settings: AppSettings): Promise<void> {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime)) throw new Error('Reminder time must use HH:MM.');
  if (!/^[A-Z]{3}$/.test(settings.currency)) throw new Error('Currency must be a three-letter code.');
  await db.runAsync(
    `UPDATE app_settings SET reminders_enabled = ?, reminder_time = ?, currency = ?, updated_at = ? WHERE id = 1`,
    settings.remindersEnabled ? 1 : 0,
    settings.reminderTime,
    settings.currency,
    new Date().toISOString(),
  );
}

export async function exportLocalData(db: SQLiteDatabase): Promise<string> {
  const [cars, categories, parts, odometerEntries, serviceRecords, settings] = await Promise.all([
    db.getAllAsync('SELECT * FROM cars WHERE deleted_at IS NULL'),
    db.getAllAsync('SELECT * FROM categories'),
    db.getAllAsync('SELECT * FROM parts'),
    db.getAllAsync('SELECT * FROM odometer_entries WHERE deleted_at IS NULL'),
    db.getAllAsync('SELECT * FROM service_records WHERE deleted_at IS NULL'),
    db.getAllAsync('SELECT * FROM app_settings WHERE id = 1'),
  ]);
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), cars, categories, parts, odometerEntries, serviceRecords, settings },
    null,
    2,
  );
}

export interface CustomPartInput {
  carId: string;
  name: string;
  intervalType: 'distance' | 'time' | 'both' | 'condition';
  distanceKm: number | null;
  months: number | null;
  inspectionMonths: number | null;
}

export interface CustomPart extends CustomPartInput {
  id: string;
}

export async function getCustomPart(db: SQLiteDatabase, partId: string): Promise<CustomPart> {
  const row = await db.getFirstAsync<CustomPart>(
    `SELECT id, car_id AS carId, name, interval_type AS intervalType,
       distance_km AS distanceKm, months, inspection_months AS inspectionMonths
     FROM parts WHERE id = ? AND template_code IS NULL AND deleted_at IS NULL`,
    partId,
  );
  if (!row) throw new Error('Custom part was not found.');
  return row;
}

export async function createCustomPart(db: SQLiteDatabase, input: CustomPartInput): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error('Part name is required and must be 80 characters or less.');
  const requiresDistance = input.intervalType === 'distance' || input.intervalType === 'both';
  const requiresTime = input.intervalType === 'time' || input.intervalType === 'both';
  const requiresInspection = input.intervalType === 'condition';
  if (requiresDistance !== (input.distanceKm !== null) || requiresTime !== (input.months !== null) || requiresInspection !== (input.inspectionMonths !== null)) {
    throw new Error('Enter the interval values required for this part.');
  }
  for (const value of [input.distanceKm, input.months, input.inspectionMonths]) {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) throw new Error('Interval values must be positive whole numbers.');
  }
  const car = await db.getFirstAsync<{ id: string }>('SELECT id FROM cars WHERE id = ? AND deleted_at IS NULL', input.carId);
  if (!car) throw new Error('Car was not found.');
  const categoryId = 'custom';
  const id = Crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, code, name, sort_order) VALUES (?, ?, ?, 99)`,
      categoryId,
      categoryId,
      'Custom',
    );
    await db.runAsync(
      `INSERT INTO parts (
        id, car_id, category_id, template_code, name, interval_type, distance_km, months,
        inspection_months, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)`,
      id,
      input.carId,
      categoryId,
      name,
      input.intervalType,
      input.distanceKm,
      input.months,
      input.inspectionMonths,
      timestamp,
      timestamp,
    );
  });
  return id;
}

export async function updateCustomPart(db: SQLiteDatabase, partId: string, input: Omit<CustomPartInput, 'carId'>): Promise<void> {
  const existing = await getCustomPart(db, partId);
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error('Part name is required and must be 80 characters or less.');
  const requiresDistance = input.intervalType === 'distance' || input.intervalType === 'both';
  const requiresTime = input.intervalType === 'time' || input.intervalType === 'both';
  const requiresInspection = input.intervalType === 'condition';
  if (requiresDistance !== (input.distanceKm !== null) || requiresTime !== (input.months !== null) || requiresInspection !== (input.inspectionMonths !== null)) {
    throw new Error('Enter the interval values required for this part.');
  }
  for (const value of [input.distanceKm, input.months, input.inspectionMonths]) {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) throw new Error('Interval values must be positive whole numbers.');
  }
  await db.runAsync(
    `UPDATE parts SET name = ?, interval_type = ?, distance_km = ?, months = ?,
       inspection_months = ?, updated_at = ? WHERE id = ? AND template_code IS NULL`,
    name,
    input.intervalType,
    input.distanceKm,
    input.months,
    input.inspectionMonths,
    new Date().toISOString(),
    existing.id,
  );
}

export async function deleteCustomPart(db: SQLiteDatabase, partId: string): Promise<void> {
  await getCustomPart(db, partId);
  await db.runAsync(
    'UPDATE parts SET deleted_at = ?, updated_at = ? WHERE id = ? AND template_code IS NULL',
    new Date().toISOString(),
    new Date().toISOString(),
    partId,
  );
}

export interface DashboardPart {
  id: string;
  name: string;
  categoryName: string;
  intervalType: 'distance' | 'time' | 'both' | 'condition';
  distanceKm: number | null;
  months: number | null;
  status: PartStatus;
  remainingKm: number | null;
  dueDate: LocalDate | null;
  remainingDays: number | null;
  /** Condition-based parts only: the inspection period has elapsed (BR-08, D-52). */
  inspectionDue: boolean;
  /** Condition-based parts only: when the next inspection falls due. */
  inspectionDueDate: LocalDate | null;
  /** Date of the active service record; used to place part alerts. */
  serviceDate: LocalDate | null;
  includeInReminders: boolean;
  isCustom: boolean;
}

export interface DashboardData {
  carId: string;
  carName: string;
  currentOdometerKm: number;
  parts: DashboardPart[];
}

export interface ServiceHistoryRecord {
  id: string;
  kind: 'service' | 'inspection';
  serviceKm: number | null;
  serviceDate: LocalDate | null;
  costMinor: number | null;
  costCurrency: string | null;
  notes: string | null;
  isBaseline: boolean;
}

export interface PartDetail {
  part: DashboardPart;
  history: ServiceHistoryRecord[];
}

type DashboardRow = {
  carId: string;
  carName: string;
  currentOdometerKm: number;
  id: string;
  name: string;
  categoryName: string;
  intervalType: 'distance' | 'time' | 'both' | 'condition';
  distanceKm: number | null;
  months: number | null;
  inspectionMonths: number | null;
  createdAt: string;
  serviceKm: number | null;
  serviceDate: LocalDate | null;
  lastInspectionDate: LocalDate | null;
  includeInReminders: number;
  templateCode: string | null;
};

function toDashboardPart(row: DashboardRow, currentOdometerKm: number): DashboardPart {
  const today = jsDateToLocalDate(new Date());
  const result: StatusResult = computeStatus(
    { intervalType: row.intervalType, distanceKm: row.distanceKm, months: row.months },
    row.serviceKm === null && row.serviceDate === null ? null : { serviceKm: row.serviceKm, serviceDate: row.serviceDate },
    currentOdometerKm,
    today,
  );
  const inspection =
    row.intervalType === 'condition' && row.inspectionMonths !== null
      ? {
          inspectionMonths: row.inspectionMonths,
          lastInspectionDate: row.lastInspectionDate,
          lastServiceDate: row.serviceDate,
          createdDate: jsDateToLocalDate(new Date(row.createdAt)),
        }
      : null;
  return {
    id: row.id,
    name: row.name,
    categoryName: row.categoryName,
    intervalType: row.intervalType,
    distanceKm: row.distanceKm,
    months: row.months,
    isCustom: row.templateCode === null,
    ...result,
    inspectionDue: inspection !== null && isInspectionDue(inspection, today),
    inspectionDueDate: inspection === null ? null : inspectionDueDate(inspection),
    serviceDate: row.serviceDate,
    includeInReminders: Boolean(row.includeInReminders),
  };
}

export async function getDashboard(db: SQLiteDatabase): Promise<DashboardData> {
  // Read the car separately: a car with every part hidden still needs a dashboard.
  const car = await db.getFirstAsync<{ carId: string; carName: string; currentOdometerKm: number | null }>(
    `SELECT c.id AS carId, c.name AS carName,
       (SELECT MAX(value_km) FROM odometer_entries WHERE car_id = c.id AND deleted_at IS NULL) AS currentOdometerKm
     FROM cars c WHERE c.deleted_at IS NULL LIMIT 1`,
  );
  if (!car || car.currentOdometerKm === null) {
    throw new Error('No car or current odometer was found.');
  }
  const currentOdometerKm = car.currentOdometerKm;
  const rows = await db.getAllAsync<DashboardRow>(
    `SELECT c.id AS carId, c.name AS carName,
       (SELECT MAX(value_km) FROM odometer_entries WHERE car_id = c.id AND deleted_at IS NULL) AS currentOdometerKm,
       p.id, p.name, cat.name AS categoryName, p.interval_type AS intervalType,
       p.distance_km AS distanceKm, p.months, p.inspection_months AS inspectionMonths,
       p.created_at AS createdAt, p.include_in_reminders AS includeInReminders,
       p.template_code AS templateCode,
       sr.service_km AS serviceKm, sr.service_date AS serviceDate,
       i.service_date AS lastInspectionDate
     FROM cars c
     JOIN parts p ON p.car_id = c.id AND p.deleted_at IS NULL
     JOIN categories cat ON cat.id = p.category_id
     LEFT JOIN service_records sr ON sr.id = (
       SELECT candidate.id FROM service_records candidate
       WHERE candidate.part_id = p.id AND candidate.deleted_at IS NULL AND candidate.kind = 'service'
       ORDER BY candidate.service_date IS NULL, candidate.service_date DESC,
                candidate.service_km IS NULL, candidate.service_km DESC,
                candidate.created_at DESC
       LIMIT 1
     )
     LEFT JOIN service_records i ON i.id = (
       SELECT candidate.id FROM service_records candidate
       WHERE candidate.part_id = p.id AND candidate.deleted_at IS NULL AND candidate.kind = 'inspection'
       ORDER BY candidate.service_date DESC
       LIMIT 1
     )
     WHERE c.deleted_at IS NULL
       AND p.hidden_by IS NULL
     ORDER BY cat.sort_order, p.sort_order`,
  );

  return {
    carId: car.carId,
    carName: car.carName,
    currentOdometerKm,
    parts: rows.map((row) => toDashboardPart(row, currentOdometerKm)),
  };
}

const ODOMETER_ORDER = 'value_km DESC, entry_date DESC, created_at DESC, id DESC';

export interface OdometerEntry {
  id: string;
  valueKm: number;
  entryDate: LocalDate;
  createdAt: string;
}

export async function getOdometerHistory(db: SQLiteDatabase, carId: string): Promise<OdometerEntry[]> {
  return db.getAllAsync<OdometerEntry>(
    `SELECT id, value_km AS valueKm, entry_date AS entryDate, created_at AS createdAt
     FROM odometer_entries WHERE car_id = ? AND deleted_at IS NULL
     ORDER BY ${ODOMETER_ORDER}`,
    carId,
  );
}

/** Was the mileage updated on the given day? Skips that day's reminder (BR-09, D-50). */
export async function hasOdometerEntryToday(db: SQLiteDatabase, carId: string, entryDate: LocalDate): Promise<boolean> {
  const row = await db.getFirstAsync<{ present: number }>(
    `SELECT EXISTS (
       SELECT 1 FROM odometer_entries
       WHERE car_id = ? AND deleted_at IS NULL AND entry_date = ?
     ) AS present`,
    carId,
    entryDate,
  );
  return row?.present === 1;
}

function assertOdometerValue(valueKm: number): void {
  if (!Number.isInteger(valueKm) || valueKm < 0 || valueKm > 9_999_999) {
    throw new Error('Odometer must be a whole number between 0 and 9,999,999.');
  }
}

/** D-50 / DB-18: only the latest entry may be edited or deleted. */
async function findEditableEntry(db: SQLiteDatabase, entryId: string) {
  const entry = await db.getFirstAsync<{ id: string; carId: string; valueKm: number }>(
    'SELECT id, car_id AS carId, value_km AS valueKm FROM odometer_entries WHERE id = ? AND deleted_at IS NULL',
    entryId,
  );
  if (!entry) throw new Error('Odometer entry was not found.');
  const latest = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM odometer_entries WHERE car_id = ? AND deleted_at IS NULL
     ORDER BY ${ODOMETER_ORDER} LIMIT 1`,
    entry.carId,
  );
  if (latest?.id !== entry.id) throw new Error('Only the latest odometer entry can be edited or deleted.');
  return entry;
}

/** D-50 / DB-18: no live service record may sit above the resulting current odometer. */
async function assertAboveServiceRecords(db: SQLiteDatabase, carId: string, valueKm: number): Promise<void> {
  const row = await db.getFirstAsync<{ serviceKm: number | null }>(
    `SELECT MAX(service_km) AS serviceKm FROM service_records
     WHERE car_id = ? AND deleted_at IS NULL AND kind = 'service'`,
    carId,
  );
  if (row?.serviceKm != null && valueKm < row.serviceKm) {
    throw new Error(`Odometer cannot be below ${row.serviceKm.toLocaleString()} km, the highest service record.`);
  }
}

/** Highest live value other than `entry`; null when it is the only entry. */
async function maxOtherEntryValue(
  db: SQLiteDatabase,
  entry: { id: string; carId: string },
): Promise<number | null> {
  const row = await db.getFirstAsync<{ value: number | null }>(
    `SELECT MAX(value_km) AS value FROM odometer_entries
     WHERE car_id = ? AND deleted_at IS NULL AND id <> ?`,
    entry.carId,
    entry.id,
  );
  return row?.value ?? null;
}

export async function updateOdometerEntry(db: SQLiteDatabase, entryId: string, valueKm: number): Promise<void> {
  assertOdometerValue(valueKm);
  const entry = await findEditableEntry(db, entryId);
  const next = await maxOtherEntryValue(db, entry);
  if (next !== null && valueKm < next) {
    throw new Error(`Odometer cannot go below ${next.toLocaleString()} km, the next mileage entry.`);
  }
  await assertAboveServiceRecords(db, entry.carId, valueKm);
  await db.runAsync(
    'UPDATE odometer_entries SET value_km = ?, updated_at = ? WHERE id = ?',
    valueKm,
    new Date().toISOString(),
    entryId,
  );
}

export async function deleteOdometerEntry(db: SQLiteDatabase, entryId: string): Promise<void> {
  const entry = await findEditableEntry(db, entryId);
  const remaining = await maxOtherEntryValue(db, entry);
  if (remaining === null) throw new Error('The last odometer entry cannot be deleted.');
  await assertAboveServiceRecords(db, entry.carId, remaining);
  const timestamp = new Date().toISOString();
  await db.runAsync(
    'UPDATE odometer_entries SET deleted_at = ?, updated_at = ? WHERE id = ?',
    timestamp,
    timestamp,
    entryId,
  );
}

export async function updateOdometer(db: SQLiteDatabase, carId: string, valueKm: number): Promise<void> {
  assertOdometerValue(valueKm);
  const current = await db.getFirstAsync<{ value: number | null }>(
    'SELECT MAX(value_km) AS value FROM odometer_entries WHERE car_id = ? AND deleted_at IS NULL',
    carId,
  );
  if (current?.value === null || current?.value === undefined) throw new Error('Current odometer is missing.');
  if (valueKm < current.value) throw new Error(`Odometer cannot go below ${current.value.toLocaleString()} km.`);
  const timestamp = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO odometer_entries (id, car_id, value_km, entry_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    Crypto.randomUUID(),
    carId,
    valueKm,
    jsDateToLocalDate(new Date()),
    timestamp,
    timestamp,
  );
}

export async function getPartDetail(db: SQLiteDatabase, partId: string): Promise<PartDetail> {
    const dashboard = await db.getAllAsync<DashboardRow>(
      `SELECT c.id AS carId, c.name AS carName,
         (SELECT MAX(value_km) FROM odometer_entries WHERE car_id = c.id AND deleted_at IS NULL) AS currentOdometerKm,
         p.id, p.name, cat.name AS categoryName, p.interval_type AS intervalType,
         p.distance_km AS distanceKm, p.months, p.inspection_months AS inspectionMonths,
         p.created_at AS createdAt, p.include_in_reminders AS includeInReminders,
         p.template_code AS templateCode,
         sr.service_km AS serviceKm, sr.service_date AS serviceDate,
         i.service_date AS lastInspectionDate
       FROM parts p
       JOIN cars c ON c.id = p.car_id AND c.deleted_at IS NULL
       JOIN categories cat ON cat.id = p.category_id
       LEFT JOIN service_records sr ON sr.id = (
         SELECT candidate.id FROM service_records candidate
         WHERE candidate.part_id = p.id AND candidate.deleted_at IS NULL AND candidate.kind = 'service'
         ORDER BY candidate.service_date IS NULL, candidate.service_date DESC,
                  candidate.service_km IS NULL, candidate.service_km DESC,
                  candidate.created_at DESC
         LIMIT 1
       )
       LEFT JOIN service_records i ON i.id = (
         SELECT candidate.id FROM service_records candidate
         WHERE candidate.part_id = p.id AND candidate.deleted_at IS NULL AND candidate.kind = 'inspection'
         ORDER BY candidate.service_date DESC
         LIMIT 1
       )
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      partId,
    );
    const row = dashboard[0];
    if (!row || row.currentOdometerKm === null) throw new Error('Part or current odometer was not found.');
    const history = await db.getAllAsync<ServiceHistoryRecord>(
      `SELECT id, kind, service_km AS serviceKm, service_date AS serviceDate,
         cost_minor AS costMinor, cost_currency AS costCurrency, notes,
         is_baseline AS isBaseline
       FROM service_records
       WHERE part_id = ? AND deleted_at IS NULL
       ORDER BY service_date IS NULL, service_date DESC, created_at DESC`,
      partId,
    );
    return {
      part: toDashboardPart(row, row.currentOdometerKm),
      history: history.map((record) => ({ ...record, isBaseline: Boolean(record.isBaseline) })),
    };
  }

export interface ServiceRecordInput {
    partId: string;
    serviceKm: number | null;
    serviceDate: LocalDate | null;
    costMinor: number | null;
    costCurrency: string | null;
    notes: string | null;
  }

function validateServiceValues(
  input: { serviceKm: number | null; serviceDate: LocalDate | null; costMinor: number | null; costCurrency: string | null },
  isBaseline: boolean,
): void {
  if (input.serviceKm !== null && (!Number.isInteger(input.serviceKm) || input.serviceKm < 0 || input.serviceKm > 9_999_999)) {
    throw new Error('Service km must be a whole number between 0 and 9,999,999.');
  }
  if (input.serviceDate !== null && !isLocalDate(input.serviceDate)) {
    throw new Error('Service date must use YYYY-MM-DD.');
  }
  if (input.serviceKm === null && input.serviceDate === null) {
    throw new Error('Enter a service km or date.');
  }
  if (!isBaseline && (input.serviceKm === null || input.serviceDate === null)) {
    throw new Error('Service km and date are required.');
  }
  if (input.costMinor !== null && (!Number.isInteger(input.costMinor) || input.costMinor < 0 || !input.costCurrency)) {
    throw new Error('A cost must include a non-negative amount and currency.');
  }
}

function assertNotFutureDate(date: LocalDate, label: string): void {
  if (date > jsDateToLocalDate(new Date())) {
    throw new Error(`${label} cannot be in the future.`);
  }
}

/** BR-07: a service record's km cannot exceed the current odometer and its date cannot be in the future. */
async function assertServiceRecordFitsOdometer(
  db: SQLiteDatabase,
  carId: string,
  input: { serviceKm: number | null; serviceDate: LocalDate | null },
): Promise<void> {
  if (input.serviceDate !== null) assertNotFutureDate(input.serviceDate, 'Service date');
  if (input.serviceKm === null) return;
  const row = await db.getFirstAsync<{ value: number | null }>(
    'SELECT MAX(value_km) AS value FROM odometer_entries WHERE car_id = ? AND deleted_at IS NULL',
    carId,
  );
  if (row?.value != null && input.serviceKm > row.value) {
    throw new Error(`Service km cannot exceed ${row.value.toLocaleString()} km, the current odometer.`);
  }
}

export async function addServiceRecord(db: SQLiteDatabase, input: ServiceRecordInput): Promise<void> {
    validateServiceValues(input, false);
    const part = await db.getFirstAsync<{ carId: string }>(
      'SELECT car_id AS carId FROM parts WHERE id = ? AND deleted_at IS NULL',
      input.partId,
    );
    if (!part) throw new Error('Part was not found.');
    await assertServiceRecordFitsOdometer(db, part.carId, input);
    const timestamp = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO service_records (
        id, car_id, part_id, kind, service_km, service_date, is_baseline,
        cost_minor, cost_currency, notes, created_at, updated_at
      ) VALUES (?, ?, ?, 'service', ?, ?, 0, ?, ?, ?, ?, ?)`,
      Crypto.randomUUID(),
      part.carId,
      input.partId,
      input.serviceKm,
      input.serviceDate,
      input.costMinor,
      input.costCurrency,
      input.notes,
      timestamp,
      timestamp,
    );
}

export interface ServiceRecordUpdateInput {
  serviceKm: number | null;
  serviceDate: LocalDate | null;
  costMinor: number | null;
  costCurrency: string | null;
  notes: string | null;
}

/** Edits a history record; the active record is recomputed by the read queries (AC-18). */
export async function updateServiceRecord(db: SQLiteDatabase, recordId: string, input: ServiceRecordUpdateInput): Promise<void> {
  const record = await db.getFirstAsync<{ kind: 'service' | 'inspection'; isBaseline: number; carId: string }>(
    'SELECT kind, is_baseline AS isBaseline, car_id AS carId FROM service_records WHERE id = ? AND deleted_at IS NULL',
    recordId,
  );
  if (!record) throw new Error('Service record was not found.');
  const timestamp = new Date().toISOString();
  if (record.kind === 'inspection') {
    if (input.serviceDate === null || !isLocalDate(input.serviceDate)) {
      throw new Error('Inspection date must use YYYY-MM-DD.');
    }
    assertNotFutureDate(input.serviceDate, 'Inspection date');
    await db.runAsync(
      'UPDATE service_records SET service_date = ?, notes = ?, updated_at = ? WHERE id = ?',
      input.serviceDate,
      input.notes,
      timestamp,
      recordId,
    );
    return;
  }
  validateServiceValues(input, Boolean(record.isBaseline));
  await assertServiceRecordFitsOdometer(db, record.carId, input);
  await db.runAsync(
    `UPDATE service_records SET service_km = ?, service_date = ?, cost_minor = ?,
       cost_currency = ?, notes = ?, updated_at = ? WHERE id = ?`,
    input.serviceKm,
    input.serviceDate,
    input.costMinor,
    input.costCurrency,
    input.notes,
    timestamp,
    recordId,
  );
}

export async function deleteServiceRecord(db: SQLiteDatabase, recordId: string): Promise<void> {
  const record = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM service_records WHERE id = ? AND deleted_at IS NULL',
    recordId,
  );
  if (!record) throw new Error('Service record was not found.');
  const timestamp = new Date().toISOString();
  await db.runAsync(
    'UPDATE service_records SET deleted_at = ?, updated_at = ? WHERE id = ?',
    timestamp,
    timestamp,
    recordId,
  );
}

export interface InspectionInput {
  partId: string;
  inspectionDate: LocalDate;
}

/** Records an inspection of a condition-based part (BR-08, DB-11). */
export async function addInspection(db: SQLiteDatabase, input: InspectionInput): Promise<void> {
  if (!isLocalDate(input.inspectionDate)) {
    throw new Error('Inspection date must use YYYY-MM-DD.');
  }
  assertNotFutureDate(input.inspectionDate, 'Inspection date');
  const part = await db.getFirstAsync<{ carId: string; intervalType: string }>(
    'SELECT car_id AS carId, interval_type AS intervalType FROM parts WHERE id = ? AND deleted_at IS NULL',
    input.partId,
  );
  if (!part) throw new Error('Part was not found.');
  if (part.intervalType !== 'condition') throw new Error('Only inspection-based parts can be inspected.');
  const timestamp = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO service_records (
      id, car_id, part_id, kind, service_km, service_date, is_baseline,
      cost_minor, cost_currency, notes, created_at, updated_at
    ) VALUES (?, ?, ?, 'inspection', NULL, ?, 0, NULL, NULL, NULL, ?, ?)`,
    Crypto.randomUUID(),
    part.carId,
    input.partId,
    input.inspectionDate,
    timestamp,
    timestamp,
  );
}

export interface SetupPart {
  id: string;
  name: string;
  categoryId: string;
}

export interface BaselineInput {
  partId: string;
  serviceKm: number | null;
  serviceDate: string | null;
}

export async function getSetupParts(db: SQLiteDatabase, carId: string): Promise<SetupPart[]> {
  return db.getAllAsync<SetupPart>(
    `SELECT id, name, category_id AS categoryId
     FROM parts
     WHERE car_id = ? AND deleted_at IS NULL
     ORDER BY category_id, sort_order`,
    carId,
  );
}

export async function saveBaselineRecords(
  db: SQLiteDatabase,
  carId: string,
  records: BaselineInput[],
): Promise<void> {
  const parts = await getSetupParts(db, carId);
  const partIds = new Set(parts.map((part) => part.id));
  const timestamp = new Date().toISOString();

  for (const record of records) {
    if (!partIds.has(record.partId)) throw new Error('A setup part does not belong to this car.');
    if (record.serviceKm === null && record.serviceDate === null) continue;
    if (
      (record.serviceKm !== null &&
        (!Number.isInteger(record.serviceKm) || record.serviceKm < 0 || record.serviceKm > 9_999_999)) ||
      (record.serviceDate !== null && !isLocalDate(record.serviceDate))
    ) {
      throw new Error('Enter a valid whole-number km or date in YYYY-MM-DD format.');
    }
  }

  await db.withTransactionAsync(async () => {
    for (const record of records) {
      if (record.serviceKm === null && record.serviceDate === null) continue;
      await db.runAsync(
        `INSERT INTO service_records (
          id, car_id, part_id, kind, service_km, service_date, is_baseline, created_at, updated_at
        ) VALUES (?, ?, ?, 'service', ?, ?, 1, ?, ?)`,
        Crypto.randomUUID(),
        carId,
        record.partId,
        record.serviceKm,
        record.serviceDate,
        timestamp,
        timestamp,
      );
    }
  });
}

function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

type TemplateRow = {
  code: string;
  category_id: string;
  name: string;
  interval_type: string;
  distance_km: number | null;
  months: number | null;
  inspection_months: number | null;
  sort_order: number;
};

/** Creates the car, its first odometer reading, and its profile-matching default parts (FR-010, FR-025, FR-031). */
export async function createCar(db: SQLiteDatabase, input: CreateCarInput): Promise<CreatedCar> {
  const car = parseCreateCarInput(input);
  const carId = Crypto.randomUUID();
  const odometerEntryId = Crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const hasDpf = car.hasDpf ? 1 : 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO cars (
        id, name, fuel_type, timing_drive, gearbox, has_dpf, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      carId,
      car.name,
      car.fuelType,
      car.timingDrive,
      car.gearbox,
      hasDpf,
      timestamp,
      timestamp,
    );

    await db.runAsync(
      `INSERT INTO odometer_entries (
        id, car_id, value_km, entry_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      odometerEntryId,
      carId,
      car.initialOdometerKm,
      car.entryDate,
      timestamp,
      timestamp,
    );

    const templates = await db.getAllAsync<TemplateRow>(
      `SELECT code, category_id, name, interval_type, distance_km, months, inspection_months, sort_order
       FROM part_templates
       WHERE (fuel_type IS NULL OR fuel_type = ?)
         AND (timing_drive IS NULL OR timing_drive = ?)
         AND (requires_dpf = 0 OR ? = 1)
         AND retired_at IS NULL
       ORDER BY category_id, sort_order`,
      car.fuelType,
      car.timingDrive,
      hasDpf,
    );

    for (const template of templates) {
      await db.runAsync(
        `INSERT INTO parts (
          id, car_id, category_id, template_code, name, interval_type, distance_km, months,
          inspection_months, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `${carId}:${template.code}`,
        carId,
        template.category_id,
        template.code,
        template.name,
        template.interval_type,
        template.distance_km,
        template.months,
        template.inspection_months,
        template.sort_order,
        timestamp,
        timestamp,
      );
    }
  });

  return { carId, odometerEntryId };
}
