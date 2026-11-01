# 08 · API Specification

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.3 (approved 2026-11-01) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [SRS](../03-technical-specifications/03-srs.md), [TRD](../03-technical-specifications/05-trd.md), [SAD](../05-architecture/06-system-architecture.md), [Database Design](../06-database/07-database-design.md), [README](../README.md) |

**Conventions.** `API-xx` labels a decision in this document; the approved set maps in order onto README decisions `D-94` to `D-106`. `FR`, `NFR`, `C`, `BR`, `D`, `OQ` keep their meaning from the SRS, PRD and README; `AR-xx` and `DB-xx` are the labels of documents 06 and 07. Paths such as `src/sync/remote` name modules that do not exist yet. No application source code is produced in the documentation phase: the JSON and SQL below are contracts, not implementations.

**Scope.** The network surface between the app and Supabase: the two RPC functions, their payloads, the error vocabulary, the schema handshake, and the notification payload. It does not define the schema (document 07), the sync engine's state machine (document 06), the screens (document 04) or the threats (document 09).

**Position.** Documents 01, 02, 03, 05, 06 and 07 are approved. This document adds no new data and no new technology: it fixes the wire format of what those documents already decided, and where it disagrees with one of them the disagreement is listed in §12 rather than silently resolved.

---

## 1. Surface

| # | Endpoint | Method | Auth | Direction | Returns |
|---|---|---|---|---|---|
| 1 | `/rest/v1/rpc/push_rows` | POST | JWT + anon key | device → cloud, rows | `applied`, `rejected`, `server_now` |
| 2 | `/rest/v1/rpc/pull_rows` | POST | JWT + anon key | cloud → device, rows | `rows`, `max_seq`, `schema_version`, `server_now` |

That is the whole cloud API for Release 1 (D-60). There is no table endpoint, no upload endpoint, no account endpoint and no health endpoint. Authentication (sign-up, sign-in, refresh, reset) is Supabase Auth's own surface, called only from `src/auth` (D-84); it is out of scope here except for the token rules of §3.

Two consequences worth stating, because they are easy to erode:

- **No custom server.** Nothing runs between the app and PostgreSQL. A feature that needs an endpoint is a feature that needs a new decision, not a new service (D-71).
- **No read path other than `pull_rows`.** The client holds `select` only because `pull_rows` is a security-invoker function that reads under row-level security (document 07 §5.2); the app never queries a table directly on the network. Local reads always hit SQLite (FR-100).

---

## 2. Conventions

| Topic | Rule | Why |
|---|---|---|
| Body format | `application/json`, UTF-8, no BOM | One parser on both sides |
| Field names | `snake_case`, identical to the column names of document 07 | No mapping table to drift |
| Timestamps | Fixed-width UTC, `YYYY-MM-DDTHH:MM:SS.sssZ` (24 characters), and never repeated by one device | Both sides compare `updated_at` as text; the merge predicate is a string comparison, so the format *is* the ordering rule |
| Local dates | `YYYY-MM-DD`, never a timestamp | The owner's typed calendar date, no time-zone conversion (D-29) |
| Booleans | Integers `0` and `1`, never `true`/`false` | SQLite stores integers and PostgreSQL `smallint`; a JSON boolean would need a cast on one side only |
| Unknown value | Explicit `null`, never an omitted key | A sparse row cannot be distinguished from a column the client does not know |
| Numbers | Integers only; no floats anywhere | Money is minor units (D-38), distances are km |
| Names | Table names from a closed list of seven; column names from the schema | The server whitelists both |
| Ids | `TEXT` as stored; never trimmed or normalised on the wire | `parts.id` legitimately contains `:` |

**Timestamps are the one format that must never change.** `updated_at` is the merge predicate on both sides: the cloud upserts `WHERE excluded.updated_at > parts.updated_at` and the device applies the same comparison (D-35). A single `2026-11-01T12:00:00Z` (no milliseconds) or an offset such as `+01:00` sorts differently against the 24-character form and silently breaks the rule. Every timestamp producer — the clock module, the restamp on push, the seed — writes the same shape.

Millisecond precision has one sharp edge: two writes to the same row inside one millisecond would share an `updated_at`, and the D-35 tie-break cannot separate them because they also share `origin_device_id`. The clock therefore never issues the same value twice (§8); the format stays at three digits because the guard removes the reason to widen it.

