# SAD · Data ownership, errors, security, extension points, test seams

> Part of [06-system-architecture.md](../06-system-architecture.md). Sections: §9, §10, §11, §12, §13. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 9. Data ownership

| Data | Device writer | Cloud writer | Read by |
|---|---|---|---|
| `users`, `user_settings` | Repository | `push_rows` | Repository, scheduler (`user_settings` only) |
| `cars`, `parts`, `odometer_entries`, `service_records` | Repository | `push_rows` | Repository, scheduler |
| Custom `categories` (R2) | Repository | `push_rows` | Repository |
| System categories, `part_templates` | Seed migration only | Seed migration only | Repository |
| `local_meta`, `sync_dirty` | Sync store, repositories | never | Engine, repositories |
| Notification schedule | Notification service | never | OS only |
| Session tokens | Auth service | never | Auth service |

Two consequences:

- Reference data is never in a push batch and never in a pull response, so a merge can never touch it (D-47, DB-15). Doc 07 §5.2 makes the cloud copy read-only for clients.
- The local database is the read authority; the cloud is the merge authority. A row can be locally visible before it is in the cloud, and a row can be in the cloud that this device has not pulled yet. Both are normal, and the badge is what tells the owner which state applies.

### 9.1 Referential integrity across devices

A pull applies parent-first with deferred foreign keys, so one batch cannot fail on ordering. The orphan case that documents 05 and 07 still leave open cannot actually occur: deletions are soft (D-02), so a parent row is never physically removed, and push is one transaction ordered parent-first (D-60), so a rejected parent means a newer cloud winner already exists there. A child always has a parent. If a bug ever produced one without, the deferred foreign key fails the batch, rolls it back and leaves the cursor unchanged — a loud failure, not a repair heuristic.

To make the reference itself safe rather than merely plausible, child tables carry composite keys (AR-16): `unique (id, user_id)` on `cars` and `parts`, `foreign key (car_id, user_id)` on `parts`, `odometer_entries` and `service_records`, and `foreign key (part_id, user_id)` on `service_records`. `parts.category_id` stays a plain key, because system categories have a null `user_id`. Two redundant-looking unique indexes and no new columns now; a row-by-row audit later.

---

## 10. Errors and degradation

### 10.1 Classes and surfaces

| Class | Meaning | Surface | Retry |
|---|---|---|---|
| Field | Input violates a rule (lower odometer, future date) | Inline message on the field, nothing written | User corrects |
| Local system | Storage full, SQLite error, secure-store failure | Inline message with the action that failed; data unchanged | User retries |
| Sync | Network, session, server, merge rejection | Sync badge and a dismissible banner; local work continues | Automatic, with backoff |
| Fatal | Migration failed, database cannot open | Blocking screen; the app does not pretend to work | Cold start after a fix |

One failure has exactly one class and one surface (AR-10). A sync error never becomes a blocking dialog, and a field error never becomes a toast.

Errors also cross layer boundaries as codes, never as sentences (AR-20). Repositories, the engine and the remote adapter return an enum member — `ODOMETER_DECREASE`, `SERVICE_KM_ABOVE_CURRENT`, `CLOUD_SCHEMA_NEWER`, `PUSH_REJECTED_UNRECONCILED`, `STORAGE_FULL` — and the UI maps it to an i18n key. Nothing below `src/features` composes user-visible text, which keeps NFR-070 honest and gives document 08 one place to map server errors into the same set.

The classification of a retry follows the engine error, not the phase (AR-19): a constraint, `CHECK` or foreign-key failure is deterministic and goes to `blocked`; `SQLITE_FULL`, `SQLITE_BUSY` and I/O failures are transient and go to `backoff`, with the cursor unchanged.

### 10.2 Scenario matrix

| Situation | Detected by | Behaviour | Recovery |
|---|---|---|---|
| No network | Reachability listener, request failure | Offline badge; writes and reads continue | One pass on regain |
| Expired session | Auth refresh returns no session | Offline badge; no sync | Refresh on foreground; sign-in if it keeps failing |
| Migration fails | Runner error | Rollback, blocking screen naming the version, database not exposed | Fix and reinstall the build |
| Cloud schema newer | Handshake | Sync refused, banner "update the app", local work continues, no retries | Install the newer build |
| Cloud schema older than the app | Handshake | Refused with a distinct message; logged as a release error | Ship the cloud migration |
| RLS refuses a row (wrong `user_id`) | `push_rows` rejects the row, and the pull does not reconcile it | Row stays dirty, retries stop, `blocked`, banner says the data could not be saved to the cloud | Sign out and in; investigate with doc 09 |
| Free project paused | 5xx or a specific error body | Error badge with "sync unavailable", no loop | Operator resumes the project; next pass succeeds |
| Pull violates a local constraint | Apply error, `CHECK` or foreign key | Rollback, cursor unchanged, `blocked`, table and id logged, no personal data | Cold start; if it repeats, a migration is wrong |
| Pull apply hits `SQLITE_FULL` or `SQLITE_BUSY` | SQLite error code | Rollback, cursor unchanged, `backoff`, local storage message | Space freed or lock released; retry |
| Storage full on a local write | SQLite `SQLITE_FULL` | Inline message, no partial write | User frees space |
| Notification permission denied | OS response | Nothing scheduled, explanation shown, everything else works (AC-20) | Owner enables it in Settings; next rebuild schedules |
| Notification quota reached | Scheduler count | Budget shrinks the reminder window, never below 7 days plus the notice | Next rebuild after a date passes |
| Device clock wrong | Skew over two minutes | Offset applied from then on; future rows restamped on push | Automatic |
| App killed mid-push | Nothing local to detect | Dirty rows remain; replay is a no-op | Next pass |
| App killed mid-apply | SQLite rollback | Cursor unchanged, batch reapplied | Next pass |
| Account switch with unsynced rows | Dirty count at the wipe | Confirmation naming the count before the local wipe; sign-out alone keeps the rows (AR-14) | Owner chooses |

