# SAD · Drivers, system context, component decomposition

> Part of [06-system-architecture.md](../06-system-architecture.md). Sections: §1, §2, §3. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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
