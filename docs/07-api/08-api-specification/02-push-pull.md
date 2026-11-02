# API · push_rows and pull_rows

> Part of [08-api-specification.md](../08-api-specification.md). Sections: §4, §5. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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

**The `users` row is the exception to "rows are written by a feature".** It is created only when the owner confirms a claim of an empty cloud account (`id = auth.uid()`, `email` from the session), then pushed with the complete profile. The email stays in the payload — and in the pull — because Settings must show the linked account when its session is expired.

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
