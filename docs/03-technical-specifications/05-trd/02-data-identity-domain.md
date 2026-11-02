# TRD · Local data layer, identifiers, domain core

> Part of [05-trd.md](../05-trd.md). Sections: §5, §6, §7. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 5. Local data layer

### 5.1 Connection and PRAGMAs

One connection is opened at app start, with the change listener enabled, before authentication resolves (D-28). On every open the app runs `PRAGMA foreign_keys = ON`, `journal_mode = WAL` and `busy_timeout = 5000` (document 07 §5). A sync pull additionally sets `PRAGMA defer_foreign_keys = ON` inside its transaction (document 07 §9).

### 5.2 Transactions

Every write, every pull and the notification rebuild use `withExclusiveTransactionAsync`, not `withTransactionAsync`: the non-exclusive variant does not isolate a transaction from other queries on the same connection, and a rebuild landing inside a pull would silently split it.

### 5.3 Migrations

- Forward-only modules `NNNN_description` exporting SQL strings, so Metro bundles them and the Node tests read the same source.
- The runner applies pending files in order inside one transaction and records `schema_migrations.version`.
- Seed migrations are idempotent upserts: `ON CONFLICT(id) DO UPDATE` for system categories (their `id` is the code) and `ON CONFLICT(code) DO UPDATE` for part templates (document 07 §10).
- SQLite cannot alter a `CHECK` in place; a constraint change is a table rebuild (create, copy, drop, rename) with foreign keys deferred, inside the same migration.

### 5.4 Repositories and the write path

Every local write goes through a repository function that, in one exclusive transaction:

1. validates input with the shared Zod schema and the cross-row rules of document 07 (§4.7 guard, BR-01, BR-07, D-50, DB-19);
2. stamps the envelope: `updated_at` from the `Clock` (§10.4), `origin_device_id` from local metadata, `created_at` on insert;
3. performs the write, including explicit soft-deletion of children;
4. upserts `(table_name, row_id, loaded_updated_at)` into `sync_dirty` (§5.5).

No other code writes the synced tables. Rows applied by a pull bypass step 4 on purpose.

`loaded_updated_at` is the value the row had when it was queued. It is what push and pull compare against to know whether the row changed again while in flight.

### 5.5 Adapter-local tables

Two device-only tables, never synced and outside document 07's schema; document 07 §9 assigns sync bookkeeping to the adapter:

| Table | Columns | Purpose |
|---|---|---|
| `local_meta` | `key` PK, `value` | `device_id`, `clock_offset_ms`, `last_user_id`, `pull_cursor`, `cloud_schema_version`, `conflicts_pending`, `notifications_built_for` |
| `sync_dirty` | `table_name`, `row_id`, `loaded_updated_at`, PK on the first two | Rows changed locally and not yet acknowledged by a push |

Resetting app data wipes both and generates a new `device_id`. These two tables are added to document 07's entity list (§18.5).

### 5.6 Reads, reactivity and status refresh

The home screen runs one query (document 07 §7) and computes statuses in memory (NFR-002). One commit bumps one change counter, and every mounted query re-reads; per-table invalidation would under-invalidate, because an odometer entry changes the status of every part (D-78). Lists are small (100 parts, a few hundred records), so `FlatList` is enough and R1 has no pagination.

Statuses are recomputed and notifications rebuilt on: odometer change, service record change, part or interval change, app open or foreground (`AppState`), local date change across midnight, time-zone change, and after a pull (FR-046, FR-092).

After an odometer update the app keeps the pre-update statuses, compares them with the new ones and shows the in-app notice required by FR-093 (parts that newly became Due soon or Overdue). The notice is dismissible and never blocks the mileage form.

### 5.7 Startup budget (NFR-001)

Cold start to an interactive home screen is measured as: app process start → first frame with the odometer and the Needs attention list populated. Budget 2 s on the oldest supported phone.

- SQLite open, `local_meta` read, one home query and status computation run first; authentication starts in parallel and never gates the screen (D-28).
- The notification rebuild and the first sync are started after the first paint, never before it.
- Pending migrations on the first launch after an update are excluded from the 2 s budget and measured separately (one-time target: 3 s with a progress state).

---

## 6. Identifiers and device identity

- Row keys: `randomUUID()` for rows the app creates; template parts and system rows keep their deterministic ids (document 07 §2).
- `users.id` is the Supabase auth user id, a UUID (`auth.uid()`). This removes D-40's provider-subject exception (§18.1) and survives a later identity-provider change.
- `origin_device_id`: a UUID generated on first launch, kept in `local_meta`. It is a provenance marker and conflict tie-break, never an identity or a secret.

---

## 7. Domain core

Pure functions with no I/O, unit-tested against the PRD acceptance criteria.

| Module | Content |
|---|---|
| `LocalDate` | Value type `{y, m, d}` with a day number since a fixed epoch (proleptic Gregorian, integer arithmetic). `parse`, `format`, `addMonths` with month-end clamp (D-30), `daysBetween`, `compare`, `today(deviceNow)`. |
| `status` | Document 07 §6: active record, remaining values, precedence, Due soon thresholds (D-22, D-53), inspection due (D-52), Needs attention ordering. |
| `validators` | Odometer rules (BR-01, A-03), the D-50 guard on editing or deleting the latest entry, service record rules (BR-07, D-51), interval ranges. |
| `money` | Integer minor units and ISO-4217; display through `Intl`. |
| `format` | Odometer thousands separators and dates through `Intl` (FR-026, NFR-072). |

`LocalDate` performs no calendar arithmetic through `Date`: the only conversion is one read of the device clock at the boundary.

**`today()` uses the device's local date, never the corrected sync clock.** A two-minute clock offset applied near midnight would otherwise shift every status by a day. The offset in §10.4 exists only for `updated_at` timestamps.
