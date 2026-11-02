# API · Errors, schema handshake, clock, notification payloads

> Part of [08-api-specification.md](../08-api-specification.md). Sections: §6, §7, §8, §9. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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