### 10.3 Logging

Logs are for the developer and contain no email, user id, token or free-text note. A failure logs the table name, the row id and the error class. In R1 there is no crash reporting (D-67); the on-device log and the blocking screen are the only diagnostics, which is accepted for a personal build.

### 10.4 Never done automatically

Reset the database, wipe on a schema error, delete a row the cloud rejected, retry a deterministic failure, block the UI on a network call, or silently ignore a caught error.

---

## 11. Security structure

This section states where the mechanisms sit; document 09 owns the threats.

| Capability | Held by | Constraint |
|---|---|---|
| Cloud read | Every signed-in client, through RLS | Policy `user_id = auth.uid()::text` |
| Cloud write | `push_rows` only | Clients have no `insert`/`update`/`delete` grant; the function re-checks the caller's id |
| Cloud schema change | Developer machine | Supabase CLI, service-role key; never bundled (D-67, D-73) |
| Account deletion (R2) | Operator machine | Service-role key, not an app feature (D-71) |
| Session token | Secure store | Never in SQLite, never in a log (NFR-022, NFR-024) |
| Local data | App sandbox | No extra encryption in R1 (NFR-025) |
| Anonymous key | Bundled | Public by design; grants nothing without a JWT and RLS |

The security boundary is the database policy, not the client. That is why the anon key can ship, why the remote adapter is thin, and why RLS is tested with two accounts in CI (D-66, R-10).

---

## 12. Extension points

| Change | Where it lands | What must not change |
|---|---|---|
| Custom categories (R2, A-11) | `categories` rows plus a repository and screen; already in the schema and the push whitelist | Merge, sync engine, RLS shape |
| Export JSON/CSV (R2, FR-120) | A reader over repositories | No writes, no sync involvement |
| Units, languages, RTL (R2, D-16) | `src/i18n`, `src/ui` theme and layout; values stay in km (FR-130) | Domain stores and repositories |
| Multi-car interface (R3, FR-160) | A car selector in the UI; queries already filter by `car_id` | Data model and sync |
| Ads (R3, D-17) | A screen-level slot in `src/ui` | Nothing below the UI |
| Account deletion (R2, FR-140) | Operator script; the app only signs out and wipes | No new endpoint |
| Encryption at rest | A data-layer change inside `db.ts` | Repositories, sync, domain |
| Background sync | Would need a new decision and a background-task module | The engine's single-flight rule stays |

The point of the table is that none of these requires a new layer. If one does, the architecture is wrong, not the feature.

---

## 13. Test seams

| Seam | Interface | Fake | Used for |
|---|---|---|---|
| `Database` | `read`, `write`, transactions | Node SQLite with the real migrations | SQL and repository tests (D-66) |
| `Clock` | `now()` | Fixed and skewed clocks | Timestamp and merge tests |
| `AuthProvider` | `getUser`, `getAccessToken`, `signIn`, `signOut`, `onChange` | Scripted session states | Offline start, expiry, user switch |
| `RemoteStore` | `push(rows)`, `pull(cursor)` | In-memory cloud implementing the merge predicate | Two-device sync, conflicts, rejection |
| `Notifier` | `schedule`, `cancelAll`, `getPermission` | Recording fake | Budget, triggers, deep links |
| `LocalDate` source | `today(deviceNow)` | Injected dates | Rollover, month-end, leap year |

No module mocking and no fake timers beyond the injected clock. The same fakes drive the Jest suites, the Node SQLite suites and the Maestro flows, so a test failure means behaviour changed, not that a stub drifted.

The in-memory remote is not the reference implementation. The same scenario list runs against the real `push_rows` and `pull_rows` on the Supabase CLI stack in CI, so a fake that drifts from the SQL fails a test instead of hiding a merge defect (D-35).

Two things are verified only on real devices (doc 11): notification delivery after reboot, force-stop or reinstall, and whether a pull of the full dataset causes a visible stutter. Both are in S-01.
