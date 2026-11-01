# 05 · Technical Requirements Document (TRD)

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.6 (approved 2026-11-01; local-profile connection amendment) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [PVD](../01-discovery/01-product-vision.md), [PRD](../02-product-requirements/02-prd.md), [SRS](03-srs.md), [Database Design](../06-database/07-database-design.md), [README](../README.md) |

**Conventions.** `T-xx` labels a technical decision proposed in this document. On approval each one is promoted to a README decision (`D-54` onward), exactly as `DB-xx` became `D-33` to `D-53` in document 07. `D`, `A`, `OQ`, `FR`, `NFR`, `BR`, `C`, `R`, `S` and `AC` keep the meaning they have in the README, PRD and SRS. Items marked **[S-01]** are validated in the spike (§18.4).

**Scope.** This document closes A-13 (minimum OS versions), chooses libraries, and defines the mechanics that turn documents 02, 03 and 07 into code: local data layer, domain core, authentication, the sync adapter, notifications, tooling and testing. It does not define component boundaries (document 06), endpoint contracts (08), the threat model (09) or release procedures (12). No application source code is produced in the documentation phase; the snippets below are illustrative contracts.

**Change from v0.1.** The owner selected **Supabase** on 2026-11-01: PostgreSQL, authentication and row-level security in one service, with no per-user database and no provisioning server. That replaces Turso with Clerk (D-03) and removes spike S-01's original gate. The consequences are listed in §18.1 and §18.5, and the spike is retargeted in §18.4.

---

## 1. Inputs and constraints

| Source | Constraint | Technical consequence |
|---|---|---|
| D-01, D-02 | React Native and Expo; SQLite is the working copy | The UI reads and writes only SQLite. It never waits on the network. |
| D-03 (amended) | Supabase: PostgreSQL + Auth + RLS, one project | One shared cloud database; isolation is enforced by RLS, not by per-user databases. |
| D-04 | Email/password and Google sign-in | Supabase Auth provides both; no third-party identity broker. |
| D-18, OQ-02 | Direct APK on Android; sideloaded IPA on iPhone | Development and preview builds, never Expo Go. iOS testing uses IPA files (§14). |
| D-24, C-10 | 30-day reminder window, pending-notification limit, 8 reserved slots | One scheduler owns every notification and is budget-aware (§11). |
| D-28, BR-17, AC-21 | Local reads and writes never depend on a valid token | The database opens before authentication resolves. |
| D-29 | Calendar dates are local `YYYY-MM-DD`; sync timestamps are UTC | Calendar arithmetic never goes through a time-zone-aware date object. |
| D-35, D-40, D-47 | Row envelope, latest-update-wins merge, local reference data | The adapter carries seven synced tables and never touches reference tables. |
| D-39 | Cross-row rules live in the write path, not in triggers | One repository layer is the only local writer; one SQL function is the only cloud writer. |
| D-19 | Built for personal use, architected to scale | Versioned schema, templates as data and user-scoped rows from day one. |
| C-06 | A free Apple ID signature expires after about 7 days | The IPA is re-signed weekly; the pipeline is proven in S-01 item 6. |
| C-08, R-06 | Free tiers limit usage | Free-tier limits are recorded in §17 and re-checked before public release. |
| C-09 | One developer | No component that needs separate operational care in R1 (§18.1). |
| A-13, NFR-040 | Minimum OS versions decided here | Android 8.0 (API 26) and iOS 16 (§3). |

---

## 2. Technology stack

| Layer | Choice | Reason | Rejected |
|---|---|---|---|
| Language | TypeScript, `strict` | Shared types between domain, data and sync | Plain JavaScript |
| App framework | React Native with Expo, pinned stable SDK | D-01; native modules through config plugins | Bare React Native |
| Build mode | Development builds, continuous native generation (prebuild) | Notifications, secure storage and OAuth need native code | Expo Go |
| Navigation | Expo Router | File-based routes, deep links from a notification | React Navigation by hand |
| Local database | `expo-sqlite` | Official Expo module, WAL and PRAGMAs, change listener | WatermelonDB, op-sqlite |
| Data access | Repositories with hand-written SQL and Zod at the boundary | Document 07 relies on `CHECK`s, partial indexes and a custom merge that ORMs fight | Drizzle, Kysely, TypeORM |
| Backend | Supabase (PostgreSQL, Auth, RLS) | D-03 amended; one service, one project, server-side isolation | Turso + Clerk, Firebase |
| Cloud access | `@supabase/supabase-js` over HTTPS; two SQL functions for sync | No hand-written REST surface; the merge lives in the database | PostgREST upserts, packaged sync engines |
| Authentication | Supabase Auth; email/password and Google through the system browser | D-04; no native Google SDK, so no Play Services dependency | Own auth, Clerk |
| UI state | React state plus the SQLite change listener | The screen state is small; data is queried, not cached | Redux, Zustand, TanStack Query |
| Forms | React Hook Form with Zod | Reuses the same validators as the write path | Hand-rolled forms |
| Dates | Own `LocalDate` module (§7) | Removes time-zone and DST defects from calendar arithmetic | moment, `Date` arithmetic |
| IDs | `expo-crypto` `randomUUID()` | UUID v4 (D-40) | `uuid` package |
| Connectivity | `@react-native-community/netinfo` | Sync on network regain | Polling |
| Notifications | `expo-notifications`, local only | D-11, D-24 | Push notifications |
| i18n | `i18next` + `react-i18next` + `expo-localization` | English catalog from R1; plurals and RTL in R2 (D-16) | Hard-coded strings |
| Tests | Jest (`jest-expo`), Supabase CLI local stack, Node SQLite, Maestro | §14 | Detox |
| CI | GitHub Actions | Free tier is enough for one developer; macOS runner for the IPA | Self-hosted CI |

