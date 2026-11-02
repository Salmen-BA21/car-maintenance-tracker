# DBD · Physical settings, device PRAGMAs, cloud notes (DDL in schema/cloud.sql)

> Part of [07-database-design.md](../07-database-design.md). Sections: §5. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 5. Physical settings

### 5.1 Device (SQLite)

| Setting | Value | Reason |
|---|---|---|
| `PRAGMA foreign_keys` | `ON` | References are real; sync writes rely on them being satisfiable |
| `PRAGMA journal_mode` | `WAL` | Concurrent reads during a write (NFR-001) |
| `PRAGMA busy_timeout` | `5000` | Avoid spurious failures during notification rebuild |
| Value storage | TEXT / INTEGER only | No `REAL` anywhere, so no float drift |

The DDL above is SQLite. `GLOB` and the `date()` check are the two constructs that do not survive translation.

### 5.2 Cloud (PostgreSQL)

Supabase was selected on 2026-11-01 (D-03 amended), so the cloud is PostgreSQL and the schema below is authoritative for it. It is the same model as §4, with four differences:

| Difference | Rule |
|---|---|
| Isolation | One shared database. Every synced table carries `user_id` plus a row-level security policy `user_id = auth.uid()::text` (DB-22). No per-user databases. |
| Ordering | Every synced row carries `sync_seq bigint` from one global sequence. It is the pull cursor; `updated_at` is never one (DB-23). |
| Write surface | Clients hold `select` only. All writes go through `push_rows`, all reads through `pull_rows` (DB-24). |
| Calendar dates | Native `date` columns instead of `text`. PostgreSQL validates leap days without a check, and JSON still serializes them as `YYYY-MM-DD`, so D-29 holds. Keys and timestamps stay `text`. |

Ids stay `text` (D-40); writing `user_id = auth.uid()::text` keeps that rule without changing a column type. Foreign keys are `DEFERRABLE INITIALLY DEFERRED` so a pull applies parent-first in one transaction regardless of row order.

> Cloud DDL block 1: see [`schema/cloud.sql`](../../schema/cloud.sql) (part 1).

Every index of §4 is recreated unchanged, plus one per synced table for the pull:

> Cloud DDL block 2: see [`schema/cloud.sql`](../../schema/cloud.sql) (part 2).

**Isolation and write surface.** RLS is on for every table. Reference rows are readable by all authenticated users and writable by none; `users` is scoped to its own id.

> Cloud DDL block 3: see [`schema/cloud.sql`](../../schema/cloud.sql) (part 3).

**The two functions.** These are the whole cloud write and read surface (DB-24). Their bodies live in `supabase/migrations`, with the code.

| Function | Mode | Input | Output |
|---|---|---|---|
| `push_rows(p_rows jsonb)` | `security definer`, `set search_path = public, pg_temp` | array of `{table, row}`, parent tables first | `{applied: [id], rejected: [id], server_now}` |
| `pull_rows(p_cursor bigint)` | invoker, so RLS scopes the read | last cursor | `{rows: [{table, row}], max_seq, server_now, schema_version}` |

`push_rows` rules, all in one transaction:

1. Whitelist the seven table names; build every statement with `format('%I')`, never with client text.
2. Set `user_id` from `auth.uid()::text` and reject any row that carries a different value. **This check is the security boundary**: the function runs as definer and therefore bypasses RLS.
3. Upsert conditionally, stamping `sync_seq = nextval('sync_seq_seq')` only when the row is applied:

> Cloud DDL block 4: see [`schema/cloud.sql`](../../schema/cloud.sql) (part 4).

4. Return the ids the statement actually returned as `applied`; everything else is `rejected`. Replay is a no-op because a rejected row changes nothing and a repeated applied row fails the predicate.

`pull_rows` returns every row with `sync_seq > p_cursor` for the caller, across the seven tables, with no paging: the whole dataset is about 1,200 rows (see §12), and paging by `sync_seq` breaks when a parent is updated past a page boundary. `schema_version` is `max(version)` from `schema_migrations`.

Device reference rows and cloud reference rows are both seeded by their own migration (DB-15), so they never sync and never conflict.
