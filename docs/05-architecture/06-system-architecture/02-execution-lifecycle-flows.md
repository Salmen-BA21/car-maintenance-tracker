# SAD · Execution model, process lifecycle, runtime flows AF-01..12

> Part of [06-system-architecture.md](../06-system-architecture.md). Sections: §4, §5, §6. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 4. Execution model

### 4.1 Threads and asynchronous work

The app runs on one React Native JavaScript thread. SQLite, secure storage and HTTPS are native calls that run off that thread but resolve on it. There are no workers, no service process and no native module written by this project.

Consequences the code must respect:

- No synchronous database call on the render path.
- No `await` of a network call inside a user-visible transition; the screen shows local state immediately.
- A long task on the JS thread makes the UI stutter, so the only potentially large one — parsing and applying a pull — runs after the first frame and is measured in S-01 item 8.

### 4.2 Serialized resources

| Resource | Serialized by | Why |
|---|---|---|
| SQLite mutation | One write gate in `src/data/db.ts` (AR-01) | SQLite has a single writer; staggering our own writes removes `SQLITE_BUSY` as a design concern and makes "one writer" literal |
| Sync pass | Single-flight coordinator (AR-02) | Two overlapping passes would race the cursor and the dirty queue |
| Notification rebuild | One queue in the notification service (AR-09) | A rebuild cancels everything first; two interleaved rebuilds would leave a partial schedule |
| Migrations | Startup, before the database is exposed | A migration running beside a repository write is undefined behaviour |

Reads take no gate. They may run while a write is queued, which is why every screen reads committed state only and the change emitter invalidates queries after the commit, never before.

### 4.3 The write gate

Every mutation — a repository write, a pull apply, a migration, the local wipe — goes through `database.write(fn)`, which:

1. queues `fn` behind the previous mutation;
2. opens one `withExclusiveTransactionAsync`;
3. runs `fn`, which may contain several statements;
4. commits, then bumps one global change counter and emits one event;
5. rolls back and rethrows on any error, emitting nothing.

The gate is a promise chain, not a mutex with timeouts. A rejected mutation never blocks the queue. This is the mechanism behind NFR-011: a confirmed write is committed before the screen says so, and a crash leaves either the old state or the new one.

The event carries a counter, not a list of tables. Screens mostly read values derived from several tables at once — an odometer entry changes every part's distance status — so per-table invalidation would under-invalidate unless a dependency map stayed correct. One counter makes every mounted query re-read, which is correct by construction and cheaper in code; NFR-002 already bounds what a re-read costs.

### 4.4 The post-commit pipeline

One pipeline in the app shell reacts to every commit and to a set of lifecycle events (AR-05). It runs tasks in this order, serialized:

1. let every mounted query re-read after the change counter bumps;
2. if the commit came from an odometer update, show the newly-due notice (FR-093);
3. request a sync pass;
4. request a notification rebuild.

Steps 3 and 4 never run before the first frame, and both are queued rather than called inline. Sync is requested first so its 1 s debounce elapses while the rebuild computes, which keeps the five-second target (NFR-003) out of the rebuild's way; the rebuild still starts only after the commit. No feature code calls the scheduler or the engine directly; it emits an event and the pipeline decides. That is the single place to change when a trigger is added.

### 4.5 Ordering guarantees

| Guarantee | Mechanism |
|---|---|
| A row is never pushed before it is committed locally | The engine reads `sync_dirty` through the same gate |
| A pull never applies into a database that is mid-write | The apply runs through the gate |
| The notification schedule never reflects a half-applied pull | Rebuild is requested after the apply transaction commits |
| The cursor never advances without the rows | Cursor write is part of the apply transaction |
| A status shown after a write is the committed status | Hooks re-read after the commit event |

---

## 5. Process lifecycle

### 5.1 Cold start

Critical path, in order, all of it required before the first interactive frame:

1. Process start; the composition root builds configuration and services.
2. Open the SQLite connection and apply PRAGMAs (doc 07 §5.1).
3. Run pending migrations. On the first launch after an install or an update this is a blocking step with a progress state, outside the 2 s budget (TRD §5.7). On a normal launch it is a version read.
4. Read `local_meta`: `device_id`, `last_user_id`, `pull_cursor`, `clock_offset_ms`.
5. Run the home query and compute statuses in memory (NFR-002).
6. Render the first frame.

Started in parallel with step 2 and never gating it: session restore from secure storage. Started after the first frame: the first sync pass, then the notification rebuild.

