import type { SQLiteDatabase } from 'expo-sqlite';

type Template = readonly [
  code: string,
  categoryId: string,
  name: string,
  fuelType: 'petrol' | 'diesel' | null,
  timingDrive: 'belt' | 'chain' | null,
  requiresDpf: 0 | 1,
  intervalType: 'distance' | 'time' | 'both' | 'condition',
  distanceKm: number | null,
  months: number | null,
  inspectionMonths: number | null,
  sortOrder: number,
];

const CATEGORIES = [
  ['engine', 'Engine'],
  ['filters', 'Filters'],
  ['fuel', 'Fuel'],
  ['brakes', 'Brakes'],
  ['fluids', 'Fluids'],
  ['tires', 'Tires'],
  ['electrical', 'Electrical'],
  ['visibility', 'Visibility'],
  ['emissions', 'Emissions'],
] as const;

// Appendix A is data, not application logic (D-09, D-47).
const TEMPLATES: readonly Template[] = [
  ['engine-oil', 'engine', 'Engine oil', null, null, 0, 'both', 10_000, 12, null, 1],
  ['oil-filter', 'engine', 'Oil filter', null, null, 0, 'both', 10_000, 12, null, 2],
  ['spark-plugs', 'engine', 'Spark plugs', 'petrol', null, 0, 'distance', 30_000, null, null, 3],
  ['timing-belt', 'engine', 'Timing belt', null, 'belt', 0, 'both', null, null, null, 4],
  ['drive-belt', 'engine', 'Drive/serpentine belt', null, null, 0, 'condition', null, null, 3, 5],
  ['air-filter', 'filters', 'Air filter', null, null, 0, 'distance', 15_000, null, null, 1],
  ['cabin-filter', 'filters', 'Cabin filter', null, null, 0, 'both', 20_000, 12, null, 2],
  ['fuel-filter', 'fuel', 'Fuel filter', 'diesel', null, 0, 'distance', 30_000, null, null, 1],
  ['glow-plugs', 'fuel', 'Glow plugs', 'diesel', null, 0, 'distance', 120_000, null, null, 2],
  ['brake-fluid', 'brakes', 'Brake fluid', null, null, 0, 'time', null, 24, null, 1],
  ['brake-pads-discs', 'brakes', 'Brake pads and discs', null, null, 0, 'condition', null, null, 3, 2],
  ['coolant', 'fluids', 'Coolant', null, null, 0, 'both', 100_000, 60, null, 1],
  ['gearbox-oil', 'fluids', 'Transmission or gearbox oil', null, null, 0, 'distance', null, null, null, 2],
  ['tire-rotation', 'tires', 'Rotation', null, null, 0, 'distance', 10_000, null, null, 1],
  ['tire-replacement-alignment', 'tires', 'Replacement and alignment', null, null, 0, 'condition', null, null, 3, 2],
  ['battery', 'electrical', 'Battery', null, null, 0, 'time', null, 48, null, 1],
  ['wiper-blades', 'visibility', 'Wiper blades', null, null, 0, 'time', null, 12, null, 1],
  ['dpf', 'emissions', 'DPF', 'diesel', null, 1, 'condition', null, null, 3, 1],
];