---

## 3. Authentication and transport

| Item | Value |
|---|---|
| Base URL | `https://<project-ref>.supabase.co` from the build configuration |
| `apikey` header | The project's anonymous key; public by design (NFR-023) |
| `Authorization` | `Bearer <access token>` from Supabase Auth, kept in secure storage (NFR-022) |
| Service-role key | Never on the device, never in a build (D-67) |
| Transport | HTTPS only; a cleartext request is a bug, not a fallback (NFR-020) |
| Timeout | 15 s per request |
| Retry | Never inside the adapter; the engine owns backoff (document 06 §7) |

The adapter in `src/sync/remote` is the only module that sees these two URLs (D-84). It takes the token as an argument; it never refreshes one. On `401` it reports `SESSION_EXPIRED` and stops, and the auth service refreshes at most once per foreground (§6.4). This keeps token lifetime in one module and the request path free of a second state machine.

**Client-side validation before sending.** The adapter refuses to send a row whose shape it cannot vouch for — a missing key, a null `user_id`, a timestamp that is not 24 characters, a value that is not an integer where one is required. The failure is `INVALID_PAYLOAD` and the pass is blocked; sending it would turn a client bug into a server-side rejection that looks like a conflict.

---

## 4. `push_rows`

### 4.1 Request

```json
{
  "p_rows": [
    { "table": "cars", "row": { "id": "5f0c…", "user_id": "b31e…", "name": "Golf", "fuel_type": "diesel", "timing_drive": "belt", "gearbox": "manual", "has_dpf": 1, "created_at": "2026-11-01T09:00:00.000Z", "updated_at": "2026-11-01T09:00:00.000Z", "deleted_at": null, "origin_device_id": "a1d2…" } },
    { "table": "parts", "row": { "id": "5f0c…:engine_oil", "user_id": "b31e…", "car_id": "5f0c…", "category_id": "engine", "template_code": "engine_oil", "name": "Engine oil", "interval_type": "both", "distance_km": 10000, "months": 12, "inspection_months": null, "include_in_reminders": 1, "hidden_by": null, "sort_order": 1, "created_at": "2026-11-01T09:00:00.000Z", "updated_at": "2026-11-01T09:00:00.000Z", "deleted_at": null, "origin_device_id": "a1d2…" } }
  ]
}
```

| Rule | Detail |
|---|---|
| Batch | One call per pass with the whole dirty set; no paging and no chunking (document 06 §7.5) |
| Order | Parent-first: `users`, `user_settings`, `cars`, `categories`, `parts`, `odometer_entries`, `service_records` |
| Empty batch | No call at all; the pass goes straight to the pull |
| Table whitelist | Exactly those seven; reference rows (`part_templates`, system categories) are never sent (D-47) |
| Row completeness | Every column of that table except `sync_seq`, which the server owns (§4.3) |

Parent-first ordering is a courtesy, not a requirement: the function runs in one transaction with deferred foreign keys, so a batch in the wrong order still commits or rolls back as a whole (document 07 §5.2). The client keeps the order anyway, because the log of a failed batch is readable only if it is deterministic.

**The `users` row is the exception to "rows are written by a feature".** It is created by the auth service on first sign-in (`id = auth.uid()`, `email` from the session) and pushed like any other row. The email stays in the payload — and in the pull — because Settings must show the account when the session is expired, which is exactly the state D-28 allows the app to run in.

### 4.2 Response

```json
{
  "applied": ["5f0c…", "5f0c…:engine_oil"],
  "rejected": [],
  "server_now": "2026-11-01T09:00:02.417Z"
}
```

| Field | Type | Meaning |
|---|---|---|
| `applied` | array of string | Row keys written this call; `sync_seq` was stamped on each |
| `rejected` | array of string | Row keys not written; the cloud version won the predicate, or the row is not the caller's |
| `server_now` | string | Server clock at commit; the input to the offset in §8 |

The **row key** is the table's primary key: `id` everywhere except `user_settings`, where it is `user_id`. A key appears in exactly one of the two arrays, never in both.

**`rejected` is not an error.** It has two causes that look identical in the body and are told apart by what follows:

