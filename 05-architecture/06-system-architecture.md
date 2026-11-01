# 06 · System Architecture Document (SAD)

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.3 (approved 2026-11-01) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [PVD](../01-discovery/01-product-vision.md), [PRD](../02-product-requirements/02-prd.md), [SRS](../03-technical-specifications/03-srs.md), [TRD](../03-technical-specifications/05-trd.md), [Database Design](../06-database/07-database-design.md), [README](../README.md) |

**Conventions.** `AR-xx` labels an architectural decision in this document; the approved set maps in order onto README decisions `D-74` to `D-93`, exactly as `T-xx` became `D-54` to `D-72`. `D`, `A`, `OQ`, `FR`, `NFR`, `BR`, `C`, `R`, `AC` keep the meaning they have in the README, PRD and SRS. Paths such as `src/sync/engine.ts` name modules, not files that exist yet. No application source code is produced in the documentation phase; the snippets are illustrative contracts.

**Scope.** The runtime structure of the app: components and their boundaries, the execution and transaction model, the lifecycle of a process, the runtime flows that implement the PRD journeys, the sync state machine, where the notification scheduler sits, and how the system behaves when something fails. Document 04 owns screens, 08 owns endpoint payloads and error codes, 09 owns the threat model, 11 owns test cases and 12 owns build and release. This document is the bridge between the TRD's choices and the code that will be written from them.

**Position.** Documents 02, 03, 05 and 07 are approved. This document adds no new technology and no new data: it assigns responsibility, fixes the order of operations and states what each component may never do. Where it disagrees with an approved document, the disagreement is listed in §16 rather than silently resolved.

---

## 1. Architectural drivers

| Driver | Source | Structural consequence |
|---|---|---|
| The device database is the working copy | D-02, FR-100, NFR-010 | SQLite is the only source of truth for reads. No query cache, no optimistic in-memory mirror, no network call in a render path. |
| Local work never waits on authentication or the network | D-28, AC-21, NFR-010 | Authentication and sync are optional services from the write path's point of view. The database opens and the home screen renders before either resolves. |
| One merge rule, enforced in two places | D-23, D-35, BR-19 | One writer on the device, one writer in the cloud, the same predicate on both sides. Rejected and conflicting rows must be explainable. |
| One owner of every notification | D-24, D-63, C-10 | A single scheduler module, a single rebuild routine, called from one place in the lifecycle. |
| One shared cloud database, isolated by RLS | D-58, NFR-021 | No per-user provisioning, no server component of ours, no privileged credential on the device. |
| Cloud writes go through one function | D-60 | The device has a narrow remote seam: two calls, no table access for writes. |
| A sideloaded client can lag behind the cloud | D-69, D-73, D-68 | Version skew is a normal state, not an incident. The client asks for the cloud schema version and refuses to sync when it is behind. |
| Two-second cold start | NFR-001 | The startup path is enumerated and ordered; everything not needed for the first frame runs after it. |
| One developer, no operations | C-09, D-71 | No background jobs, no queue, no worker service, no scheduler in the cloud. Every moving part runs on the phone or is a Supabase feature. |
| Sync and auth must be replaceable | NFR-083 | Adapters behind interfaces, chosen once in a composition root, never referenced by feature code. |

---

## 2. System context

### 2.1 Actors and external systems

| Actor or system | Relationship | Contract | Failure it can cause |
|---|---|---|---|
| Owner | The only user in R1; one phone at a time, two phones in practice | App UI | — |
| Device OS | Sandbox, secure store, notification delivery, network reachability, clock | Platform APIs | Notification limits, force-stop, reboot, clock drift |
| Supabase Auth | Issues and refreshes the user JWT | HTTPS, `@supabase/supabase-js` | Expired session, rate-limited email, provider outage |
| Supabase Postgres | Holds all synced rows, RLS policies, the two functions | HTTPS through the client library | Paused free project, quota, latency |
| Developer machine | Applies cloud migrations; holds the service-role key; builds releases | Supabase CLI, build pipeline | A migration applied out of order or ahead of the client |
| Operator (same person) | Account deletion in R2 | Service-role script | — |

There is no server-side component written by this project (D-71), no scheduled job, no message queue, no webhook and no push service.

### 2.2 Trust boundaries

