# DBD · Schema decisions DB-01..27, open questions, ownership amendment (rationale)

> Part of [07-database-design.md](../07-database-design.md). Sections: §14. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 14. Decisions and open questions

### 14.1 Confirmed schema decisions

Approved by the owner on 2026-11-01. The README register is authoritative; the `DB-xx` column is the label used in this document. **DB-22 to DB-24 restate D-58 to D-60**, and DB-25 is D-73: they were added in v0.4 after the move to Supabase.

| DB | Decision | README |
|---|---|---|
| DB-01 | Status is derived on read; no status column. | D-33 |
| DB-02 | Hiding records its cause (`user` or `profile`); restoring a profile returns only profile-hidden parts, re-adding restores history. | D-34 |
| DB-03 | Conflict order is `updated_at`, then `origin_device_id`. | D-35 |
| DB-04 | `user_id` is stored on every user-owned table, including on per-user cloud databases. | D-36 |
| DB-05 | Template values are copied into parts and never re-applied. | D-37 |
| DB-06 | Cost is stored as integer minor units plus an ISO-4217 currency code. | D-38 |
| DB-07 | Cross-row validity is enforced by the write path, never by triggers. | D-39 |
| DB-08 | Primary keys are UUID v4 stored as `TEXT`. Exceptions: `users.id` is the provider subject, system rows use their code, template parts use `carId:templateCode`. | D-40 |
| DB-09 | The current odometer is never stored; it is `MAX(value_km)`, before and after a merge. | D-41 |
| DB-10 | Date-unknown service records rank after dated records when choosing the active record. | D-42 |
| DB-11 | Replacements and inspections share `service_records`, separated by `kind`. | D-43 |
| DB-12 | System categories are rows with `user_id IS NULL`; custom categories carry a `user_id`. | D-44 |
| DB-13 | "Set interval" means any required interval value is missing: `distance_km` for distance and both, `months` for time and both. | D-45 |
| DB-14 | Release 2 and 3 settings (distance unit, locale, warn-earlier thresholds) are added by migration, not pre-created. | D-46 |
| DB-15 | Reference tables are local: seeded by migration on every database, never synced. Only custom categories sync. | D-47 |
| DB-16 | A template-derived part's ID is `carId:templateCode`, enforced by a check, so concurrent offline creation converges. | D-48 |
| DB-17 | The per-part reminder flag is `include_in_reminders`, valid for every part type; separate alerts still need a time interval. | D-49 |
| DB-18 | Odometer order is value, then date, then creation time; "updated today" means a live entry dated today; edit and delete are blocked if a live service record would sit above the result. | D-50 |
| DB-19 | A replacement requires km and date; only a baseline record may omit either, and never both. | D-51 |
| DB-20 | Inspection due counts from the latest of the last inspection, the last service record, and part creation. | D-52 |
| DB-21 | The Due soon time threshold is `min(30, half the days between service date and due date)`. | D-53 |
| DB-22 | The cloud is one shared PostgreSQL database. Isolation is row-level security, `user_id = auth.uid()::text`; there are no per-user databases. | D-58 (implements D-03 amended, NFR-021) |
| DB-23 | Every synced row carries `sync_seq` from one global sequence, and the pull cursor is `sync_seq`. No `sync_log` table. | D-59 |
| DB-24 | Clients hold `select` only; `push_rows` and `pull_rows` are the entire write and read surface. | D-60 |
| DB-25 | Cloud migrations are applied by the operator with the Supabase CLI, never by the app, and stay backward compatible for one app release. | D-73 |
| DB-26 | Child tables reference their parent by `(parent_id, user_id)` against `UNIQUE (id, user_id)` on `cars` and `parts`. An orphan or a cross-owner reference therefore fails the transaction and holds the cursor instead of being repaired. `parts.category_id` stays a plain key because system categories have no `user_id`. | D-89 (implements AR-16) |
| DB-27 | The conflict notice payload is the whole list of `{table, id, label}` in `local_meta.conflicts_pending`, never a counter and never capped; the screen truncates the display. `local_meta.notifications_built_for` stores the date of the last rebuild. | D-86 (implements AR-13) |

### 14.2 Open questions

| ID | Question | Owner document |
|---|---|---|
| OQ-06 | Closed: see D-33. | Closed |
| OQ-07 | Closed: see D-34. | Closed |
| OQ-01 | Closed: Supabase selected (D-03, D-58). The logical schema is unchanged; §5.2 holds the PostgreSQL DDL, and isolation is row-level security rather than a per-user database. | Closed |
| OQ-11 | Should a custom category with live parts block deletion, or move its parts to "Uncategorized"? Proposed: block in Release 2. | UI/UX, Release 2 |

---

## 14.3 Local-profile ownership amendment

The prior same-schema ownership rule is amended by D-110. SQLite has a device-only singleton `profile_state` with `connection_state` (`unlinked`, `connecting`, `linked`, `signed_out`) and nullable `account_user_id`. Before connection, user-owned device rows may have a null `user_id`; settings live in this local profile. Local parent relationships use ordinary foreign keys because one profile is permitted per install.

Supabase remains unchanged: every cloud row has a non-null authenticated `user_id`, uses RLS, and retains the composite ownership foreign keys. Claiming an empty account assigns the authenticated ID to all device rows, creates the syncable user/settings rows, clears the cursor, and marks the complete dataset dirty in one transaction. A cloud replacement removes the complete local profile and applies a validated staged pull in one transaction; it never merges local-only rows with cloud rows.

Release 1 export is a logical snapshot of live cars, profile settings, parts, odometer entries, and service records plus export metadata. It excludes tombstones, envelopes, queues, IDs used only for devices, and authentication data.
