# DBD · Table definitions (device)

> Part of [07-database-design.md](../07-database-design.md). Sections: §4. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 4. Table definitions

### 4.1 `users`

A local mirror of the authenticated identity. Credentials and passwords never enter this database (NFR-024).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | | Authentication subject from the provider. **Not** a UUID (DB-08 exception) |
| `email` | TEXT | no | | Cached for Settings (FR-110); refreshed on sign-in |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | |
| `deleted_at` | TEXT | yes | `NULL` | Account deletion (Release 2, FR-140) |
| `origin_device_id` | TEXT | no | | |

Primary key: `id`.

### 4.2 `user_settings`

One row per user. Missing row = defaults; the app inserts it on first run.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `user_id` | TEXT | no | | PK, `REFERENCES users(id)` |
| `reminder_enabled` | INTEGER | no | `1` | `IN (0,1)` (FR-083) |
| `reminder_time` | TEXT | no | `'20:00'` | `GLOB '[0-2][0-9]:[0-5][0-9]' AND BETWEEN '00:00' AND '23:59'` (A-08) |
| `currency_code` | TEXT | no | | Three uppercase letters; ISO 4217 (A-12, D-29) |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | |
| `deleted_at` | TEXT | yes | `NULL` | |
| `origin_device_id` | TEXT | no | | |

Distance unit and locale are Release 2 settings and are added by migration; storing a value that has no behaviour yet is noise (DB-14).

### 4.3 `cars`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | TEXT | no | | PK, UUID v4 |
| `user_id` | TEXT | no | | `REFERENCES users(id)` |
| `name` | TEXT | no | | 1 to 60 characters after trim (FR-010) |
| `fuel_type` | TEXT | no | | `IN ('petrol','diesel')` (D-15) |
| `timing_drive` | TEXT | no | | `IN ('belt','chain')` |
| `gearbox` | TEXT | no | | `IN ('manual','automatic')` |
| `has_dpf` | INTEGER | no | `0` | `IN (0,1)`, and `fuel_type = 'diesel' OR has_dpf = 0` |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | |
| `deleted_at` | TEXT | yes | `NULL` | |
| `origin_device_id` | TEXT | no | | |

No `current_odometer` column: the current odometer is `MAX(value_km)` over live `odometer_entries` (BR-01, DB-09, DB-18).

The table also carries `UNIQUE (id, user_id)`. It is redundant with the primary key and exists only so child tables can hold a composite `(car_id, user_id)` foreign key that can never point at another owner's car after a bad merge (DB-26).

### 4.4 `categories`

Two kinds of row share the table. **System** rows are seeded, have `user_id IS NULL`, use their `code` as `id`, and are never synced. **Custom** rows (Release 2, A-11) carry the owner's `user_id`, a UUID, and the full envelope.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | TEXT | no | | PK. System rows: the `code`. Custom rows: UUID v4 |
| `user_id` | TEXT | yes | `NULL` | `NULL` = shipped; otherwise `REFERENCES users(id)` |
| `code` | TEXT | no | | Stable identifier: `engine`, `filters`, … |
| `name` | TEXT | no | | Display name, English in Release 1 |
| `sort_order` | INTEGER | no | | 1 to 9 for system rows |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | Seed time for system rows |
| `deleted_at` | TEXT | yes | `NULL` | Custom rows only |
| `origin_device_id` | TEXT | yes | `NULL` | `NULL` for system rows (DB-15) |

Checks:

```sql
CHECK ((user_id IS NULL) = (origin_device_id IS NULL)),   -- system rows are never synced
CHECK (user_id IS NOT NULL OR id = code),                 -- system rows are keyed by their code
CHECK (user_id IS NOT NULL OR deleted_at IS NULL)          -- system rows are never deleted
```

Indexes: `UNIQUE (code) WHERE user_id IS NULL`; `UNIQUE (user_id, code) WHERE user_id IS NOT NULL`.

Deleting a custom category is a Release 2 action and is blocked while it still contains live parts: the owner moves or deletes them first (OQ-11). Reassigning parts silently would change what the owner sees.

### 4.5 `part_templates`

The default catalog of PRD Appendix A, as data (FR-030, NFR-081). Local reference data: seeded on every database, never synced, never joined to a user. The primary key is the stable `code`.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `code` | TEXT | no | | PK; stable across releases |
| `category_id` | TEXT | no | | `REFERENCES categories(id)`; a system category |
| `name` | TEXT | no | | English display name |
| `fuel_type` | TEXT | yes | `NULL` | `IN ('petrol','diesel')`; `NULL` = both |
| `timing_drive` | TEXT | yes | `NULL` | `IN ('belt','chain')`; `NULL` = either |
| `requires_dpf` | INTEGER | no | `0` | `IN (0,1)` |
| `interval_type` | TEXT | no | | `IN ('distance','time','both','condition')` |
| `distance_km` | INTEGER | yes | `NULL` | `> 0`; `NULL` = owner must set it (BR-12) |
| `months` | INTEGER | yes | `NULL` | `> 0`; `NULL` = owner must set it |
| `inspection_months` | INTEGER | yes | `NULL` | `BETWEEN 1 AND 60`; set on condition rows only (A-09) |
| `sort_order` | INTEGER | no | | Display order inside the category |
| `template_version` | INTEGER | no | | Version that introduced or last changed the row |
| `retired_at` | TEXT | yes | `NULL` | Local marker; retired templates stop being offered |