1. The cloud already holds the same or a newer version. The pull that runs next returns that version, the local row is overwritten (or kept, if it wins — D-88), and the dirty entry clears. This is the ordinary conflict path (D-35, D-70).
2. The row carries a `user_id` that is not the caller's. The pull will never return it, so the row stays dirty and the engine stops retrying and blocks (document 06 §7.5 step 9).

Adding a reason field to the body would let the client tell them apart one round trip earlier, but it would duplicate a decision the pull already makes from the data itself, and it would put a security signal in a field a confused client could ignore. The pull stays the arbiter.

### 4.3 Server behaviour

1. **Whitelist** the table name and the column set; reject the whole call otherwise (§6.2). Statements are built with `format('%I')` from schema identifiers, never from client text.
2. **Ownership**: `user_id := auth.uid()::text`; a row whose `user_id` differs, or is null, is `rejected` — never rewritten to the caller's id, because rewriting would move another account's row into the caller's data. The `users` row has no `user_id` column, so there the check is `id = auth.uid()::text`.
3. **Merge and stamp**: one conditional upsert per row, parent-first, stamping `sync_seq = nextval('sync_seq_seq')` only when the row is written.
4. **Return** the keys the statements returned as `applied`; everything else is `rejected`.

The function is `security definer` with `set search_path = public, pg_temp`, because clients have no write grant at all (D-60). That elevation is why step 2 is mandatory: inside the function, row-level security is not protecting anything.

### 4.4 Idempotence

Replaying a batch is a no-op (NFR-012). A row applied once and pushed again comes back in `rejected`, because `excluded.updated_at > stored.updated_at` is false for an equal timestamp and equal device id. That is expected: the earlier call already cleared the dirty entry, so the replay changes nothing locally either. A crash between commit and acknowledgement therefore costs one redundant call, never a duplicate row.

---

## 5. `pull_rows`

### 5.1 Request

```json
{ "p_cursor": 41 }
```

`p_cursor` is `max_seq` from the previous successful pull, `0` on a device that has never synced (document 07 §9).

### 5.2 Response

```json
{
  "rows": [
    { "table": "cars", "row": { "id": "5f0c…", "user_id": "b31e…", "name": "Golf", "fuel_type": "diesel", "timing_drive": "belt", "gearbox": "manual", "has_dpf": 1, "created_at": "2026-11-01T09:00:00.000Z", "updated_at": "2026-11-01T09:00:00.000Z", "deleted_at": null, "origin_device_id": "a1d2…" } },
    { "table": "parts", "row": { "id": "5f0c…:engine_oil", "...": "the remaining columns" } }
  ],
  "max_seq": 47,
  "schema_version": 7,
  "server_now": "2026-11-01T09:01:12.005Z"
}
```

| Field | Type | Meaning |
|---|---|---|
| `rows` | array of `{table, row}` | Every row of the caller's with `sync_seq > p_cursor`, parent-first, then `sync_seq` ascending, then `id` |
| `max_seq` | integer | `GREATEST(p_cursor, MAX(sync_seq))` over the caller's rows; the next cursor |
| `schema_version` | integer | `MAX(version)` from `schema_migrations` (§7) |
| `server_now` | string | Server clock at commit; the input to the offset in §8 |

`max_seq` is defined as a greatest-of rather than a bare maximum so that an empty delta still returns an integer, the client always writes what it receives, and a device with no changes cannot accidentally move its cursor backwards. An empty `rows` array with `max_seq` equal to the cursor is the normal steady state, not an error.

Deletions travel as ordinary rows with `deleted_at` set; there is no separate tombstone list (BR-19). `sync_seq` is never part of a row: it is the cursor's business, and a device has no column for it.

### 5.3 No paging

One call returns the whole delta. Document 07 §12 bounds the dataset at about 1,200 rows and well under 5 MB; document 06 §7.9 forbids a resumable batch. Paging by `sync_seq` was rejected because a parent updated after its child can move past a page boundary and leave the child without its parent in the same batch. If a response ever exceeds the platform's body limit, that is a capacity defect, not a reason to add pages.

### 5.4 What the client does with it

The engine applies the response in one local transaction, parent-first, with deferred foreign keys, using the same predicate as the cloud; it writes `max_seq` as the cursor in that same transaction; then it rebuilds notifications (document 06 AF-07). None of that ordering is the API's; it is listed here only so the response fields have exactly one consumer each.

