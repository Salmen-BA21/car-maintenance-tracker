# API · Surface, conventions, authentication and transport

> Part of [08-api-specification.md](../08-api-specification.md). Sections: §1, §2, §3. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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