Interval consistency:

```sql
CHECK (
  (interval_type = 'distance'  AND months IS NULL) OR
  (interval_type = 'time'      AND distance_km IS NULL) OR
  (interval_type = 'both') OR
  (interval_type = 'condition' AND distance_km IS NULL AND months IS NULL
                               AND inspection_months IS NOT NULL)
),
CHECK (interval_type = 'condition' OR inspection_months IS NULL)
```

No timestamps and no envelope: the seed version is tracked by `schema_migrations`, and a template is never merged. Retiring a template never touches existing parts, because a part copies its values at creation (DB-05).

### 4.6 `parts`

One row per tracked part of a car, default or custom. Default and custom parts are the same shape (BR-14); `template_code` records provenance and makes the key deterministic.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | TEXT | no | | PK. Template part: `carId:templateCode`. Custom part: UUID v4 |
| `user_id` | TEXT | no | | `REFERENCES users(id)` |
| `car_id` | TEXT | no | | `REFERENCES cars(id, user_id)` |
| `category_id` | TEXT | no | | `REFERENCES categories(id)`; plain key, system categories have no `user_id` |
| `template_code` | TEXT | yes | `NULL` | `REFERENCES part_templates(code)`; `NULL` = custom part |
| `name` | TEXT | no | | Copied from the template at creation, editable (FR-034) |
| `interval_type` | TEXT | no | | `IN ('distance','time','both','condition')` |
| `distance_km` | INTEGER | yes | `NULL` | `BETWEEN 1 AND 9999999`; `NULL` = not set yet |
| `months` | INTEGER | yes | `NULL` | `BETWEEN 1 AND 240`; `NULL` = not set yet |
| `inspection_months` | INTEGER | yes | `NULL` | `BETWEEN 1 AND 60`; required for `condition`, copied from the template (A-09) |
| `include_in_reminders` | INTEGER | no | `1` | `IN (0,1)`; applies to every part type (DB-17) |
| `hidden_by` | TEXT | yes | `NULL` | `IN ('user','profile')`; `NULL` = visible (DB-02) |
| `sort_order` | INTEGER | no | `0` | Copied from the template; custom parts append |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | |
| `deleted_at` | TEXT | yes | `NULL` | |
| `origin_device_id` | TEXT | no | | |

Additional checks:

```sql
CHECK (template_code IS NULL OR id = car_id || ':' || template_code),  -- merge-safe key (DB-16)
CHECK (interval_type <> 'distance' OR months IS NULL),
CHECK (interval_type <> 'time' OR distance_km IS NULL),
CHECK (interval_type <> 'condition' OR (inspection_months IS NOT NULL
                                        AND distance_km IS NULL
                                        AND months IS NULL)),
CHECK (interval_type = 'condition' OR inspection_months IS NULL),
CHECK (hidden_by IS NULL OR template_code IS NOT NULL)   -- custom parts are deleted, not hidden
```

Indexes: `(car_id) WHERE deleted_at IS NULL`; `(car_id, category_id, sort_order)`;
`UNIQUE (car_id, template_code) WHERE template_code IS NOT NULL`; `UNIQUE (id, user_id)`, for the composite key `service_records` needs (DB-26).

`include_in_reminders` is the setting the SRS calls the part's "alert setting" (FR-090). It is named for what it actually controls: whether the part appears in the daily reminder's inspection, due, and overdue lines (FR-082), which applies to distance-only and condition-based parts too. **It is on by default for every part** (A-06, revised in v0.4), because a part the owner never configured must still be reported when it is overdue; the owner turns it off per part. Scheduling a separate due-date notification still requires a time interval (FR-091).

`hidden_by` distinguishes the two ways a part can disappear: the owner hid it (`user`) and it stays hidden, or a car-profile change hid it (`profile`) and switching the profile back restores it. A profile change sets `'profile'` only where the column is `NULL`; a part the owner hid keeps `'user'` (D-34). Re-adding through "+ Add part" clears the column. A custom part is never hidden (FR-035).

### 4.7 `odometer_entries`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | TEXT | no | | PK, UUID v4 |
| `user_id` | TEXT | no | | `REFERENCES users(id)` |
| `car_id` | TEXT | no | | `REFERENCES cars(id, user_id)` |
| `value_km` | INTEGER | no | | `BETWEEN 0 AND 9999999` (A-03) |
| `entry_date` | TEXT | no | | `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'` and `date(entry_date) = entry_date` (D-29) |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | |
| `deleted_at` | TEXT | yes | `NULL` | |
| `origin_device_id` | TEXT | no | | |

Index: `(car_id, value_km DESC, entry_date DESC, created_at DESC) WHERE deleted_at IS NULL`.