```
device, one app process
├─ routes ── hooks ── domain
│            └─ repositories ── SQLite  (working copy, unencrypted, D-67)
├─ sync engine ── remote adapter ── Clock
├─ notifications ── OS scheduler            (local only, no network)
└─ auth service ── secure store (JWT)

HTTPS, anon key + user JWT ──────────────▶ Supabase project
                                            Auth ── JWT
                                            Postgres: RLS + push_rows / pull_rows
                                                      ▲
                                                      │ migrations, service-role key
                                            developer machine  (never on the device)
```

Three boundaries matter and each is enforced by exactly one mechanism:

| Boundary | Enforced by | Not enforced by |
|---|---|---|
| Account A cannot read account B | RLS in PostgreSQL (D-58) | Client code, query filters, UI |
| A client cannot write a row directly | No `insert`/`update`/`delete` grant; `push_rows` only (D-60) | Hiding the anon key, which is public by design |
| Local data cannot leak through the network | The remote adapter sends only synced columns of the seven tables | Encryption at rest, which R1 does not have (D-67) |

### 2.3 Runtime topology

- One app process per device. No background service, no headless task, no widget in R1 (AR-06).
- One SQLite file per install, in the app sandbox, with WAL on.
- One shared cloud database for all accounts. A second Supabase project exists only as the development environment (TRD §15).
- Two devices are the practical maximum in R1, but nothing in the design depends on that number.

---

## 3. Component decomposition

### 3.1 Layers and dependency direction

The TRD fixes the top-level folders (§4). This section says what lives in them and what may import what.

```
app/                 routes, screens, root layouts
src/features/        one hook module per screen or flow
src/domain/          pure functions and types: status, LocalDate, validators, money, format
src/data/            connection, migrations, repositories, row types, sync store
src/sync/            engine, clock, conflicts, remote/ adapters
src/notifications/   scheduler, budget, channels, permission, deep-link parsing
src/auth/            session, provider adapter, last-user marker, wipe
src/i18n/            catalogs and formatting entry points
src/ui/              presentational components, theme, accessibility helpers
src/services.ts      the composition root
```

| Layer | May import | Must never import |
|---|---|---|
| `app/` | `src/features`, `src/ui`, `src/i18n` | `src/data`, `src/sync`, `src/auth`, `src/domain` internals, any platform SDK |
| `src/ui/` | `src/i18n`, other `src/ui` modules | `src/features`, `src/data`, `src/sync`, `src/auth` |
| `src/features/` | `src/domain`, `src/data/repositories`, `src/notifications` (only the permission prompt), `src/i18n` | `src/sync`, `src/auth` internals, SQLite or Supabase clients |
| `src/domain/` | nothing | React, Expo, SQLite, network, `Date` arithmetic |
| `src/data/` | `src/domain` types, SQLite | React, `src/sync`, `src/features` |
| `src/sync/` | `src/data` (read and bookkeeping APIs only), `src/auth` interface, `src/domain` types | `app/`, `src/ui`, `src/features` |
| `src/notifications/` | `src/data` read API, `src/domain`, `src/i18n` | `src/sync`, `app/`, `src/ui` |
| `src/auth/` | secure store, cloud auth SDK | `src/data` (except the wipe callback it is given) |

Two rules are worth stating because they are the ones that erode first:

- Only `src/auth/session.ts` and `src/sync/remote/` may reference `@supabase/supabase-js`. A screen that imports the client is a defect, even if it works.
- Only `src/notifications/` may call the notification library. Nothing else in the app can schedule, cancel or inspect a notification.

### 3.2 Component catalog

