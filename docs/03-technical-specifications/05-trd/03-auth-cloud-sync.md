# TRD · Authentication, cloud schema, synchronization mechanics

> Part of [05-trd.md](../05-trd.md). Sections: §8, §9, §10. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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