Expo SDK upgrades are deliberate: one bump per release, with a build, a smoke test on both phones and a reviewed changelog. The exact SDK version is frozen in `package.json` and written back into this table at approval; "latest stable" is not a specification.

---

## 3. Platform targets (closes A-13)

| Platform | Minimum | Reason |
|---|---|---|
| Android | 8.0 (API 26) | Notification channels exist from 8.0, and the reminder/alert split depends on them (§11). Newer runtime permissions (notifications from 13) are handled in context. |
| iOS | 16 | The sideloaded device is current, and a higher floor lowers the test matrix. |

The effective floor is the higher of this table and the pinned Expo SDK minimum, re-checked when the SDK is pinned (T-11).

- Phones in portrait only (NFR-041): orientation is locked in the app config.
- The only permission requested is notification permission, and only when the owner enables reminders or alerts (§11). No location, camera, contacts, storage or activity access.
- Tablet layouts and landscape are out of scope in R1.

---

## 4. Code organization

```
app/                  Expo Router screens (thin; no business rules)
src/domain/           Pure TypeScript: status engine, LocalDate, validators, money
src/data/             SQLite connection, migrations, repositories, row types
src/sync/             Cloud adapter, push/pull, clock, conflict reporting
src/notifications/    Scheduler, channels, permission handling
src/auth/             Supabase session, signed-in marker, deep-link callback
src/i18n/             Catalogs (en in R1)
src/ui/               Components, theme, accessibility helpers
```

Dependency rule: `domain` imports nothing from React, Expo or SQLite. `data` imports `domain` types. `sync`, `notifications` and `auth` import `data` and `domain`. Screens call hooks that call repositories. Violations fail an ESLint import-boundary rule.

This section fixes layering and dependency direction only; runtime components and their boundaries belong to document 06.

---

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

---

## 8. Authentication

| Topic | Decision |
|---|---|
| Provider | Supabase Auth. Email/password with email confirmation, password reset (FR-005). |
| Google | `signInWithOAuth` in the system browser with `expo-web-browser`, returning through the app's URL scheme. No native Google SDK, so no Play Services dependency and no `google-services.json`. |
| Session storage | Supabase JS persistence adapter backed by `expo-secure-store` (Keychain/Keystore). Nothing credential-related in SQLite (NFR-024). |
| Offline start | SQLite opens immediately. An unlinked or signed-out profile shows Not connected; a linked profile can show Offline while its session loads. |
| Account connection | Requires a network only when chosen. It first pulls the account; a confirmed empty account claim creates the local `users` and `user_settings` rows and queues the complete profile for push. |
| Sign-out | Does not delete local data. Signing in as a different user wipes the local database before that user's pull, so two users' rows never coexist. |
| Token refresh | `autoRefreshToken` with `AppState`-driven start/stop. A failed refresh sets Offline; it never blocks a local read or write (D-28). |
| Portability | Auth is behind an `AuthProvider` interface: `getUser`, `getAccessToken`, `signIn`, `signOut`, `onChange`. Sync depends on that interface, not on Supabase types (NFR-083). |
| Email limits | The free tier rate-limits auth emails. Confirmation and reset flows are tested in S-01; if the limit is a problem, magic-link sign-up is the fallback (§17, R-15). |

---

## 9. Cloud schema and isolation

### 9.1 Model

One Supabase project, one PostgreSQL database, shared by all users, isolated by row-level security (D-36, NFR-021). There are no per-user databases, no platform API credential in the app and no provisioning server (T-05).

- Every synced table carries `user_id text not null references public.users(id)` and a policy `user_id = auth.uid()::text` for `select`, plus a `sync_seq` column; no `delete` policy, because deletion is soft (D-02).
- `public.users` mirrors the authenticated identity and is written through the same push path as everything else; `users.id` equals `auth.uid()`.
- Reference rows (`part_templates`, system categories with `user_id IS NULL`) are readable by any authenticated user and writable by none. Seeds run as an operator migration, not from the app.
- The logical schema is document 07's, and its PostgreSQL form is published there (§5.2) along with the adapter-local tables (§4.10).

### 9.2 Sync cursor