| ID | Component | Path | Responsibility | Never does |
|---|---|---|---|---|
| CMP-01 | App shell | `app/_layout.tsx`, `src/services.ts` | Builds every service once, wires `AppState`, network and route providers, owns the root error boundary, runs the startup sequence | Business rules, SQL, network calls of its own |
| CMP-02 | Routes and screens | `app/**` | Render state, collect input, navigate, show errors | Query the database, call the cloud, compute status |
| CMP-03 | Feature hooks | `src/features/*` | Turn a screen's intent into repository calls, subscribe to the change event, own form state | Reimplement domain rules; write rows directly |
| CMP-04 | Domain core | `src/domain/*` | Status engine, `LocalDate`, validators, money, formatting contracts | Any I/O, any React import, any `Date` arithmetic |
| CMP-05 | Database | `src/data/db.ts` | One connection, PRAGMAs, exclusive transactions, the write gate, the change emitter | Know what a part is |
| CMP-06 | Migration runner | `src/data/migrations/*` | Apply pending forward-only modules, record `schema_migrations` | Run after startup, touch the cloud |
| CMP-07 | Repositories | `src/data/repositories/*` | Validate, stamp the envelope, write, queue for sync, and serve the read queries of doc 07 §7 | Sync, schedule notifications, call the cloud |
| CMP-08 | Sync store | `src/data/sync-store.ts` | The only API the sync engine has: read dirty rows, read a row by id, clear an acknowledgement, apply a pulled batch, read and write `local_meta` | Validate business rules |
| CMP-09 | Auth service | `src/auth/*` | Sign-in, sign-out, session refresh, secure storage, last-user marker, local wipe on user change | Read or write user data |
| CMP-10 | Sync engine | `src/sync/engine.ts` | Single-flight push-then-pull, state machine, triggers, backoff, schema handshake | Compute status, touch notifications, touch UI |
| CMP-11 | Remote adapter | `src/sync/remote/` | The two function calls, request and response shape, error classification, `server_now` | Know about SQLite or React |
| CMP-12 | Clock | `src/sync/clock.ts` | `now()` with the measured offset; restamp implausible future rows on push | Supply calendar dates |
| CMP-13 | Conflict reporter | `src/sync/conflicts.ts` | Record which local edits a pull discarded, and their labels | Prompt, merge, or retry |
| CMP-14 | Notification service | `src/notifications/*` | Permission, Android channels, budget, one idempotent rebuild, deep-link parsing | Read the database directly, write anything |
| CMP-15 | i18n | `src/i18n/*` | Catalogs, plural rules, locale formatting entry points | Contain business logic |
| CMP-16 | UI kit | `src/ui/*` | Presentational components, theme, accessibility helpers, the sync badge and banner | Fetch or compute |

Components carry `CMP-xx` labels, which are deliberately distinct from the SRS's `C-xx` constraints.

The composition root is the only place where a concrete class is chosen. Everything else receives an interface, which is what makes the test seams of §13 possible and satisfies NFR-083.

### 3.3 Where new behaviour goes

| Change | Goes in | Also touches |
|---|---|---|
| A new derived value or status rule | `src/domain/status.ts` | Doc 07 §6, unit tests |
| A new read the UI needs | A repository query | Doc 07 §7 |
| A new field or table | Migration module + row type + repository | Doc 07 §4, cloud migration, push whitelist |
| A new screen | `app/` route + `src/features/` hook | Doc 04 |
| A new sync trigger | `src/sync/engine.ts` trigger table | §7.4 here |
| A new notification type | `src/notifications/` + budget rules | Doc 05 §11, doc 11 test cases |
| A new remote call | `src/sync/remote/` | Doc 08 contract, `push_rows`/`pull_rows` |
| A new permission | Nowhere in R1 | Requires an owner decision; R1 requests notifications only |

---

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

No user, no car, no rows. Migrations create the schema and seed reference data (categories, part templates). The only path forward is sign-up or sign-in, because first sign-in requires a network (BR-17). A failed sign-in leaves nothing behind: the local `users` row is created only after authentication succeeds.

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

---

## 7. Sync engine

### 7.1 Responsibility

The engine owns *when* sync happens, *in what order*, and *what the visible state is*. It does not own the merge predicate (the cloud function and the apply routine implement it), the row shape (doc 07), the payload (doc 08) or the UI (doc 04).

### 7.2 Internal state machine

```
idle ──trigger──▶ scheduled ──▶ pushing ──▶ pulling ──▶ idle
                      ▲                                     │
                      └────────── backoff ◀─────────────────┘
                               (retryable failure)

blocked: entered from any state on a non-retryable failure;
only a cold start leaves it.
```

| State | Meaning | Exit |
|---|---|---|
| `idle` | No pass running, nothing queued | A trigger moves to `scheduled` |
| `scheduled` | A pass is wanted; debounce or gate not yet satisfied | `pushing`, or back to `idle` if cancelled |
| `pushing` | Push batch in flight (network, outside the gate) | `pulling` |
| `pulling` | Pull call in flight, then apply under the gate | `idle` on commit |
| `backoff` | A retryable failure occurred; a timer is running | `scheduled` on timer, `idle` if a success clears it |
| `blocked` | A failure retrying cannot fix | Only a cold start clears it |

