# DBD · Derived values, reference queries, seed data

> Part of [07-database-design.md](../07-database-design.md). Sections: §6, §7, §8. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 6. Derived values

Nothing in this section is stored. Each is computed by one function and is the only place its rule lives.

### 6.1 Current odometer

```
current_odometer_km(car) = MAX(value_km) for live odometer_entries of that car
```

This definition holds after a merge as well (D-31, BR-01). A merge can leave a service record above the current odometer when two devices edited history concurrently; the record is kept, and until the odometer catches up the part shows a remaining distance greater than its interval. The write guard in §4.7 only prevents the app from creating that state locally.

### 6.2 Active record of a part

The active service record is the greatest service date; ties go to the greatest km (D-25). Records whose date is unknown rank after every dated record — only baselines can be in that state (DB-19), so a dated record always takes over once it exists (DB-10).

```sql
SELECT id, service_km, service_date
FROM service_records
WHERE part_id = :part_id AND kind = 'service' AND deleted_at IS NULL
ORDER BY service_date IS NULL,
         service_date DESC,
         service_km IS NULL,
         service_km DESC
LIMIT 1;
```

The same ordering, applied to `kind = 'inspection'`, gives the last inspection (A-16).

### 6.3 Remaining distance and time

Let `I` be the distance interval and `M` the time interval in calendar months.

```
remaining_km   = I - (current_odometer_km - active.service_km)        when both are known
due_date       = addMonths(active.service_date, M)                    clamped to month end (D-30)
remaining_days = due_date - today
```

`addMonths` clamps: 31 Jan + 1 month = 28 or 29 Feb (BR-03, D-30).

### 6.4 Status precedence

Evaluated in this order; the first match wins (BR-05).

| Order | Status | Condition |
|---|---|---|
| 1 | Inspect | `interval_type = 'condition'` (FR-044) |
| 2 | Set interval | A required interval value is missing (DB-13) |
| 3 | Unknown | No active service record; a time-only part whose active date is `NULL`; or a distance-only part whose active `service_km` is `NULL` (BR-20) |
| 4 | Overdue | `remaining_km <= 0`, or `remaining_days <= 0` |
| 5 | Due soon | `remaining_km <= min(I / 2, 1000)`, or `remaining_days <= min(30, floor(days_between(service_date, due_date) / 2))` |
| 6 | OK | Otherwise |

The time threshold is computed in days on purpose (DB-21): a 1-month interval has about 30 days between service and due date, so its half is about 15 days. Working in whole months would round that half down to 0 and mark the part Due soon immediately after a replacement (D-22).

A part whose active date is `NULL` is judged on distance only: it can be Overdue or Due soon by distance, never by time (BR-20). Symmetrically, a record with no `service_km` has no distance side: a time-only part, and a `both` part in that state, are judged on time alone, and a distance-only part in that state is Unknown (BR-20).

### 6.5 Inspection due

```
anchor = max of: last inspection date, last service date, local date of the part's created_at
         (null dates ignored; if all three are null, the part is not due)
due    = today >= addMonths(anchor, inspection_months)
```

Counting from the latest service record as well as the last inspection means a replacement resets the inspection cycle (DB-20): brake pads replaced today are not "inspection due" the same day.

### 6.6 "Needs attention" ordering

Three groups, in this order: Overdue, inspection due, Due soon. Within Overdue, the most negative remaining value first; within inspection due and Due soon, the nearest due date or smallest remaining distance first (FR-047, D-27).

### 6.7 Cost totals

Sum `cost_minor` of live `kind = 'service'`, `is_baseline = 0` rows, grouped by `cost_currency`. Baseline rows are excluded (D-26); inspections carry no cost.

---

## 7. Reference queries