Each synced row carries `sync_seq bigint not null`, assigned from one global sequence by the push function. The pull cursor is `max(sync_seq)` of the last applied pull, never `updated_at`: a device that was offline for a week pushes rows whose `updated_at` is older than what other devices already pulled past, and an `updated_at` cursor would never see them (T-06).

The sequence is assigned on the write path, so rerunning a pull is idempotent and no log table is needed: a row that changes twice simply carries the later sequence. Compare with the alternative, a `sync_log` table, which grows unbounded, needs its own retention rule and its own policy (§10.2, rejected).

### 9.3 Write surface

`authenticated` holds `select` on the synced tables and `execute` on two functions. It holds **no** insert, update or delete grant, and there is no policy that would let a client write a row directly. Every cloud write therefore goes through `push_rows`, which enforces the envelope, the merge predicate and `sync_seq` in one place (D-39, applied to the server).

### 9.4 Cloud migrations and version handshake

- Cloud migrations live in `supabase/migrations`, are applied from the developer machine with the Supabase CLI, and are never run by the app.
- Before each sync the adapter compares `local_meta.cloud_schema_version` with the version returned by the pull function.

| Case | Behaviour |
|---|---|
| Same | Sync proceeds. |
| Cloud newer | Sync is refused with "update the app"; local reads and writes continue. |
| App newer | Sync is refused; this only happens if a migration ships before its app release and is treated as a release error. |

Cloud migrations must remain backward compatible with the previous app release for one version, because a sideloaded client can lag by up to the re-signing cycle.

---

## 10. Synchronization mechanics

### 10.1 Push

`push_rows(p_rows jsonb) returns jsonb` — one call, one transaction.

1. Read `sync_dirty`, load the current local version of each listed row, parent tables first (`users`, `user_settings`, `cars`, `categories`, `parts`, `odometer_entries`, `service_records`).
2. Call `push_rows` once with the whole batch. The function validates `user_id = auth.uid()::text`, upserts with the merge predicate, stamps `sync_seq`, and returns, per row, `applied` or `rejected`.
3. The conditional upsert keeps the merge rule in the database (D-35):

```sql
INSERT INTO parts (id, user_id, /* ... */ updated_at, origin_device_id)
VALUES (?, ?, /* ... */ ?, ?)
ON CONFLICT (id) DO UPDATE SET /* all columns = excluded.* */
WHERE excluded.updated_at > parts.updated_at
   OR (excluded.updated_at = parts.updated_at
       AND excluded.origin_device_id > parts.origin_device_id);
```

4. On success, delete the pushed entries from `sync_dirty` only where the row's current `updated_at` still equals its `loaded_updated_at`. Rows modified during the push stay dirty and go out next round.
5. A rejected row is retried by the pull that follows, which brings the winning version back (§10.2).

The function is a single transaction, so a push either fully lands or not at all; replaying the same batch is a no-op (NFR-012). Table names are whitelisted and statements are built with `format('%I')`, never with client-supplied SQL.

### 10.2 Pull

`pull_rows(p_cursor bigint) returns jsonb` — one call, one row of JSON.

1. From `local_meta.pull_cursor` (0 on a new device).
2. The function returns every row with `user_id = auth.uid()::text and sync_seq > cursor`, across the seven tables, plus `max_seq`, `cloud_schema_version` and `server_now` (the clock reference for §10.4).
3. The client applies them in one exclusive local transaction, parent-first, with deferred foreign keys, using the same merge predicate as the cloud.
4. It stores `max_seq` as the new cursor in the same transaction, then notifies the change listener and rebuilds notifications.

**No paging.** The whole user dataset is about 1,200 rows and well under 5 MB (document 07 §12), and the function returns a single JSON value, so the request-size limit does not bite. Paging by `sync_seq` was rejected because a parent updated after its child can move past a page boundary and leave the child without its parent; the unpacking pass, the boundary rule and the failure path would all be new code for a dataset that fits in one response.

### 10.3 Conflicts and their visibility

D-35 means a losing local edit is discarded, silently, by design. Two rules keep that honest:

- A pull that overwrites a row listed in `sync_dirty` clears the dirty entry (the edit can no longer win) and appends `{table, id, label}` to `local_meta.conflicts_pending`. The list is stored whole — never a counter and never capped — because the notice has to name the affected parts, and the dataset bounds it at a few dozen rows at most (D-86). A queued row that wins the comparison is not overwritten at all and stays dirty for the next push (D-88).
- The next time the home screen is shown, a dismissible notice reports how many local changes were replaced by another device and names the affected parts. Showing it clears the list.

The rebuild date lives beside it in `local_meta.notifications_built_for`, so the midnight rollover check is a string comparison rather than a query.

A full manual merge UI is out of scope (T-17).

### 10.4 Clock

Latest-update-wins trusts device clocks, so a phone with a wrong date could win every conflict (T-08):