The engine is single-flight (AR-02): a trigger arriving during a pass sets a `rerun` flag and returns. When the pass finishes, exactly one more pass runs if the flag is set. Triggers never stack.

### 7.3 Visible state

The badge shows four states (FR-105). They are derived, never stored (AR-07), with this precedence:

| Precedence | Visible state | Condition |
|---|---|---|
| 1 | Offline | No usable network, or no valid session |
| 2 | Error | The last pass failed for a non-offline reason, or the engine is `blocked` |
| 3 | Pending | `sync_dirty` is non-empty, or a pass is running |
| 4 | Synced | Nothing dirty and the last pass succeeded |

Offline outranks Error because "you are offline" is the more useful truth when both are true; Error outranks Pending because a queue that is not moving is not progress.

### 7.4 Triggers

| Trigger | Delay | Notes |
|---|---|---|
| A committed local write | 1 s debounce | Exists so NFR-003 is reachable without a call per keystroke |
| App open, after first frame | immediate | One pass on every launch |
| App foregrounded | immediate | Also checks the local date and zone |
| Network regained | immediate | Only when it was offline |
| Pull-to-refresh | immediate | User-initiated; bypasses the debounce, not the single-flight rule |
| Sign-in complete | immediate | Usually the first pull from cursor 0 |
| Backoff timer | 2 s, doubling, capped at 60 s | Reset on success, foreground or network regain |
| Midnight / date change | rebuild only | Not a sync trigger |

No trigger runs while the app is backgrounded. There is no periodic timer and no background fetch (AR-06).

### 7.5 Pass algorithm

1. Wait for `scheduled` precondition: not backgrounded, session valid, network present.
2. `pushing`: under the gate, read the dirty rows and their current values, ordered parent-first; release the gate.
3. Call `push_rows` with the batch and the JWT. Classify the result (AR-10).
4. Under the gate, clear acknowledged dirty entries by `loaded_updated_at` (AF-08 step 4).
5. `pulling`: read `pull_cursor`, call `pull_rows(cursor)`.
6. Update the clock offset from `server_now` (TRD §10.4).
7. Apply under the gate as in AF-07 step 4.
8. Publish the outcome; the pipeline requests a rebuild if rows changed.
9. A rejected id that is still dirty after the apply means the cloud refused a row the merge cannot reconcile: go to `blocked` (Data class) and stop, instead of retrying a deterministic rejection forever.
10. Otherwise set `idle`, clear the backoff, and run the follow-up pass if the rerun flag is set.

A failed push *call* — network error, 5xx, paused project — ends the pass in `backoff` before the pull (AR-02). Reading might still work, but splitting the pass would add a second state machine for little gain: a Supabase outage takes both functions together. A rejected row is not a failed call: the function returned, so the pull runs and reconciles it.

### 7.6 Merge rules on device

| Local row | Pulled row | Result |
|---|---|---|
| Clean, older | Newer | Pulled row written |
| Clean, newer | Older | Pulled row ignored (the cloud has not seen this device yet) |
| Dirty, newer | Older | Local kept, still dirty; pushed next pass (AR-15) |
| Dirty, older | Newer | Pulled row written, dirty entry cleared, conflict recorded and labelled |
| Absent | Any | Pulled row inserted |
| Present, not dirty | `deleted_at` set | Soft-deleted locally, hidden from queries |

The predicate is the cloud's: `updated_at` descending, then `origin_device_id` ascending as the tie-break (D-35). Applying it on both sides means a device that is behind cannot resurrect a row merely by reconnecting.

### 7.7 Failure classification

| Class | Examples | Engine reaction |
|---|---|---|
| Retryable | Network error, timeout, 5xx, paused free project | `backoff`, retried on timer and on the next trigger |
| Session | Expired or invalid JWT | Treated as Offline; refresh attempted once per foreground |
| Update required | Cloud `schema_version` newer than the app's | `blocked`, banner, no retries until cold start |
| Data | Local `CHECK` violation while applying a pull; a rejected push that the following pull did not reconcile | Transaction rolled back or push stopped, cursor unchanged where relevant, `blocked`, offending table and id logged without personal data |
| Programming | Missing table in the payload, malformed response | Treated as Data; the pass is not retried in a loop |