If `last_user_id` is empty the shell routes to sign-in. If it is set, the home screen renders from local data even when the session is expired or the network is down, and the sync badge shows Offline (AC-21).

### 5.2 First launch after install

No profile, no car, no rows. Migrations create the schema and seed reference data (categories, part templates), then the app routes directly to local car setup. Account connection is optional and requires a network only when the owner chooses it. A failed connection leaves the local profile unchanged.

### 5.3 Foreground and background

| Event | Action |
|---|---|
| App backgrounded | Stop the retry timer and stop token auto-refresh. Let an in-flight pass finish if it can; it is idempotent, so a kill is safe. Do not start a new rebuild or pass. |
| App foregrounded | Resume token auto-refresh. If the local date or time zone changed since the last rebuild, rebuild. Run a sync pass immediately. Re-read the last-user marker. |
| App killed | Nothing is buffered in memory. Notifications survive; the next launch rebuilds them. An interrupted push or pull is harmless: the cursor only advanced with a commit. |

### 5.4 Day rollover

While the app is foregrounded, one timer fires at the next local midnight (device clock, never the corrected sync clock). It triggers a status recompute and a notification rebuild, because time-based statuses and the "today's reminder" rule both depend on the local date. On foreground, the same check compares `local_meta.notifications_built_for` with `LocalDate.today()` and rebuilds when they differ, which covers a phone that slept through midnight.

### 5.5 Shutdown safety

There is no shutdown hook to rely on. Every confirmed write is committed, every scheduled notification is in the OS, and every piece of in-memory state is derived from the database at startup. The architecture has no "save on exit" step by design.

---

## 6. Runtime flows

Each flow is stated as the order of operations that matters. Failure branches that change user-visible behaviour are named; the full matrix is in §10.

### AF-01 Cold start with a valid session

1. §5.1 steps 1–6; home renders from SQLite.
2. Session restore completes; badge goes from Offline to Pending or Synced.
3. The pipeline requests a sync pass, then a rebuild.
4. The pass pushes whatever is dirty, then pulls; the rebuild reads its snapshot and schedules.
5. Pulled rows are applied, hooks re-read, the badge settles (AR-07).

### AF-02 Cold start offline, or with an expired session

1. Home renders and is editable from SQLite (AC-21, FR-006).
2. Session restore fails or the network probe fails; the badge shows Offline.
3. No sync pass runs. The reminder rebuild still runs, because it is local.
4. When the network returns, the reachability listener triggers one pass. A failed token refresh is retried on the next foreground, never in a tight loop.

### AF-03 First sign-in on a new device (J-05)

1. Sign-in succeeds; the JWT is stored in secure storage.
2. If `last_user_id` is set and differs, the local wipe runs before anything else, inside one transaction, and only after the owner confirms discarding any rows the previous account left unsynced (AR-14).
3. The local `users` row and `user_settings` row are created and queued for push.
4. The pull runs from cursor 0. It is unpaged, so the whole dataset arrives in one response and is applied parent-first.
5. The cursor is stored, the notification rebuild runs, the home screen shows the restored data.
6. Setup is skipped: a car already exists. Only an account with no car routes to setup.

### AF-04 Mileage update (J-02)

1. The form validates against the domain rules (BR-01, A-03) before any write.
2. The repository writes the entry, stamps the envelope, queues it.
3. The commit emits; hooks re-read the home query.
4. The domain recomputes statuses; the screen shows them within the NFR-002 budget.
5. The pipeline compares the pre-update and post-update statuses and shows the FR-093 notice for parts that newly became Due soon or Overdue.
6. Sync is requested after the 1 s debounce, so the change can reach the cloud inside NFR-003.
7. Rebuild is requested behind the sync request; today's reminder disappears from the schedule because a live entry is dated today (D-50).

The pre-update statuses are held by the feature hook for the duration of the update, not stored anywhere. If the app dies between steps 2 and 5, the data is correct and the notice is lost, which is acceptable: it is an in-app courtesy, not a record.

### AF-05 Mark as replaced (J-03)

1. Defaults come from the domain: current odometer and today's local date.
2. Validation rejects a service km above the current odometer and a future date (FR-051).
3. One write creates the service record; no counter is stored on the part, because the active record is derived (D-33).
4. Commit, re-read, recompute; the part shows its full interval again.
5. Sync and rebuild are requested by the pipeline, in that order.

### AF-06 First-time setup (J-01)