---

## 6. Errors

### 6.1 Three layers of failure

| Layer | Example | Reaches the app as |
|---|---|---|
| No response | Flight mode, DNS, TLS, 15 s timeout | `NETWORK_UNAVAILABLE`, `REQUEST_TIMEOUT` |
| PostgREST | `401`, `403`, `404`, `429`, `5xx`, non-JSON body | A code from §6.4 |
| PostgreSQL | `raise exception` in the function, or a constraint | A code from §6.5 |

PostgREST answers with `{ "code": …, "message": …, "details": …, "hint": … }`. **None of those four strings ever reaches a screen** (D-93). They can contain SQL, table names and hints; the adapter maps `code` and the HTTP status to the app's enum, logs the raw body locally, and returns the enum member. That keeps NFR-070 honest — one i18n key per code — and keeps a server message from becoming an accidental part of the UI.

### 6.2 Call-level versus row-level

| Outcome | Scope | Shape |
|---|---|---|
| Row rejected | One row | Listed in `rejected`; the call succeeded |
| Call failed | Whole batch | HTTP 4xx/5xx with an error body; nothing was written |
| Response invalid | Whole batch | The client rejects a body that does not match §4.2 or §5.2 |

A malformed body, an unknown table, an unknown column, a wrong parameter type or a failed constraint is a **call-level** failure: the transaction rolled back and the app must not retry it unchanged. A row that loses the merge predicate or does not belong to the caller is **row-level**: retrying the call would be pointless, and the pull resolves it.

### 6.3 Codes produced by this surface

| Code | Raised when | Class (document 06 §7.7) | Retry |
|---|---|---|---|
| `NETWORK_UNAVAILABLE` | The request never got a response | Offline | On network regain |
| `REQUEST_TIMEOUT` | The 15 s timer fired | Sync, retryable | Backoff |
| `SERVER_UNAVAILABLE` | `5xx`, a non-JSON body, or a paused project | Sync, retryable | Backoff |
| `RATE_LIMITED` | `429` | Sync, retryable | Backoff |
| `SESSION_EXPIRED` | `401`, or `PGRST301` from PostgREST | Session | One refresh per foreground |
| `FORBIDDEN` | `403`, SQLSTATE `42501` | Data | Blocked |
| `CLOUD_SCHEMA_NEWER` | Handshake: cloud version above the app's | Update required | Blocked until a new build |
| `CLOUD_SCHEMA_OLDER` | Handshake: cloud version below the app's | Data (release error) | Blocked |
| `INVALID_PAYLOAD` | Unknown table or column, malformed JSON, wrong type, `404`, `413` | Programming | Blocked |
| `CONSTRAINT_VIOLATION` | Any `23xxx`, plus `22P02`, `42P01`, `42703` | Data | Blocked |
| `DB_UNAVAILABLE` | `53300`, `57P03`, `08006`, connection lost mid-call | Sync, retryable | Backoff |
| `RESPONSE_INVALID` | The client's own shape check on the body | Programming | Blocked |
| `PUSH_REJECTED_UNRECONCILED` | A key still in `rejected` and still dirty after the pull | Data | Blocked |

`STORAGE_FULL`, `SQLITE_BUSY`, `ODOMETER_DECREASE` and the other field codes are local members of the same enum (D-93); this surface never produces them. One enum, one UI mapping table, whatever the origin.

### 6.4 HTTP and SQLSTATE mapping

| Status / SQLSTATE | Code |
|---|---|
| `401`, `PGRST301` | `SESSION_EXPIRED` |
| `403`, `42501` | `FORBIDDEN` |
| `404` | `INVALID_PAYLOAD` |
| `408` | `REQUEST_TIMEOUT` |
| `413` | `INVALID_PAYLOAD` |
| `429` | `RATE_LIMITED` |
| `500`–`599`, any non-JSON body | `SERVER_UNAVAILABLE` |
| `22007`, `22P02`, `23502`, `23503`, `23505`, `23514`, `42P01`, `42703` | `CONSTRAINT_VIOLATION` (a missing table or column is a schema mismatch that survived the handshake) |
| `53100`, `53300`, `53400`, `57P03`, `08000`, `08006` | `DB_UNAVAILABLE` |
| `57014` | `REQUEST_TIMEOUT` |
| Anything else | `SERVER_UNAVAILABLE`; logged with the raw status |