The rule behind the table: retry only what a retry can fix (NFR-012), and never loop on a deterministic failure. The engine has no path that discards local data on its own.

### 7.8 Clock

`Clock.now()` is the only source of `updated_at`; it is device time plus `clock_offset_ms`. The offset is recomputed from `server_now` on every successful pull, and a row more than 24 hours ahead of the server is restamped on push, locally as well, so the two never disagree. `LocalDate.today()` bypasses the clock entirely (D-61); mixing them would shift every status by a day near midnight.

### 7.9 What the engine deliberately does not do

- No paging of the pull, no partial apply, no resumable batch (doc 07 §9).
- No per-table conflict resolution, no field-level merge, no manual merge UI (D-70).
- No background sync, no push-triggered sync, no server scheduling.
- No retry of a rejected row as a push; the pull reconciles it.
- No "sync now" control and no last-synced timestamp: the four-state badge and pull-to-refresh are the whole surface (FR-105, AR-07).
- No UI work: it publishes state, and the badge renders it.

---

## 8. Notification scheduler

### 8.1 Placement

The scheduler is a leaf service in `src/notifications/`, called only by the post-commit pipeline and the lifecycle checks of §5.3 and §5.4. It sits beside the database, not inside it: it reads through a repository query, computes with the domain engine, and talks to the OS. That keeps three properties:

- the write path never waits for the notification system;
- a rebuild can never run inside a transaction, so it cannot observe a half-applied pull;
- the budget formula has exactly one implementation (D-63).

### 8.2 Rebuild algorithm

1. Read the snapshot inside one read transaction: `user_settings`, `cars`, `parts` with active records, inspection dates, and whether a live odometer entry is dated today.
2. Project each part's time status to each candidate date with the domain engine; distance status uses the odometer known now and is not projected (FR-082).
3. Count alerts and compute the reminder window from the budget formula.
4. Build the list: alert notifications nearest-first, then daily reminders, then the paused notice.
5. Cancel all pending notifications owned by the app, then schedule the list.
6. Store the build date for the rollover check.

If the OS refuses a scheduling call, the service schedules the rest and reports a degraded state; it never retries in a loop and never blocks a write.

### 8.3 Triggers owned by the pipeline

Odometer change, service record change, part or interval change, reminder setting change, app open, foreground, local date change, time-zone change, pull that changed parts or records, and permission granted after being denied (FR-046, FR-092). The list lives in one place so a new trigger cannot be added to only half the app.

### 8.4 Permission and channels

Permission is requested in context, when reminders or alerts are first enabled, never at launch (FR-085, AC-20). Denial schedules nothing and keeps every other feature working. On Android the two channels (`reminders`, `alerts`) are created before the first schedule so the owner can mute one without the other (D-63). No exact-alarm permission is requested; the Settings copy states that delivery may be a few minutes late.

### 8.5 Deep links

A notification carries ids and a kind only, never text, personal data or amounts, and the router resolves them after the app opens. Parsing, validation and fallback live in the notification service; navigation lives in the route layer. The grammar is frozen in AF-10 (AR-17). This keeps a notification from becoming a second, unvalidated way into the screens.

---

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

---

## 14. Decisions

### 14.1 Architectural decisions

Approved 2026-11-01. `AR-01` to `AR-20` map in order onto README `D-74` to `D-93`.