- All `updated_at` values come from one `Clock` module: `now() = deviceNow + clock_offset_ms`.
- Each sync reads the server time from the pull response and recomputes the offset. If the skew exceeds two minutes the offset is applied from then on.
- Before the first successful sync the offset is unknown. On push, a row whose `updated_at` is more than 24 hours ahead of the server time is restamped before sending, and the local row is updated with the same value so the two never disagree.

`Clock` is used for sync timestamps only. `LocalDate.today()` reads the device clock directly (§7).

Rejected alternative: let the server stamp `updated_at`. It removes the clock module but turns D-35 into "last to sync wins", which loses a correctly timed offline edit in favour of a later sync from a device that was opened with stale data. The clock module is smaller than that defect.

### 10.5 Triggers, debounce and visible state

- Sync runs on app open and foreground, on network regain, on pull-to-refresh, and after local writes with a **1 s debounce** — the debounce value exists so NFR-003 (5 s to the cloud) is reachable.
- It never blocks the UI.
- The visible state is one of four (NFR-105):

| State | Meaning |
|---|---|
| Synced | `sync_dirty` is empty and the last pull succeeded |
| Pending | Rows are queued or a push is in flight |
| Offline | No network or no valid session; work continues locally |
| Error | The last attempt failed for another reason; retried automatically |

### 10.6 Failure handling

Network, session or server errors leave `sync_dirty` untouched and set the visible state. Retries use exponential backoff with a cap and restart on app open and on network regain. A pull is one transaction, so a partial apply cannot occur; the cursor only advances with a committed apply.

If a pulled row violates a local `CHECK`, the transaction rolls back, the cursor does not move and the state becomes Error. This should be impossible (the handshake in §9.4 covers schema drift); the app logs the offending table and row id without personal data and stops retrying until the next app open, rather than looping.

---

## 11. Notifications

| Topic | Decision |
|---|---|
| Library | `expo-notifications`, local scheduling only. No remote push in any release (D-11, C-05). |
| Channels (Android) | `reminders` for the daily mileage reminder and inspection prompts, `alerts` for part alerts, so one can be muted without the other. |
| Permission | Requested in context when the owner turns reminders or alerts on, not at first launch. Denial follows AC-20: explain how to enable, schedule nothing, keep everything else working. |
| Exact timing | No exact-alarm permission is requested. Delivery may be a few minutes late; the Settings copy says so. This is an accepted deviation from "at the chosen time" (FR-080), recorded in §17. |
| Scheduler | One idempotent `rebuildSchedule()` cancels all pending notifications and recreates them from current data. |
| Budget | Design to the iOS ceiling of 64 pending notifications on both platforms, for parity. `reminder_days = clamp(64 − 8 − alerts, 7, 30)`, where `alerts = 2 × time-interval parts with alerts on`. The 8 reserved slots are the reminder days at the floor plus the paused notice. Alerts take their nearest dates first; surplus alerts are dropped and re-added on later rebuilds. |
| Window end | The last scheduled notification says reminders are paused and asks the owner to open the app (AC-22, D-24). |
| Today's reminder | Omitted when a live odometer entry is dated today (D-50). A mileage update triggers a rebuild, which removes it. |
| Content | Computed per date. Time-based status is projected to that date; distance-based status uses the odometer known at build time and cannot be projected, so a distance-overdue part is named only from the data the last build knew (FR-082). |
| Dates and DST | Trigger instants are built from local year, month, day and the chosen time, then converted once. A DST shift or time-zone change is repaired by the next rebuild, which a change of local date or zone triggers (§5.6). |
| Rebuild timing | After first paint, never during startup (§5.7). |
| Taps | A notification opens the mileage entry (FR-084) or a part detail through a deep link. |

Validated on real devices in S-01 item 7: delivery, skip-after-update, the paused notice, the 64-slot budget with the real number of alerts, and behaviour after a device reboot, a force-stop and an app re-install. Reboot behaviour in particular decides whether an extra rebuild trigger is needed.

---

## 12. Security and privacy implementation notes

Document 09 owns the requirements; this section records the implementation choices that affect them.

| Topic | Decision |
|---|---|
| Transport | HTTPS only. Cleartext traffic is disabled on Android; iOS uses App Transport Security defaults. |
| Secrets | The app ships only the public project URL and the **anon** key, both of which are public by design. The **service-role key never leaves the developer machine.** Security rests on RLS, not on hiding a key (T-05). |
| Isolation | `user_id = auth.uid()::text` policies on every synced table, and two-account integration tests in CI (§14). |
| Write surface | Clients have no direct write grant; only the sync functions are executable (§9.3). This keeps the merge, the envelope and `sync_seq` unbypassable. |
| Tokens | Access and refresh tokens in the platform secure store (NFR-022). |
| Data at rest | The local database relies on the operating-system sandbox; no SQLCipher in R1 (NFR-025, T-14). The data is low sensitivity: mileage, parts, costs, email. |
| Backups | Android automatic backup is disabled and the SQLite file is excluded from the iOS backup, because the cloud is the backup and a restored stale database must not meet a newer cloud. |
| Logging | No email, user id, token or free-text notes in logs. |
| Analytics | None in R1. Crash reporting is deferred to document 12; the cost is no field visibility on the owner's own phones, accepted for now. |
| Dependencies | Pinned by lockfile; updates reviewed manually. |