The default is deliberate: an unclassified failure is retried, not blocked. A wrong retry costs a little traffic; a wrong block costs the owner their sync.

### 6.5 Retry policy, in one place

Only `NETWORK_UNAVAILABLE`, `REQUEST_TIMEOUT`, `SERVER_UNAVAILABLE`, `RATE_LIMITED`, `SESSION_EXPIRED` (via refresh) and `DB_UNAVAILABLE` are retried. Everything else is deterministic: the engine stops, keeps the cursor, and shows one banner (document 06 §10.2). Retries use the single backoff of document 06 §7.4 — 2 s doubling to 60 s, reset on success, foreground or network regain — so a `429` cannot produce a faster loop than a network error.

---

## 7. Schema handshake

| Item | Rule |
|---|---|
| Source of truth | `MAX(version)` from `schema_migrations` in the cloud, returned as `schema_version` |
| Stored at | `local_meta.cloud_schema_version` after every successful pull |
| Compared | Before each pass, against the app's bundled schema version |
| Equal | Sync proceeds |
| Cloud newer | `CLOUD_SCHEMA_NEWER`: sync refused, banner "update the app", local reads and writes continue, no retries until the next cold start (D-81) |
| Cloud older | `CLOUD_SCHEMA_OLDER`: sync refused and logged as a release error — a migration shipped after its build |
| Unknown (`NULL`) | Treated as matching for this pass; the pull that follows sets it. It happens only on a device that has never pulled, where the batch is empty |
| Environment variable | None: the version is data, not configuration |

The handshake is client-side. The server does not refuse an outdated client, because doing so would need the client's version in the push payload — a parameter that exists only to say no. The database constraints and the push rules protect the data; the handshake protects the owner from a confusing failure. A modified client that skips it gains nothing.

Cloud migrations stay backward compatible with the previous app release for one version (D-73, document 07 §10), which is what makes the "cloud newer" window survivable until the owner installs the new build.

---

## 8. Clock

| Item | Rule |
|---|---|
| `server_now` | Present in both responses; the only trusted time |
| Offset | `clock_offset_ms = server_now − device_now`, recomputed after every successful call, push or pull, and applied only when the absolute skew is over two minutes |
| `updated_at` | Always `Clock.now() = deviceNow + clock_offset_ms`, 24-character form (§2) |
| Monotonicity | `Clock.now()` never returns a value less than or equal to the previous one; a call inside the same millisecond is bumped by 1 ms |
| Future guard | A row more than 24 hours ahead of `server_now` is restamped before it is sent, locally too, so the two never disagree |
| Local dates | Never derived from `server_now`; `LocalDate.today()` reads the device clock (D-61) |

The monotonic guard is what keeps three-digit milliseconds safe: without it, two writes to the same row in one millisecond would tie on `updated_at` *and* on `origin_device_id`, and the merge predicate would have no way to order them. With it, the timestamp is unique per device by construction, and the tie-break is only ever asked to separate two different devices.

The clock is the only place where a remote value changes a local one without a row being written, which is why it is defined here rather than in the engine: it is a consequence of the response shape, not of the state machine. Rejected alternative, again: stamping `updated_at` on the server would make an offline Saturday edit lose to a Wednesday edit synced later; that is "last to sync wins", not "latest change wins" (D-35).

---

## 9. Notification payloads and deep links

A notification is an OS record, not an API response, but it carries the same rules: ids and a kind, never text, names or amounts (D-90).

| Field | Type | Present | Meaning |
|---|---|---|---|
| `v` | integer | always | Payload version, `1` in Release 1 |
| `kind` | string | always | `reminder`, `part-alert`, `paused` |
| `partId` | string | `part-alert` only | The `parts.id`, which already contains the car id |

| Link | Destination |
|---|---|
| `carmaint://mileage` | Mileage entry (FR-084) |
| `carmaint://part/<encodeURIComponent(partId)>` | Part detail |

The grammar is frozen in document 06 AF-10 and D-90; this document adds only the payload fields and states the encoding rule, because `parts.id` is `carId:templateCode` and a raw `:` in a URL path segment is legal but ambiguous once a parser is involved. A payload with an unknown `kind`, a missing `partId`, or a link that does not parse falls back to the home screen and is logged; it never opens an empty screen. Document 04 owns what the destination screens contain.