1. Car creation and its first odometer entry are one transaction: a car without an odometer entry would violate the home query's assumptions.
2. Default parts are created from the templates matching the profile, with ids `carId:templateCode` (D-48).
3. Baseline records are written per part as the owner enters a last-change km and, optionally, a date (D-26, D-32).
4. "All serviced today" is one transaction that writes one baseline per part (FR-062).
5. The screen never blocks on sync; the whole setup can be completed in airplane mode once signed in.

### AF-07 A pull changes data (F-13)

1. The engine reads `pull_cursor` and calls `pull_rows`.
2. The response arrives as one JSON value with `rows`, `max_seq`, `server_now` and `schema_version`.
3. The remote adapter checks `schema_version` against the handshake rule (AR-08) before anything is applied.
4. The batch is applied in one gated transaction, parent-first, with deferred foreign keys:
   - each row is compared with the local row by the merge predicate;
   - a pulled row that wins is written; a local row that wins is kept and stays dirty (AR-15);
   - a dirty row that a pulled row overwrites is recorded by the conflict reporter, then cleared from `sync_dirty`;
   - `max_seq` is stored as the cursor in the same transaction.
5. After commit: queries re-read, the rebuild runs, and the notice appears on the next home screen if anything was discarded. The list is stored whole — never capped — because the dataset bounds it; the screen truncates the display.

### AF-08 A push changes data (F-13)

1. The engine reads the dirty set and the current value of each row under the gate, parent-first, and remembers each row's `loaded_updated_at`.
2. It sends one `push_rows` call outside the gate.
3. The response lists `applied` and `rejected` ids.
4. Under the gate, dirty entries are removed only where the row's current `updated_at` still equals `loaded_updated_at`; rows edited during the call stay queued.
5. Rejected rows are not retried as pushes. The pull that follows returns the winner, and the local row is replaced or kept by the same predicate, with a conflict entry if a local edit loses.
6. A successful pass clears the backoff and updates the badge.

### AF-09 Notification rebuild

1. Requested by the pipeline, never by a screen.
2. The service reads one snapshot: reminder settings, the car, the parts with their active records and statuses, the last inspection dates, and the live odometer date.
3. If reminders are enabled it computes the budget: `alerts = 2 × time-interval parts with alerts on`, `reminder_days = clamp(64 − 8 − alerts, 7, 30)`, with the 8 slots reserved for the pause notice and the floor. With reminders off the window is zero days, nothing is reserved, and alerts take the whole ceiling (AR-18).
4. It builds the schedule in memory: alert dates nearest-first, then the daily reminder days and the paused notice — the last of these only when reminders are enabled.
5. It cancels every pending notification owned by the app and schedules the new set. A rebuild is idempotent; a partial failure is repaired by the next one.
6. It records `local_meta.notifications_built_for`, so the rollover check of §5.4 is cheap.

A rebuild never runs inside a pull transaction (AR-09); it is requested after the commit, so it can never schedule from a half-applied batch.

### AF-10 Notification tap and deep link

1. The OS launches or foregrounds the app with a URL: `carmaint://mileage` or `carmaint://part/<encoded-part-id>`.
2. The notification service parses it; the router validates that the target still exists locally.
3. A deleted part or a stale notification falls back to the home screen rather than an error.
4. The screen is reached in one tap from the reminder (NFR-050).

Template part ids contain `:` (`carId:templateCode`), so ids are URL-encoded in the link and decoded by the parser. The grammar is frozen here (AR-17), not in documents 04 or 08: scheduled notifications bake the URL into the OS, so a later change means cancelling and rebuilding the whole window. Document 04 owns only the destination screens.

### AF-11 Sign-out and switching account

1. Sign-out is local and immediate: it clears the session and `last_user_id`, keeps every row, and does not wait for the network (AR-14).
2. Queued rows stay in `sync_dirty`. Signing back in as the same user pushes them on the first pass, resuming from the stored cursor.
3. Signing in as a different user is the only destructive step: one transaction wipes the user tables and the adapter tables after a confirmation naming how many rows are still unsynced (AF-03 step 2), then a new `device_id` is generated.
4. The same user therefore keeps both their data and their cursor; the wipe exists only for switching accounts.

### AF-12 App update, migration and schema handshake

1. The new build starts, sees a pending migration and applies it with a progress state, before any screen reads data.
2. A failed migration rolls back. The app shows a blocking screen naming the migration and does not open the database (AR-10, fatal class).
3. On the first sync, the client sends its cursor and receives `schema_version`.
4. Cloud newer: sync is refused, the banner says the app must be updated, local work continues, and no pass is retried until the next cold start (AR-08).
5. App newer: impossible unless a cloud migration shipped late; blocked with a distinct message and logged as a release error.
6. Equal: sync proceeds.