---

## 13. SQLite (device) and PostgreSQL (cloud) notes

The cloud is now PostgreSQL, so document 07's DDL needs its PostgreSQL form. Both sides keep the same logical schema and the same formats, so the merge predicate and the row shape are identical.

| SQLite | PostgreSQL |
|---|---|
| `TEXT` keys and timestamps | `text`, same formats, so no time-zone or serialization surprise |
| `TEXT` calendar dates | Native `date`. PostgreSQL rejects impossible days without a check, and JSON still serializes `YYYY-MM-DD`, so the wire format is unchanged (D-29). |
| `INTEGER` booleans with `CHECK (col IN (0,1))` | `smallint` with the same check (one representation, not "or boolean") |
| `GLOB '[0-9][0-9][0-9][0-9]-…'` | Regular expression: `col ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`; still needed for text that is not a date, such as `reminder_time` and `currency_code`. |
| `date(col) = col` | Not needed: the column is a `date`. Document 07 §5 originally wrote `col::date = col`, which compares a date with text. |
| `PRAGMA defer_foreign_keys` | Foreign keys declared `DEFERRABLE INITIALLY DEFERRED` |
| Partial indexes | Same syntax |
| `PRAGMA` block | No equivalent needed; server settings are not schema |
| Per-user databases | One shared database; RLS replaces database scoping |
| — | `sync_seq bigint not null` on the seven synced tables, indexed `(user_id, sync_seq)`; one global sequence |
| — | `revoke insert, update, delete` from `authenticated`; `grant execute` on `push_rows`, `pull_rows` |

PostgreSQL needs no `sync_log` table (§9.2). System reference rows have `user_id IS NULL`, are seeded by an operator migration and are readable by every authenticated user.

---

## 14. Tooling, testing and delivery

| Topic | Decision |
|---|---|
| Code quality | TypeScript `strict`, ESLint with import boundaries, Prettier, a pre-commit hook running lint and type check. |
| Unit tests | Jest on `domain`: every pure-logic acceptance criterion (AC-01 to AC-08, AC-10, AC-12, AC-18, AC-23, AC-24), plus month-end, leap-year and day-boundary cases. The clock is injected. |
| SQL tests | The same migration modules run against a Node SQLite database (`better-sqlite3`): every `CHECK`, the active-record query, the home query, the odometer guards including D-50, seed idempotency, and an upgrade fixture that applies v1…vN in order. |
| Cloud tests | The Supabase CLI local stack in CI: `push_rows`/`pull_rows` round trips, replay, out-of-order timestamps, a row changed during a pull, and **two accounts proving RLS**: user A cannot select, insert or update user B's rows, and cannot bypass the functions with a direct write. |
| Sync tests | Two device databases and one local cloud: concurrent edits, a device offline with older timestamps, a rejected push followed by a pull that restores the winner, and a conflict notice. |
| End-to-end | Maestro flows on an Android device or emulator: first launch (J-01), mileage update (J-02), replace a part (J-03), airplane-mode write (AC-13). Maestro has no iOS route from Windows; iOS flows are manual (§17). |
| Real-device checks | Notifications (AC-09, AC-16, AC-20, AC-22), sign-in, and accessibility (NFR-060: font scaling, screen reader, contrast) are verified manually on both phones. |
| CI | GitHub Actions: lint, type check, unit, SQL and cloud tests on every push. |
| Android build | Local Gradle, or EAS Build if local fails. Direct APK install (D-18). |
| iOS delivery | R1 tests with **IPA files** (owner decision): an unsigned build on a macOS CI runner, downloaded and signed on Windows with Sideloadly or AltServer using the free Apple ID, then installed. Re-signed every 7 days (C-06). EAS-managed iOS credentials require a paid account and are out of scope for R1. |
| Versioning | `version` for the user, `android.versionCode` and `ios.buildNumber` incremented per build, tags per build. No OTA updates in R1 (T-15): every change ships as a new build. |
| Performance gate | 100-part fixture: home query plus status computation within 500 ms after an update (NFR-002), and cold start within 2 s (NFR-001) on the oldest supported phone. |

---

## 15. Environments and configuration

| Environment | Backend | Purpose |
|---|---|---|
| `dev` | A second Supabase project (or the local CLI stack) | Development, S-01 and destructive tests |
| `prod` | The production project | The owner's real data |

Configuration reaches the app only as public build-time variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The service-role key exists only in the developer's shell and CI secrets and is never bundled (NFR-023).

The bundle identifier and the URL scheme are single constants in `app.config.ts` (T-19). Nothing else in the code refers to them by literal.

The product name is still open (OQ-05), so the identifier stays a **neutral placeholder**, not one derived from the working title. Changing it is not free but is not a rewrite:

- A new identifier is a **new app** on the phone: fresh local database, fresh keychain entry, and the old install must be removed by hand.
- Cloud data is unaffected. Signing in on the new identifier pulls everything back from cursor 0 (FR-104, AC-19).
- The identifier must therefore be frozen before the first build that holds data the owner would miss. The development build appends `.dev` to it so both can coexist.

The URL scheme used by the Google redirect and by notification deep links (`carmaint://`) is separate from the identifier, is not a store identity, and **is frozen now**, because it has to be allowlisted in Supabase and baked into the scheduled notifications.

---

## 16. Requirement mapping

| Requirement | Where addressed |
|---|---|
| NFR-001 (2 s cold start) | §5.7 startup budget |
| NFR-002 (500 ms after an update) | §5.6 one query plus in-memory status, §14 gate |
| NFR-003 (5 s to the cloud) | §10.5 1 s debounce, push batch |
| NFR-010, NFR-011 (offline, transactional) | §5.2, §5.4, §8 offline start |
| NFR-012 (idempotent retry) | §10.1 replay, §10.6 backoff |
| NFR-020, NFR-023 (TLS, no secrets) | §12 |
| NFR-021 (server-side isolation) | §9.1 RLS, §9.3 write surface, §14 two-account tests |
| NFR-022 (secure storage) | §8 session storage |
| NFR-024 (no credentials in the database) | §8 |
| NFR-025 (OS protection, no extra encryption) | §12 data at rest |
| NFR-030 (minimum data) | §9.1 schema, §12 logging |
| NFR-040 (minimum OS) | §3, T-11 |
| NFR-041 (phones, portrait) | §3 |
| NFR-042 (dev build, not Expo Go) | §2 build mode |
| NFR-050 (3 taps to mileage) | §11 deep link, UI doc 04 |
| NFR-060 (accessibility) | §14 manual checks, UI doc 04 |
| NFR-070, NFR-071 (translation, RTL) | T-12, §2 i18n |
| NFR-072 (locale formatting) | §7 `format`, §13 |
| NFR-080 (versioned schema) | §5.3, §9.4 |
| NFR-081 (templates as data) | §5.3 seeds |
| NFR-082 (UUID keys, timestamps) | §6, §10.4 |
| NFR-083 (swappable sync and auth) | §8 `AuthProvider`, §10 adapter |
| D-28, BR-17, AC-21 | §8 offline start |
| D-24, C-10, AC-22 | §11 budget and window |
| D-35, BR-19, AC-14 | §10.1 and §10.2 |
| D-29, D-30 | §7 `LocalDate` |
| D-50 | §5.6 "updated today", §7 validators, §11 |
| FR-093 | §5.6 newly-due notice |
| A-13 | §3 |

---

## 17. Risks introduced

| ID | Risk | Mitigation |
|---|---|---|
| R-09 | A free Supabase project pauses after about a week of inactivity, and the free tier caps storage and egress. | Sync on every open keeps the project active; the paused state is detected and shown as an error; paid tier only if it becomes a nuisance. |
| R-10 | A wrong RLS policy or a stray `grant` exposes rows across accounts. | Two-account integration tests in CI, no direct write grant, service-role key never on device (§9, §14). |
| R-11 | The 7-day free-signing expiry interrupts iPhone testing, and notifications stop until the app is re-signed. | Weekly re-sign routine, re-signing proven in S-01 item 6, reminders rebuilt on next open. |
| R-12 | Pending-notification limits, delivery jitter, reboot or force-stop behaviour differ per device. | Budget formula (§11), real-device checks (S-01 item 7). |
| R-13 | `Intl` coverage in Hermes differs per platform, which would break number, date and later Arabic formatting. | Verified in S-01; fallback to an `Intl` polyfill or explicit formatters. |
| R-14 | A discarded local edit is only reported after the fact (§10.3). | The conflict notice; manual merge UI is out of scope. |
| R-15 | Free-tier auth email rate limits block sign-up or reset. | Tested in S-01; magic link or a custom SMTP as fallback. |

`R-01` (Turso and Clerk were beta) is closed by this change; `R-02` becomes R-10 (RLS instead of token scoping).

---

## 18. Decisions and open questions

### 18.1 Amendments to confirmed decisions

These are owner decisions already taken, or consequences of them, and need a README edit rather than a new `D` number. They were applied in README v0.9 on approval.

| ID | Change | Reason |
|---|---|---|
| D-03 | **Replaced.** Backend is Supabase (PostgreSQL + Auth + RLS), one shared project. Turso and Clerk are dropped; the conditional spike gate is removed. | Owner decision 2026-11-01: one service containing everything. |
| D-04 | Unchanged. Email/password and Google remain the login methods, now through Supabase Auth. | Still satisfied. |
| D-40 | **Exception dropped.** `users.id` is the Supabase auth UUID, not a provider subject. | The provider returns UUIDs, so the workaround is unnecessary. |
| R-01 | Closed. No Turso embedded replica is used. | — |
| R-02 | Replaced by R-10: misconfigured RLS rather than unscoped tokens. | — |
| A-13 | Closed by T-11 (minimum OS versions). | — |
| OQ-01 | Closed: Supabase. | — |
| S-01 | Retargeted (§18.4). Items 1 to 5 are replaced; items 6 and 7 keep their purpose. | — |