**Ordering (DB-18).** Entries are ordered by `value_km DESC`, then `entry_date DESC`, then `created_at DESC`, then `id`. The first row in that order is "the latest entry"; equal values are allowed and never ambiguous.

**What may be edited or deleted.** Only the latest entry, after confirmation (FR-024). The guard also refuses an edit or deletion that would leave a live service record above the resulting odometer: the new maximum must be at least every live `service_records.service_km`. The last remaining entry cannot be deleted, because the car always needs a current odometer.

**"Updated today"** means at least one live entry with `entry_date` equal to today's local date, whatever its value. That is the condition that skips today's reminder (BR-09, FR-081).

**Equal value.** Entering a value equal to the current maximum is accepted and changes nothing observable (A-02); it creates a new row, which the ordering above handles. The alternative, silently discarding the entry, would hide the user's action.

### 4.8 `service_records`

Replacements, baselines, and inspections. One table, not two (DB-11): they share history position, timestamps, and sync; only the anchors and the cost differ, and the filter is one `kind = …` predicate.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | TEXT | no | | PK, UUID v4 |
| `user_id` | TEXT | no | | `REFERENCES users(id)` |
| `car_id` | TEXT | no | | `REFERENCES cars(id, user_id)` |
| `part_id` | TEXT | no | | `REFERENCES parts(id, user_id)` |
| `kind` | TEXT | no | `'service'` | `IN ('service','inspection')` |
| `service_km` | INTEGER | yes | `NULL` | `BETWEEN 0 AND 9999999`; `NULL` = unknown (D-32) |
| `service_date` | TEXT | yes | `NULL` | Local calendar date; `NULL` = unknown (D-32) |
| `is_baseline` | INTEGER | no | `0` | `IN (0,1)`; setup and "all serviced today" (D-26) |
| `cost_minor` | INTEGER | yes | `NULL` | `>= 0`; minor units |
| `cost_currency` | TEXT | yes | `NULL` | Three uppercase letters, ISO 4217 (D-29) |
| `notes` | TEXT | yes | `NULL` | |
| `created_at` | TEXT | no | | |
| `updated_at` | TEXT | no | | |
| `deleted_at` | TEXT | yes | `NULL` | |
| `origin_device_id` | TEXT | no | | |

Additional checks:

```sql
CHECK (cost_minor IS NULL OR cost_currency IS NOT NULL),
CHECK (cost_minor IS NULL OR kind = 'service'),                  -- inspections carry no cost
CHECK (is_baseline = 0 OR kind = 'service'),
CHECK (kind <> 'inspection' OR (service_date IS NOT NULL AND service_km IS NULL)),
-- D-12: a replacement needs both anchors; only a baseline may omit one (DB-19)
CHECK (kind <> 'service' OR is_baseline = 1
       OR (service_km IS NOT NULL AND service_date IS NOT NULL)),
CHECK (kind <> 'service' OR is_baseline = 0
       OR service_km IS NOT NULL OR service_date IS NOT NULL),
CHECK (service_date IS NULL
       OR (service_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
           AND date(service_date) = service_date))
```

The two baseline checks above keep D-32 representable without weakening D-12: a normal replacement always has km and date, while a setup or bulk baseline may carry only one of them (access control on the write path is not needed, the constraint is enough).

Indexes: `(part_id, service_date DESC, service_km DESC) WHERE deleted_at IS NULL`; `(car_id, service_date DESC)`.

### 4.9 `schema_migrations`

Device-local and cloud-local; never synced.

| Column | Type | Null | Constraint |
|---|---|---|---|
| `version` | INTEGER | no | PK, monotonically increasing |
| `applied_at` | TEXT | no | UTC timestamp |

### 4.10 Adapter-local tables (device only)

Never synced, never in the cloud. Document 07 §9 assigns sync bookkeeping to the adapter; these are the two tables it needs. The app creates them in the first migration.

| Table | Columns | Purpose |
|---|---|---|
| `local_meta` | `key` TEXT PK, `value` TEXT | `device_id`, `clock_offset_ms`, `last_user_id`, `pull_cursor`, `cloud_schema_version`, `conflicts_pending`, `notifications_built_for` |
| `sync_dirty` | `table_name` TEXT, `row_id` TEXT, `loaded_updated_at` TEXT, PK `(table_name, row_id)` | Rows changed locally and not yet acknowledged by a push |

`loaded_updated_at` is compared after each push: a row whose current `updated_at` still matches it is cleared from `sync_dirty`; a row changed while the push was in flight stays queued. Resetting app data empties both tables and generates a new `device_id`.

`conflicts_pending` holds the conflict list that the next home screen turns into a notice, stored whole so the notice can name the affected parts:

```json
[{"table":"parts","id":"car-1:engine_oil","label":"Engine oil"}]
```

It is written by the pull apply, cleared when the notice is shown, and never capped: the dataset is small (a merge touching every part is 17 rows), so capping would only hide the tail. The screen truncates the display. `notifications_built_for` holds the local date (`YYYY-MM-DD`) of the last rebuild, which the day-rollover check compares with today.