```sql
-- Current odometer
SELECT MAX(value_km) FROM odometer_entries
WHERE car_id = :car_id AND deleted_at IS NULL;

-- Latest entry (the only one that may be edited or deleted)
SELECT * FROM odometer_entries
WHERE car_id = :car_id AND deleted_at IS NULL
ORDER BY value_km DESC, entry_date DESC, created_at DESC, id DESC
LIMIT 1;

-- Was the mileage updated today? (skips today's reminder)
SELECT EXISTS (
  SELECT 1 FROM odometer_entries
  WHERE car_id = :car_id AND deleted_at IS NULL AND entry_date = :today);

-- Home screen: live parts with their active service record and last inspection,
-- in category order (feeds §6.3 to §6.5)
SELECT p.id, p.name, p.category_id, p.interval_type, p.distance_km, p.months,
       p.inspection_months, p.include_in_reminders, p.created_at,
       a.service_km, a.service_date, i.service_date AS last_inspection_date
FROM parts p
JOIN categories c ON c.id = p.category_id
LEFT JOIN service_records a ON a.id = (
  SELECT s.id FROM service_records s
  WHERE s.part_id = p.id AND s.kind = 'service' AND s.deleted_at IS NULL
  ORDER BY s.service_date IS NULL, s.service_date DESC,
           s.service_km IS NULL, s.service_km DESC
  LIMIT 1)
LEFT JOIN service_records i ON i.id = (
  SELECT s.id FROM service_records s
  WHERE s.part_id = p.id AND s.kind = 'inspection' AND s.deleted_at IS NULL
  ORDER BY s.service_date DESC
  LIMIT 1)
WHERE p.car_id = :car_id AND p.deleted_at IS NULL AND p.hidden_by IS NULL
ORDER BY c.sort_order, p.sort_order, p.name;

-- Service history of a part, newest first
SELECT * FROM service_records
WHERE part_id = :part_id AND deleted_at IS NULL
ORDER BY service_date IS NULL, service_date DESC,
         service_km IS NULL, service_km DESC;

-- Cost total for a part or a car, per currency
SELECT cost_currency, SUM(cost_minor)
FROM service_records
WHERE part_id = :part_id AND deleted_at IS NULL
  AND kind = 'service' AND is_baseline = 0
GROUP BY cost_currency;
```

Status computation is not expressible as a query over one table because it depends on today's local date; it runs in the app layer once per home-screen load (NFR-002).

---

## 8. Seed data

Seeds run from a migration on every database (DB-15). System category IDs equal their codes; template IDs are their codes; neither is generated, so every install produces identical reference rows.

### 8.1 Categories

| `code` = `id` | `name` | `sort_order` |
|---|---|---|
| `engine` | Engine | 1 |
| `filters` | Filters | 2 |
| `fuel` | Fuel | 3 |
| `brakes` | Brakes | 4 |
| `fluids` | Fluids | 5 |
| `tires` | Tires | 6 |
| `electrical` | Electrical | 7 |
| `visibility` | Visibility | 8 |
| `emissions` | Emissions | 9 |

### 8.2 Part templates (PRD Appendix A)

| `code` | Category | Name | Fuel | Drive | DPF | Type | km | months | Inspect months |
|---|---|---|---|---|---|---|---|---|---|
| `engine_oil` | engine | Engine oil | | | | both | 10000 | 12 | |
| `engine_oil_filter` | engine | Engine oil filter | | | | both | 10000 | 12 | |
| `spark_plugs` | engine | Spark plugs | petrol | | | distance | 30000 | | |
| `timing_belt` | engine | Timing belt | | belt | | both | | | |
| `accessory_belt` | engine | Drive/serpentine belt | | | | condition | | | 3 |
| `air_filter` | filters | Air filter | | | | distance | 15000 | | |
| `cabin_filter` | filters | Cabin filter | | | | both | 20000 | 12 | |
| `fuel_filter` | fuel | Fuel filter | diesel | | | distance | 30000 | | |
| `glow_plugs` | fuel | Glow plugs | diesel | | | distance | 120000 | | |
| `brake_fluid` | brakes | Brake fluid | | | | time | | 24 | |
| `brake_pads_discs` | brakes | Brake pads and discs | | | | condition | | | 3 |
| `coolant` | fluids | Coolant | | | | both | 100000 | 60 | |
| `gearbox_oil` | fluids | Transmission or gearbox oil | | | | distance | | | |
| `tire_rotation` | tires | Tire rotation | | | | distance | 10000 | | |
| `alignment` | tires | Replacement and alignment | | | | condition | | | 3 |
| `battery` | electrical | Battery | | | | time | | 48 | |
| `wiper_blades` | visibility | Wiper blades | | | | time | | 12 | |
| `dpf` | emissions | DPF | diesel | | yes | condition | | | 3 |

Blank cells are `NULL`. The fuel filter row is shown by default only for diesel; a petrol owner can add it through "+ Add part" (BR-13). Engine oil and oil filter are two rows with the same interval, as the PRD notes.

Default parts are created for a new car by selecting templates where `fuel_type IS NULL OR fuel_type = car.fuel_type`, `timing_drive IS NULL OR timing_drive = car.timing_drive`, and `requires_dpf = 0 OR car.has_dpf = 1` (FR-031, BR-13). Each new part gets `id = car_id || ':' || template_code` (DB-16).