### 18.2 Confirmed decisions

Approved by the owner on 2026-11-01; the README register carries them as D-54 to D-72.

| T | Decision | Becomes |
|---|---|---|
| T-01 | Expo with development builds and continuous native generation, TypeScript `strict`, Expo Router. No Expo Go. | D-54 |
| T-02 | `expo-sqlite` is the only local engine: hand-written SQL migrations bundled as modules, repositories with Zod, no ORM and no packaged sync engine. | D-55 |
| T-03 | The domain layer is pure TypeScript; calendar dates use our own `LocalDate` with integer day arithmetic; `today()` reads the device clock, never the sync clock. | D-56 |
| T-04 | Every local write goes through a repository that validates, stamps the envelope and queues the row in `sync_dirty`, in one exclusive transaction. | D-57 |
| T-05 | Backend is Supabase: one shared database, RLS on every synced table, no per-user database, no provisioning server, no platform credential in the app. | D-58 |
| T-06 | The pull cursor is a server-assigned `sync_seq` on each row, never `updated_at`; no `sync_log` table. | D-59 |
| T-07 | Both directions are one SQL function each (`push_rows`, `pull_rows`); push is one transaction of conditional upserts; the client has no direct write grant. | D-60 |
| T-08 | One `Clock` module applies a measured server offset; implausible future timestamps are restamped on push; the clock is never used for local dates. | D-61 |
| T-09 | Supabase Auth with email/password and Google through the system browser; session in secure storage; local start from a last-user marker; a different user wipes local data. | D-62 |
| T-10 | `expo-notifications`, local only, two Android channels, no exact-alarm permission, one idempotent rebuild, and the 64-slot budget formula of §11. | D-63 |
| T-11 | Minimum Android 8.0 (API 26) and iOS 16, raised to the pinned SDK floor when higher; phones in portrait. Closes A-13. | D-64 |
| T-12 | All user-visible strings go through an `i18next` catalog from R1; right-to-left layout arrives with Arabic in R2. | D-65 |
| T-13 | Tests: Jest for the domain, Supabase CLI stack for RLS and sync functions, Node SQLite for migrations and queries, Maestro on Android, manual iOS and accessibility checks, GitHub Actions for CI. | D-66 |
| T-14 | R1 has no database encryption, no analytics and no crash reporting; Android backup and the iOS backup copy are both disabled. | D-67 |
| T-15 | No OTA updates in R1. Every change ships as a new build. | D-68 |
| T-16 | iOS testing uses IPA files: unsigned macOS CI build, signed on Windows with the free Apple ID, re-signed weekly. EAS iOS credentials are out of scope for R1. | D-69 |
| T-17 | A pull that discards a queued local edit records it in the conflict list and shows a notice naming the affected parts; there is no manual merge UI. | D-70, D-86 |
| T-18 | There is no server-side provisioning component. Account deletion (R2) is an operator step with the service-role key, not an app feature. | D-71 |
| T-19 | The bundle identifier and URL scheme are single constants in the app config. The scheme is frozen now; the identifier stays a neutral placeholder until OQ-09 closes, and changing it costs a reinstall plus a full pull. | D-72 |

### 18.3 Open questions

| ID | Question | Decide in |
|---|---|---|
| OQ-09 | Application and bundle identifier. The product name is not chosen yet (OQ-05), so the identifier remains a neutral placeholder that is independent of the working title. Freeze it before the first build that stores real data; afterwards a change means a reinstall, a new local database and a full pull from the cloud. The URL scheme is frozen independently (T-19). | Owner, before the first production build |
| OQ-14 | Closed 2026-11-01: an outdated client refuses to sync, with no grace period (D-81). Local work continues and retries stop until the next cold start. | Closed |
| OQ-15 | Do we keep the 64-notification design ceiling on Android, or use the higher Android limit and accept different behaviour per platform? | Testing (11), after S-01 item 7 |
| OQ-16 | Email confirmation on sign-up: required in production, disabled in development? | Owner, before S-01 |
| OQ-17 | Crash reporting: none in R1 (T-14), or a development-only Sentry project? | Deployment (12) |

### 18.4 Spike S-01, retargeted

Goal: prove that Supabase plus the Expo build pipeline carries the app before the main build starts. One day; two if item 6 is slow.