const SCHEMA_V1 = `
  CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE cars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('petrol', 'diesel')),
    timing_drive TEXT NOT NULL CHECK (timing_drive IN ('belt', 'chain')),
    gearbox TEXT NOT NULL CHECK (gearbox IN ('manual', 'automatic')),
    has_dpf INTEGER NOT NULL DEFAULT 0 CHECK (has_dpf IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (fuel_type = 'diesel' OR has_dpf = 0)
  );

  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE part_templates (
    code TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    fuel_type TEXT CHECK (fuel_type IN ('petrol', 'diesel')),
    timing_drive TEXT CHECK (timing_drive IN ('belt', 'chain')),
    requires_dpf INTEGER NOT NULL DEFAULT 0 CHECK (requires_dpf IN (0, 1)),
    interval_type TEXT NOT NULL CHECK (interval_type IN ('distance', 'time', 'both', 'condition')),
    distance_km INTEGER CHECK (distance_km > 0),
    months INTEGER CHECK (months > 0),
    inspection_months INTEGER CHECK (inspection_months BETWEEN 1 AND 60),
    sort_order INTEGER NOT NULL,
    template_version INTEGER NOT NULL,
    retired_at TEXT,
    CHECK (
      (interval_type = 'distance' AND months IS NULL) OR
      (interval_type = 'time' AND distance_km IS NULL) OR
      interval_type = 'both' OR
      (interval_type = 'condition' AND distance_km IS NULL AND months IS NULL AND inspection_months IS NOT NULL)
    ),
    CHECK (interval_type = 'condition' OR inspection_months IS NULL)
  );

  CREATE TABLE parts (
    id TEXT PRIMARY KEY,
    car_id TEXT NOT NULL REFERENCES cars(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    template_code TEXT REFERENCES part_templates(code),
    name TEXT NOT NULL,
    interval_type TEXT NOT NULL CHECK (interval_type IN ('distance', 'time', 'both', 'condition')),
    distance_km INTEGER CHECK (distance_km BETWEEN 1 AND 9999999),
    months INTEGER CHECK (months BETWEEN 1 AND 240),
    inspection_months INTEGER CHECK (inspection_months BETWEEN 1 AND 60),
    include_in_reminders INTEGER NOT NULL DEFAULT 1 CHECK (include_in_reminders IN (0, 1)),
    hidden_by TEXT CHECK (hidden_by IN ('user', 'profile')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (template_code IS NULL OR id = car_id || ':' || template_code),
    CHECK (interval_type <> 'distance' OR months IS NULL),
    CHECK (interval_type <> 'time' OR distance_km IS NULL),
    CHECK (interval_type <> 'condition' OR (inspection_months IS NOT NULL AND distance_km IS NULL AND months IS NULL)),
    CHECK (interval_type = 'condition' OR inspection_months IS NULL),
    CHECK (hidden_by IS NULL OR template_code IS NOT NULL)
  );

  CREATE TABLE odometer_entries (
    id TEXT PRIMARY KEY,
    car_id TEXT NOT NULL REFERENCES cars(id),
    value_km INTEGER NOT NULL CHECK (value_km BETWEEN 0 AND 9999999),
    entry_date TEXT NOT NULL CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(entry_date) = entry_date),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE service_records (
    id TEXT PRIMARY KEY,
    car_id TEXT NOT NULL REFERENCES cars(id),
    part_id TEXT NOT NULL REFERENCES parts(id),
    kind TEXT NOT NULL DEFAULT 'service' CHECK (kind IN ('service', 'inspection')),
    service_km INTEGER CHECK (service_km BETWEEN 0 AND 9999999),
    service_date TEXT CHECK (service_date IS NULL OR (service_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(service_date) = service_date)),
    is_baseline INTEGER NOT NULL DEFAULT 0 CHECK (is_baseline IN (0, 1)),
    cost_minor INTEGER CHECK (cost_minor >= 0),
    cost_currency TEXT CHECK (cost_currency GLOB '[A-Z][A-Z][A-Z]'),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK (cost_minor IS NULL OR cost_currency IS NOT NULL),
    CHECK (cost_minor IS NULL OR kind = 'service'),
    CHECK (is_baseline = 0 OR kind = 'service'),
    CHECK (kind <> 'inspection' OR (service_date IS NOT NULL AND service_km IS NULL)),
    CHECK (kind <> 'service' OR is_baseline = 1 OR (service_km IS NOT NULL AND service_date IS NOT NULL)),
    CHECK (kind <> 'service' OR is_baseline = 0 OR service_km IS NOT NULL OR service_date IS NOT NULL)
  );

  CREATE INDEX parts_by_car ON parts(car_id, category_id, sort_order) WHERE deleted_at IS NULL;
  CREATE INDEX odometer_entries_by_car ON odometer_entries(car_id, value_km DESC, entry_date DESC, created_at DESC) WHERE deleted_at IS NULL;
  CREATE INDEX service_records_by_part ON service_records(part_id, kind, service_date DESC, service_km DESC) WHERE deleted_at IS NULL;
`;

const SCHEMA_V2 = `
  CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reminders_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminders_enabled IN (0, 1)),
    reminder_time TEXT NOT NULL DEFAULT '09:00' CHECK (reminder_time GLOB '[0-2][0-9]:[0-5][0-9]'),
    currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
    updated_at TEXT NOT NULL
  );
`;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version === null) throw new Error('Could not read the database schema version.');
  if (version.user_version > 2) throw new Error('Database schema is newer than this app supports.');

  await db.withTransactionAsync(async () => {
    if (version.user_version === 0) {
      await db.execAsync(SCHEMA_V1);
      await seedReferenceData(db);
      await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', 1, new Date().toISOString());
      await db.execAsync('PRAGMA user_version = 1');
    }
    if (version.user_version < 2) {
      await db.execAsync(SCHEMA_V2);
      await db.runAsync(
        `INSERT INTO app_settings (id, updated_at) VALUES (1, ?)`,
        new Date().toISOString(),
      );
      await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', 2, new Date().toISOString());
      await db.execAsync('PRAGMA user_version = 2');
    }
  });
}

async function seedReferenceData(db: SQLiteDatabase): Promise<void> {
  for (const [index, [id, name]] of CATEGORIES.entries()) {
    await db.runAsync('INSERT INTO categories (id, code, name, sort_order) VALUES (?, ?, ?, ?)', id, id, name, index + 1);
  }

  for (const template of TEMPLATES) {
    await db.runAsync(
      `INSERT INTO part_templates (
        code, category_id, name, fuel_type, timing_drive, requires_dpf, interval_type,
        distance_km, months, inspection_months, sort_order, template_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ...template,
    );
  }
}
