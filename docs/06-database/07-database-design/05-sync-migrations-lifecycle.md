# DBD · Sync contract, migrations, data lifecycle, capacity

> Part of [07-database-design.md](../07-database-design.md). Sections: §9, §10, §11, §12. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 9. Synchronization contract

| Topic | Rule |
|---|---|
| Scope | One user's rows only. Isolation is enforced by row-level security in PostgreSQL (`user_id = auth.uid()::text`), not by `WHERE user_id = ?` in the app (FR-102, NFR-021, DB-22). |
| Synced tables | `users`, `user_settings`, `cars`, custom `categories`, `parts`, `odometer_entries`, `service_records`. |
| Reference data | `part_templates` and system categories are never synced; the same idempotent seed migration runs on every database, device and cloud, so the rows are identical everywhere and no conflict can exist (DB-15). In the shared cloud database the system rows are readable by every authenticated user and writable by none (§5.2). |
| Duplicate defaults | Two devices that create default parts offline produce the same `parts.id`, so the merge updates one row instead of inserting two (DB-16). |
| Unit of sync | The row. A pull applies tables parent-first (`users`, `user_settings`, `cars`, `categories`, `parts`, `odometer_entries`, `service_records`) inside one transaction, with `PRAGMA defer_foreign_keys = ON` so an out-of-order batch still commits or rolls back as a whole; the cloud side uses `DEFERRABLE` keys for the same reason. |
| Cursor | The pull cursor is the greatest applied `sync_seq`. It is never `updated_at`, because a device that was offline can push rows older than what another device already pulled past (DB-23). |
| Push | One `push_rows` call per batch, one transaction, conditional upserts. The function is the only cloud writer; clients have no insert, update or delete grant (DB-24). |
| Pull | One `pull_rows` call returns every row above the cursor for the caller, with no paging. The client applies it parent-first, stores the returned `max_seq` as its new cursor in the same transaction, then rebuilds notifications and records `notifications_built_for`. |
| Conflict | Highest `updated_at` wins. If two versions carry the same `updated_at`, the lexicographically greater `origin_device_id` wins (DB-03). A losing local row that is still queued stays dirty and is pushed next pass; a pulled row that lost the comparison against the local row is not applied (AR-15). The losers are listed in `local_meta.conflicts_pending` for the next home-screen notice, and the list is never capped (DB-27). |
| Deletion | `deleted_at` is set; the row ships like any other and disappears from reads (BR-19). |
| Replay | Applying the same batch twice is a no-op: a row is written only when the incoming `(updated_at, origin_device_id)` is greater than the stored one. |
| Child deletion | Deleting a custom part soft-deletes the part in one local transaction. Its service records remain available for history and export, so the exported rows remain referentially complete (FR-035, AC-17). |
| Local date fields | Never converted. `entry_date` and `service_date` are calendar dates the owner typed (D-29). |
| Current odometer | Recomputed as `MAX(value_km)` after every pull, never merged as a scalar (DB-18). |
| Tombstone retention | Kept indefinitely in Release 1. Purging requires tracking every device's last-pull position; it is deferred until there is more than one active device or the store requires it. |

The app never blocks a local read or write on a valid token (D-28, BR-17). Sync bookkeeping (cursors, last pull) belongs to the sync adapter and is not stored in these tables.

---

## 10. Migrations

| Rule | Detail |
|---|---|
| Versioning | Numbered, forward-only files `NNNN_description.sql`; applied in order inside one transaction. |
| Tracking | `schema_migrations.version` (NFR-080). |
| Schema migrations | Device: applied by the app's runner. Cloud: applied by the operator with the Supabase CLI, never by the app (DB-25). |
| Compatibility | A cloud migration stays backward compatible with the previous app release for one version, because a sideloaded client can lag by up to the re-signing cycle. |
| Location | Device modules live with the app code; cloud files live in `supabase/migrations`. Both are forward-only and share the same numbering. |
| Seed migrations | Run on every database (device and per-user cloud), never on the sync path. They populate `categories` (system rows) and `part_templates`, and are idempotent: `ON CONFLICT(id) DO UPDATE` for system categories (their `id` is the code) and `ON CONFLICT(code) DO UPDATE` for templates (DB-15). |
| Existing parts | A changed template interval affects new cars only; an existing part keeps the interval the owner has (BR-14). |
| Downgrade | Not supported. Restore from backup. |

Retiring a template is a local seed change: set `retired_at`, keep the row so existing parts still resolve their `template_code`. The row stops being offered for new cars.

---

## 11. Data lifecycle

| Action | Effect |
|---|---|
| Hide a default part (owner) | `parts.hidden_by = 'user'`; history untouched (FR-035). |
| Hide a default part (profile change) | `parts.hidden_by = 'profile'` only where it is `NULL`; a part the owner hid keeps `'user'`; history untouched (FR-011, BR-13, D-34). |
| Change the profile back | Clear `hidden_by` only on rows set to `'profile'`; parts the owner hid stay hidden (OQ-07). |
| Re-add a hidden default part | Clear `hidden_by`; history returns with it (FR-036). Idempotent because the ID is deterministic. |
| Delete a custom part | Soft-delete the part and its service records in one transaction (FR-035). |
| Edit or delete a service record | Soft delete or in-place update; the active record is recomputed (FR-054, AC-18). |
| "All serviced today" | One baseline service record per part, km = current odometer, date = today (FR-062). For a condition-based part this also resets its inspection anchor (DB-20). |
| Export (Release 2) | JSON: one array per table filtered by `user_id`, envelope included; system reference rows are excluded because they are reseeded on restore. CSV: one file per table, dates as stored, money as `amount` + `currency` (FR-120). |
| Delete account (Release 2) | Operator step with the service-role key: delete the `auth.users` row and the user's rows in the cloud, then wipe the local database and sign out. The app cannot do it because clients hold no delete grant (FR-140, D-71). |
| Reset app data | Local wipe; the next sign-in restores from the cloud (FR-104). |

This implements D-34 (which closed OQ-07): the profile and the owner are recorded separately, so restoring a profile returns exactly the parts that profile took away, while a part the owner deliberately hid stays hidden. Re-adding any hidden part restores its history because the history was never deleted.

---

## 12. Capacity and performance

| Figure | Assumption | Consequence |
|---|---|---|
| Parts per car | Up to 17 defaults + a few custom, 100 is the design limit (NFR-002) | Home screen is one query plus in-memory status work |
| Odometer entries | 2 per month for 20 years = 480 | Index-only scan for the maximum |
| Service records | 17 parts × 2 per year × 20 years ≈ 680 | History is per part and indexed |
| Database size | Well under 5 MB | Backup and export are trivial |

Every read used by the home screen, the part detail, and the needs-attention list touches an index from §4 and returns at most 100 rows, so NFR-002 (500 ms after an odometer update) is met by the schema without caching.
