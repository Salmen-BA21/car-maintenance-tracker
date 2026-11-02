# TRD · Notifications, security notes, SQLite/PostgreSQL notes

> Part of [05-trd.md](../05-trd.md). Sections: §11, §12, §13. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 11. Notifications

| Topic | Decision |
|---|---|
| Library | `expo-notifications`, local scheduling only. No remote push in any release (D-11, C-05). |
| Channels (Android) | `reminders` for the daily mileage reminder and inspection prompts, `alerts` for part alerts, so one can be muted without the other. |
| Permission | Requested in context when the owner turns reminders or alerts on, not at first launch. Denial follows AC-20: explain how to enable, schedule nothing, keep everything else working. |
| Exact timing | No exact-alarm permission is requested. Delivery may be a few minutes late; the Settings copy says so. This is an accepted deviation from "at the chosen time" (FR-080), recorded in §17. |
| Scheduler | One idempotent `rebuildSchedule()` cancels all pending notifications and recreates them from current data. |
| Budget | Design to the iOS ceiling of 64 pending notifications on both platforms, for parity. `reminder_days = clamp(64 − 8 − alerts, 7, 30)`, where `alerts = 2 × time-interval parts with alerts on`. The 8 reserved slots are the reminder days at the floor plus the paused notice. Alerts take their nearest dates first; surplus alerts are dropped and re-added on later rebuilds. |
| Window end | The last scheduled notification says reminders are paused and asks the owner to open the app (AC-22, D-24). |
| Today's reminder | Omitted when a live odometer entry is dated today (D-50). A mileage update triggers a rebuild, which removes it. |
| Content | Computed per date. Time-based status is projected to that date; distance-based status uses the odometer known at build time and cannot be projected, so a distance-overdue part is named only from the data the last build knew (FR-082). |
| Dates and DST | Trigger instants are built from local year, month, day and the chosen time, then converted once. A DST shift or time-zone change is repaired by the next rebuild, which a change of local date or zone triggers (§5.6). |
| Rebuild timing | After first paint, never during startup (§5.7). |
| Taps | A notification opens the mileage entry (FR-084) or a part detail through a deep link. |

Validated on real devices in S-01 item 7: delivery, skip-after-update, the paused notice, the 64-slot budget with the real number of alerts, and behaviour after a device reboot, a force-stop and an app re-install. Reboot behaviour in particular decides whether an extra rebuild trigger is needed.

---

## 12. Security and privacy implementation notes

Document 09 owns the requirements; this section records the implementation choices that affect them.

| Topic | Decision |
|---|---|
| Transport | HTTPS only. Cleartext traffic is disabled on Android; iOS uses App Transport Security defaults. |
| Secrets | The app ships only the public project URL and the **anon** key, both of which are public by design. The **service-role key never leaves the developer machine.** Security rests on RLS, not on hiding a key (T-05). |
| Isolation | `user_id = auth.uid()::text` policies on every synced table, and two-account integration tests in CI (§14). |
| Write surface | Clients have no direct write grant; only the sync functions are executable (§9.3). This keeps the merge, the envelope and `sync_seq` unbypassable. |
| Tokens | Access and refresh tokens in the platform secure store (NFR-022). |
| Data at rest | The local database relies on the operating-system sandbox; no SQLCipher in R1 (NFR-025, T-14). The data is low sensitivity: mileage, parts, costs, email. |
| Backups | Android automatic backup is disabled and the SQLite file is excluded from the iOS backup, because the cloud is the backup and a restored stale database must not meet a newer cloud. |
| Logging | No email, user id, token or free-text notes in logs. |
| Analytics | None in R1. Crash reporting is deferred to document 12; the cost is no field visibility on the owner's own phones, accepted for now. |
| Dependencies | Pinned by lockfile; updates reviewed manually. |

---

## 13. SQLite (device) and PostgreSQL (cloud) notes

The cloud is now PostgreSQL, so document 07's DDL needs its PostgreSQL form. Both sides keep the same logical schema and the same formats, so the merge predicate and the row shape are identical.

| SQLite | PostgreSQL |
|---|---|
| `TEXT` keys and timestamps | `text`, same formats, so no time-zone or serialization surprise |
| `TEXT` calendar dates | Native `date`. PostgreSQL rejects impossible days without a check, and JSON still serializes `YYYY-MM-DD`, so the wire format is unchanged (D-29). |
| `INTEGER` booleans with `CHECK (col IN (0,1))` | `smallint` with the same check (one representation, not "or boolean") |
| `GLOB '[0-9][0-9][0-9][0-9]-…'` | Regular expression: `col ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`; still needed for text that is not a date, such as `reminder_time` and `currency_code`. |
| `date(col) = col` | Not needed: the column is a `date`. Document 07 §5 originally wrote `col::date = col`, which compares a date with text. |
| `PRAGMA defer_foreign_keys` | Foreign keys declared `DEFERRABLE INITIALLY DEFERRED` |
| Partial indexes | Same syntax |
| `PRAGMA` block | No equivalent needed; server settings are not schema |
| Per-user databases | One shared database; RLS replaces database scoping |
| — | `sync_seq bigint not null` on the seven synced tables, indexed `(user_id, sync_seq)`; one global sequence |
| — | `revoke insert, update, delete` from `authenticated`; `grant execute` on `push_rows`, `pull_rows` |

PostgreSQL needs no `sync_log` table (§9.2). System reference rows have `user_id IS NULL`, are seeded by an operator migration and are readable by every authenticated user.