Three kinds, not four: permission is a screen state, never an OS record, so it carries no payload. The `v` field exists because a scheduled notification outlives the build that created it — a notification scheduled on Monday is read by whatever version runs on Friday — and the parser needs to know which shape it is reading.

---

## 10. Contract tests

The scenario list is small enough to run against the real functions in CI, on the Supabase CLI stack, next to the in-memory fake (D-66, D-85). Each line is one assertion of this document, not of the UI:

1. A batch spanning all seven tables applies in one call and returns every key in `applied`.
2. A replayed batch returns the same keys in `rejected` and changes no `sync_seq`.
3. A batch whose car loses the predicate returns that key in `rejected`, and the following pull returns the winning version.
4. A row with another account's `user_id` is `rejected`; the pull does not reconcile it; the engine blocks.
5. A batch with an unknown table or column returns `INVALID_PAYLOAD` and writes nothing.
6. A row violating a `CHECK` returns `CONSTRAINT_VIOLATION` and rolls the whole call back.
7. `pull_rows(0)` on a second account returns only that account's rows, never the first's (two-account RLS test, D-66).
8. An empty delta returns `rows: []` with `max_seq` equal to the cursor.
9. `schema_version` changes after a migration and the app refuses to sync with `CLOUD_SCHEMA_NEWER`.
10. A `401` produces `SESSION_EXPIRED` and no partial write; a `429` and a `503` produce `RATE_LIMITED` and `SERVER_UNAVAILABLE`.
11. A tampered response (a row missing a column, a timestamp in the wrong shape) produces `RESPONSE_INVALID`, not a partial apply.

Items 3–6 and 11 are the ones a fake cannot prove; they are the reason the suite runs against the real functions.

---

## 11. Traceability

| Requirement | Where addressed |
|---|---|
| FR-101 | §1 (both endpoints), §4.1, §5.3 |
| FR-102 | §4.3 step 2, §5.2 (invoker under RLS) |
| FR-103 | §4.3 step 3, §4.4, §5.2 |
| FR-104 | §5.2, §5.4 |
| FR-105 | §6.3 (codes feed the badge) |
| FR-106 | §2, §4.1 (envelope travels with every row) |
| NFR-012 | §4.4 |
| NFR-020 | §3 |
| NFR-021 | §4.3 step 2, §5.2 |
| NFR-022, NFR-024 | §3 |
| NFR-023 | §3, §9 (payload carries no secrets) |
| NFR-070 | §6.1, §9 |
| C-03 | §1, §3 |
| D-35, D-70, D-86, D-88 | §4.2, §4.4, §5.2 |
| D-58, D-59, D-60 | §1, §4.3, §5.2 |
| D-61 | §8 |
| D-81 | §7 |
| D-89 | §4.3 step 2, §5.2 (composite keys make a cross-owner row fail) |
| D-90 | §9 |
| D-93 | §6.1, §6.3 |

---

## 12. Decisions

### 12.1 Decisions

Approved 2026-11-01. `API-01` to `API-13` map in order onto README `D-94` to `D-106`.

