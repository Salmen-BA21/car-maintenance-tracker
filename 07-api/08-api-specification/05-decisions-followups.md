# API · Decisions, open questions, follow-ups (rationale)

> Part of [08-api-specification.md](../08-api-specification.md). Sections: §12, §13. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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

## 13.1 Account-claim amendment

`push_rows` and `pull_rows` remain the only API. An unlinked or signed-out local profile makes neither call. After authentication, the coordinator first calls `pull_rows(0)` before it creates or pushes a public `users` row. An empty result identifies an account that may receive the confirmed, complete parent-first initial upload in one `push_rows` transaction. Any returned profile rows identify an existing cloud profile; the app stages and validates them before local replacement, or cancels and clears the session. `profile_state` and export data never travel over this API.