1. Supabase Auth: email/password sign-up with confirmation, reset, and Google through the system browser, in a development build on Android and iPhone.
2. RLS isolation with two accounts: A cannot read, write or infer B's rows; a direct write from the client is refused.
3. Offline write on the device, sync, then read on a second device through `push_rows`/`pull_rows`.
4. The same record edited on two devices: latest `updated_at` wins; the loser is reported by the conflict notice.
5. Expired session, no network, app restart: local data is shown and editable, state Offline (AC-21).
6. An IPA is produced on a macOS runner, signed on Windows with the free Apple ID, installed, and re-signed after 7 days without losing data.
7. The reminder window on real devices: delivery, skip-today after an update, the paused notice, the 64-slot budget with the real alert count, and behaviour after reboot, force-stop and reinstall.
8. `push_rows`/`pull_rows` latency and a full pull of the whole dataset on the free tier; free-project pause behaviour.

Pass: items 1 to 5 work reliably. Items 6 to 8 decide the iOS routine, the notification mechanics and the size of the free tier.

### 18.5 Follow-ups for other documents

| Document | Point |
|---|---|
| 07 Database | **Done in v0.4**: PostgreSQL cloud schema published in §5.2 (`sync_seq`, RLS, read-only clients, `date` columns, deferred keys); DB-22 to DB-25 proposed there; adapter-local tables added as §4.10. |
| 07 Database | **Done in v0.4**: `include_in_reminders` now defaults to 1 for every part. A-06 and FR-090 were revised to match (SRS v0.5). |
| 07 Database | **Done in v0.5**: orphaned children are structurally impossible (soft deletes plus a parent-first transactional push), so no repair rule is written; DB-26 added `UNIQUE (id, user_id)` on `cars` and `parts` and composite `(parent_id, user_id)` foreign keys on the child tables. An orphan or cross-owner reference now fails the batch and holds the cursor. |
| 08 API | Name the two RPC functions, their payloads and error codes; they are the whole cloud API. |
| 09 Security | Threat model for RLS, the service-role key, and the local database. |
| 11 Testing | Inherit the split in §14: cloud tests in CI, notifications and accessibility by hand, Maestro on Android only. |
| 12 Deployment | The IPA re-signing routine, the weekly calendar reminder, and the operator steps to apply cloud migrations and delete an account. |

---

## 18.6 Local-profile amendment

The device creates a singleton local profile before authentication. Its state is `unlinked`, `connecting`, `linked`, or `signed_out`; it stores the associated account ID only when one exists. Sync is disabled unless the state is `linked`.

The SQLite working copy permits `user_id` to be absent before connection and uses ordinary parent foreign keys because only one local profile exists. Supabase keeps non-null `user_id`, composite ownership keys, and RLS. On confirmed connection to an empty account, one exclusive device transaction assigns the authenticated ID to all owned rows, creates the user/settings rows, resets the cursor, and queues one complete parent-first upload. For an account with data, the app validates and stages a full pull before one transaction replaces the local profile. Cancellation signs out without changing either dataset.

The export service reads one consistent SQLite snapshot and emits only live maintenance data plus export metadata. It never calls Supabase and excludes identity, device and sync data.

## 19. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First draft: stack, platform minimums (A-13), data layer, domain core, authentication, sync mechanics, notifications, security notes, PostgreSQL mapping, tooling and testing, T-01 to T-15. |
| 0.2 | 2026-11-01 | Owner chose Supabase: D-03 replaced, Turso and Clerk dropped, no per-user database and no provisioning function; `sync_seq` replaces `sync_log`; RLS and a two-function write surface replace scoped tokens. iOS is IPA-only for R1 (T-16). Fixes: non-paged pull, exclusive transactions, conflict notice, D-50 guard, FR-093, startup budget, debounce value, notification budget formula, corrected NFR-001 mapping, complete NFR traceability, atomic T-decisions, risks R-09 to R-15, retargeted S-01, document 07 follow-ups. |
| 0.3 | 2026-11-01 | Bundle identifier stays open (OQ-09): the product name is undecided, so the identifier is a neutral placeholder and the freeze point moves to the first build that stores real data. Added T-19 (identifier and scheme are single constants; the URL scheme is frozen now). §15 states what a later change costs. |
| 0.4 | 2026-11-01 | Cloud schema landed in document 07 v0.4: §13 now maps calendar dates to native `date` columns and drops the `to_char` workaround; §18.5 marks the PostgreSQL DDL and the reminder-default follow-ups done. `include_in_reminders` now defaults to 1, with A-06 and FR-090 revised. Approved 2026-11-01; T-01 to T-19 promoted to D-54 to D-72. |
| 0.5 | 2026-11-01 | Amendment after the architecture review (doc 06 v0.3). §5.5 and §10.3 store the conflict list whole as `conflicts_pending` and add `notifications_built_for`; T-17 wording follows, still D-70. §5.6 uses one change counter instead of per-table invalidation. §18.5 marks the orphan and composite-key follow-ups done after doc 07 v0.5 (DB-26); OQ-14 closed (D-81). |
| 0.6 | 2026-11-01 | Local-first amendment: authentication is optional; the device maintains one profile state; account connection first pulls, then either atomically claims an empty account or stages and atomically replaces with cloud data. JSON export is a SQLite-only read snapshot. |