| ID | Decision |
|---|---|
| API-01 | The cloud API is exactly two RPC functions, `push_rows` and `pull_rows`, both `POST /rest/v1/rpc/<name>` with an anonymous key and a bearer token. No table endpoint is used by the app; authentication is Supabase Auth's own surface and belongs to `src/auth`. |
| API-02 | A row travels as its complete column set except `sync_seq`: explicit nulls, flags as `0`/`1`, unknown keys rejected. The server never receives a sparse row and never guesses a missing column. |
| API-03 | Every timestamp is fixed-width UTC `YYYY-MM-DDTHH:MM:SS.sssZ`; local dates stay `YYYY-MM-DD`. The text comparison in the merge predicate depends on this and nothing else may produce a timestamp. |
| API-04 | `push_rows` takes a parent-first array of `{table, row}` over seven whitelisted tables and returns `{applied, rejected, server_now}`. `rejected` means "not written" and covers both a lost merge predicate and a row the caller does not own; the following pull tells them apart, so the body needs no reason field. |
| API-05 | `pull_rows` takes only the cursor and returns `{rows, max_seq, schema_version, server_now}`. `max_seq` is `GREATEST(p_cursor, MAX(sync_seq))`, rows are parent-first then `sync_seq` then `id`, and `sync_seq` never appears inside a row. |
| API-06 | The pull is not paged and no batch is resumable: one call returns the whole delta, bounded by the capacity of document 07 §12. A response over the platform limit is a capacity defect, not a paging requirement. |
| API-07 | The schema handshake is client-side, from `schema_version` in the pull response stored in `local_meta.cloud_schema_version`, checked before each pass. An unknown version is treated as matching for that pass, because it can only occur where the batch is empty. |
| API-08 | Server error text never reaches the UI. The adapter maps the HTTP status and SQLSTATE onto the app's typed codes, logs the raw body locally, and returns only the enum member. |
| API-09 | Retryability belongs to the code, not the status: network, timeout, `5xx`, `429`, session and database-unavailable retry; every other failure is deterministic and blocks. An unknown status is retried, never blocked. |
| API-10 | The adapter never refreshes a token: on `401` it reports `SESSION_EXPIRED` and stops, and the auth service refreshes at most once per foreground. A 15 s per-request timeout applies to both functions. |
| API-11 | A notification payload is `{v, kind, partId?}` only; the link is `carmaint://mileage` or `carmaint://part/<encodeURIComponent(partId)>` (D-90). Unknown kind, missing id or unparsable link falls back to the home screen and is logged. |
| API-12 | A response the client cannot validate is `RESPONSE_INVALID`: nothing is applied, the cursor stays, the pass blocks and logs. A partly valid body is never partly applied. |
| API-13 | `Clock.now()` is monotonic: it never returns a value equal to or below the previous one, and bumps by 1 ms on a tie. `clock_offset_ms` is recomputed from the freshest `server_now` of either response. Three-digit milliseconds stay, because the guard makes a same-device tie impossible and the D-35 tie-break is then only asked to separate two devices. |

### 12.2 Open questions

| ID | Question | Decide in |
|---|---|---|
| OQ-18 | Should the client keep `select` on the synced tables, given that `pull_rows` is security-invoker and needs it, or should the grant be revoked and `pull_rows` become security-definer with an explicit `user_id` filter? The first keeps RLS as the only boundary; the second shrinks the surface but moves the ownership check into the function, where a mistake leaks every row. | Security (09) |

No other new question is raised. OQ-15 to OQ-17 remain owned by documents 11, the owner and 12.

---

## 13. Follow-ups

| Document | Point |
|---|---|
| 07 Database | Record in §5.2 that `sync_seq` is excluded from both payloads and that `pull_rows` returns `GREATEST(cursor, MAX(sync_seq))`; both are currently implied. |
| 06 Architecture | §7.5 step 3 can cite API-04 for what `rejected` means; no behaviour changes. |
| 09 Security | OQ-18, plus the token and anonymous-key handling of §3 and the logging rule of §6.1. |
| 04 UI/UX | The two destinations of §9 and the copy for the blocked banner; the grammar is already frozen. |
| 11 Testing | Turn §10 into the contract suite and add the `429`, paused-project and tampered-response cases. |
| 12 Deployment | Key rotation and the runbook for a paused project, both of which surface as `SERVER_UNAVAILABLE`. |

---

## 14. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First version: the two-function surface, request and response shapes, wire conventions (timestamps, flags, nulls), authentication rules, the row-level versus call-level split, the typed error vocabulary and its HTTP/SQLSTATE mapping, the client-side schema handshake, the clock contract, notification payloads and the deep-link encoding, the contract-test scenario list, API-01 to API-12 and OQ-18. |
| 0.2 | 2026-11-01 | Revision after an owner grilling round. The monotonic clock guard and the offset from either response are now API-13, so three-digit milliseconds are safe and the push response's `server_now` is no longer dead weight. The notification `kind` enum drops `permission`, which is a screen state and never an OS record. Kept as reviewed: `rejected` stays a bare key list (the pull is the arbiter), one call and one transaction per pass, a client-side handshake, retry on an unclassified failure, server-side response ordering, `max_seq` as a greatest-of, and the synced `users.email`. |
| 0.3 | 2026-11-01 | Approved: API-01 to API-13 promoted to D-94 to D-106. No content change. |