| ID | Decision |
|---|---|
| AR-01 | Single process, single SQLite connection, single writer: every mutation — repository write, pull apply, migration, local wipe — passes through one serial write gate; reads do not. |
| AR-02 | Sync is one single-flight coordinator. A pass is push then pull; triggers coalesce; at most one pass runs; a write during a pass schedules exactly one follow-up pass. A failed push call ends the pass in backoff before the pull. |
| AR-03 | Network calls never hold the write gate: the engine snapshots under the gate, sends outside it, then re-enters to acknowledge. |
| AR-04 | One composition root builds every service once; no module constructs its own singleton or reads build configuration directly. |
| AR-05 | One post-commit pipeline owns query invalidation, the newly-due notice, the sync request and the notification rebuild, in that order. Features emit events and never call the scheduler or the engine. |
| AR-06 | Release 1 executes nothing while backgrounded: no background task, no headless sync, no push. Triggers are launch, foreground, network regain, pull-to-refresh and writes while foreground. |
| AR-07 | The visible sync state is derived from network, session, dirty count and last result, never stored; precedence Offline > Error > Pending > Synced. |
| AR-08 | An outdated client refuses to sync and says so; there is no grace period. Local work continues and retries stop until the next cold start. Closes OQ-14. |
| AR-09 | The notification service is the only caller of the notification library and rebuilds from a read snapshot after first paint, never inside a transaction. |
| AR-10 | Every failure has exactly one class and one surface: field error, local message, sync banner, or blocking screen. No silent catch and no duplicate surface. |
| AR-11 | Screens import hooks only; only `src/auth` and `src/sync/remote` import the cloud SDK; only `src/notifications` imports the notification library. Enforced by an import-boundary lint rule. |
| AR-12 | Test seams are constructor arguments (`Database`, `Clock`, `AuthProvider`, `RemoteStore`, `Notifier`); no module mocking, and the same fakes serve unit, integration and end-to-end tests. |
| AR-13 | The conflict notice payload is a JSON list of `{table, id, label}` stored whole — never capped — under `local_meta.conflicts_pending`, because a counter cannot name the affected parts; the screen truncates the display. The rebuild also stores `notifications_built_for` there. This was the amendment applied to doc 07 §4.10 and TRD §10.3 (D-86). |
| AR-14 | Sign-out is local and immediate: it clears the session and keeps every row, including queued ones. The only destructive confirmation is the account-switch wipe, which names how many rows are still unsynced. |
| AR-15 | A pull never overwrites a queued local row that wins the merge predicate: the local row is kept, stays dirty and is pushed on the next pass. A pulled row wins only when it wins the envelope comparison. |
| AR-16 | No orphan repair is written. Soft deletes plus a parent-first transactional push make an orphan impossible; a foreign-key failure rolls back the batch and holds the cursor. Child tables carry composite `(parent_id, user_id)` keys to `unique (id, user_id)` on `cars` and `parts`; `parts.category_id` stays a plain key because system categories have no `user_id`. |
| AR-17 | Deep links are `carmaint://mileage` and `carmaint://part/<url-encoded-id>`. Notification payloads carry ids and a kind only, never text, names or amounts; an unknown target falls back to the home screen. Frozen now, because scheduled notifications bake the URL into the OS (D-72). |
| AR-18 | The paused notice and the 8 reserved slots exist only while reminders are enabled. With reminders off the window is zero days, nothing is reserved, and part alerts take the whole notification ceiling. |
| AR-19 | A retry decision follows the engine error, not the phase: constraint, `CHECK` and foreign-key failures go to `blocked`; `SQLITE_FULL`, `SQLITE_BUSY` and I/O failures go to `backoff` with the cursor unchanged. |
| AR-20 | Errors cross layer boundaries as typed codes, never as sentences. Repositories, the engine and the remote adapter return enum members; only the UI layer maps them to i18n keys, and document 08 maps server errors into the same set. |

### 14.2 Open questions

| ID | Question | Status |
|---|---|---|
| OQ-14 | Answered here: refuse sync for an outdated client, no grace period (AR-08, D-81). The alternative would double the merge surface for a client the owner installs by hand. | Closed 2026-11-01 |

No open questions remain in this document. OQ-15, OQ-16 and OQ-17 remain owned by documents 11, the owner and 12.

---

## 15. Traceability

| Requirement | Where addressed |
|---|---|
| FR-001 to FR-006 | §6 AF-03, AF-11; CMP-09; §9 ownership |
| FR-020 to FR-027 | §6 AF-04; CMP-07; §10 field class |
| FR-030 to FR-037 | §6 AF-06; §9 reference data |
| FR-040 to FR-049 | CMP-04 pure domain; TRD §5.6 recompute list; §5.4 day rollover; §6 AF-04 |
| FR-050 to FR-056 | §6 AF-05 |
| FR-060 to FR-063 | §6 AF-06 |
| FR-070 to FR-075 | §3.1 dependency rules; CMP-02, CMP-03 |
| FR-080 to FR-094 | §8 scheduler; §6 AF-09, AF-10; AR-18 conditional pause notice |
| FR-100 to FR-106 | §1, §4, §7, §9 |
| FR-110, FR-111 | CMP-07 settings repository; §5.1 |
| NFR-001 | §5.1 critical path |
| NFR-002 | §4.4, §6 AF-04 |
| NFR-003 | §7.4 debounce |
| NFR-010, NFR-011 | §4.3 write gate, §6 AF-02 |
| NFR-012 | §7.7 classification, §7.9 |
| NFR-021, NFR-023 | §2.2, §11 |
| NFR-022, NFR-024 | §11 token handling |
| NFR-025 | §2.2 data at rest |
| NFR-030 | §10.3 logging, §9 ownership |
| NFR-050 | §6 AF-10, AR-17 |
| NFR-070 | §10.1 typed codes, CMP-15 |
| NFR-080, NFR-081 | CMP-06, §9 reference data |
| NFR-082 | §7.8, CMP-12 |
| NFR-083 | §3.2 composition root, §13 seams |
| D-28, AC-21 | §5.1, §6 AF-02 |
| D-35 | §7.6 merge rules |
| D-49, A-06 | §8.2 snapshot and budget |
| D-50 | §6 AF-04, AF-09 |
| D-02, D-60 | §9.1 transactional apply, AR-16 |
| D-58 to D-60 | §2.2, §7, §11 |
| D-70 | §6 AF-07, §7.6, AR-13 |
| D-73, OQ-14 | §7.7, §6 AF-12, AR-08 |

---

## 16. Follow-ups

| Document | Point |
|---|---|
| Owner | Done 2026-11-01: AR-01 to AR-20 approved as D-74 to D-93, OQ-14 closed. |
| 07 Database | Done 2026-11-01 (v0.5): `conflicts_pending` and `notifications_built_for` described in §4.10 and §9; `unique (id, user_id)` and the composite foreign keys added; the orphan question closed as structurally impossible and removed from §14.2. |
| 05 TRD | Done 2026-11-01 (v0.5): §5.5 and §10.3 aligned; the orphan and composite-key follow-ups removed from §18.5; OQ-14 noted closed. |
| 08 API | The two function payloads, the error body shapes and the mapping of server errors onto the AR-20 codes. The deep-link grammar is already frozen (AR-17); only destination screens remain, with 04. |
| 09 Security | Threat model for RLS, the service-role key, the local database, and the capability table of §11. |
| 11 Testing | Turn §13 seams and the §10.2 matrix into test cases, including the contract suite that runs the fake's scenarios against the real functions; real-device checks for notification and pull latency. |
| 12 Deployment | The cold-start migration screen, the operator steps of §6 AF-12, and the re-signing routine. |
| 03 SRS | Done 2026-11-01 (v0.6): C-03 and the external-dependencies table now name Supabase, and NFR-083 no longer speaks of a fallback backend. |

---

## 17. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First version: architectural drivers, system context and trust boundaries, component catalog with a dependency and an import-boundary matrix, execution model with the write gate and post-commit pipeline, process lifecycle, twelve runtime flows, the sync state machine with visible-state derivation, trigger table, pass algorithm, local merge rules and failure classification, notification scheduler placement and rebuild algorithm, data ownership, the error and degradation matrix, security capabilities, extension points, test seams, AR-01 to AR-15, traceability and follow-ups. |
| 0.2 | 2026-11-01 | Revision after an owner grilling round. Sign-out is now local and immediate; the only destructive confirmation is the account-switch wipe (AR-14 rewritten), so the sign-out flush and its trigger are gone. The pipeline requests sync before the rebuild; one global change counter replaces per-table invalidation. AR-13 stores the conflict list whole and adds `notifications_built_for`. AR-16 closes the orphan question as structurally impossible and adds composite keys; AR-17 freezes the deep-link grammar; AR-18 makes the paused notice and its reserved slots conditional on reminders being enabled; AR-19 classifies retries by engine error so a full disk is not `blocked`; AR-20 makes errors cross layers as codes. The in-memory remote is now guarded by a contract suite against the real functions. |
| 0.3 | 2026-11-01 | Approved. AR-01 to AR-20 promoted to D-74 to D-93 in the README register; OQ-14 closed; follow-ups for documents 05 and 07 marked done after their amendments landed. |
