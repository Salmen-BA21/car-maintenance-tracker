# DBD · Archived sections

Change log and traceability tables moved out of the default reading path. Not needed to implement; read for audit history only. Source document: `06-database/07-database-design.md`.

## 13. Traceability

| Requirement | Tables |
|---|---|
| FR-001 to FR-006 (auth) | `users` (identity only; credentials stay with the provider) |
| FR-010 to FR-012 (car) | `cars` |
| FR-020 to FR-027 (odometer) | `odometer_entries`, §4.7 ordering and guard |
| FR-030 to FR-037 (parts, categories) | `categories`, `part_templates`, `parts` |
| FR-040 to FR-049 (status) | Derived from `parts`, `service_records`, `odometer_entries` (§6) |
| FR-050 to FR-056 (service records) | `service_records`, §4.8 checks |
| FR-060 to FR-063 (setup) | `service_records.is_baseline` |
| FR-080 to FR-094 (reminders, alerts) | `user_settings`, `parts.include_in_reminders`, `service_records`; no notification table (§6, D-24) |
| FR-100 to FR-106 (offline, sync) | Envelope columns, §9 |
| FR-110, FR-111 (settings) | `user_settings`, `service_records.cost_currency` |
| FR-120 (export) | All user tables (§11) |
| FR-140 (delete account) | `users` and every table via `user_id` (§11) |
| NFR-080 (versioned schema) | `schema_migrations` (§10) |
| NFR-081 (templates as data) | `part_templates`, seeded locally (DB-15) |
| NFR-082 (UUID keys, timestamps) | Envelope columns (§2), with the `users.id` and reference-row exceptions |
| BR-01 (odometer never decreases) | `odometer_entries`, enforced by the write path and the §4.7 guard |
| BR-05 (status list) | §6.4 |
| BR-08 (inspection) | `parts.inspection_months`, `service_records.kind = 'inspection'`, §6.5 |
| BR-16 (baseline) | `service_records.is_baseline`, §6.7 |
| BR-18 (dates, currency) | `entry_date`, `service_date`, `cost_currency` |
| BR-19 (conflicts) | §9 |
| BR-20 (independent anchors) | Nullable baselines, §6.3, DB-19 |

## 15. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First version: nine tables, envelope and sync contract, derived status rules, seeds for Appendix A, migrations, lifecycle, traceability, proposed DB-01 to DB-14. |
| 0.2 | 2026-11-01 | Review fixes: reference tables are local and unsynced (DB-15); deterministic part IDs (DB-16); reminder flag applies to all part types (DB-17); odometer ordering, "updated today", and the edit/delete guard (DB-18); replacements require km and date (DB-19); inspection anchor includes replacements (DB-20); Due soon threshold in days (DB-21); hidden parts record their cause (`user`/`profile`); `users.id` and reference rows documented as key exceptions; SQLite DDL labelled as such; template `inspection_months` default removed; "all serviced today" defined for condition-based parts. Approved by the owner; DB-01 to DB-21 promoted to D-33 to D-53. |
| 0.3 | 2026-11-01 | Consistency pass: §1 DB-05/DB-09 aligned with §14.1 and the basis column cites the same decisions; profile hide keeps an owner hide; home query adds the last inspection; `cars.sort_order` removed; "18 defaults" corrected to 17; date-only baseline status defined; `service_date` format check; `inspection_months` restricted to condition rows; seed conflict targets fixed; DB-17 wording; OQ-06/OQ-07 closure wording. |
| 0.4 | 2026-11-01 | Supabase selected (D-03): §5 split into device and cloud; PostgreSQL schema added in §5.2 with `sync_seq`, RLS policies, read-only clients and the two sync functions; DB-22 to DB-25 proposed; cloud migrations are operator-applied and backward compatible (§10); account deletion is an operator step (§11); reference rows in the shared cloud are read-only. `include_in_reminders` now defaults to `1` for every part, so reminder lines cover distance-only and condition-based parts as BR-08, FR-082 and AC-10 require; A-06 and FR-090 were revised to match. Approved 2026-11-01; DB-22 to DB-24 map to D-58 to D-60 and DB-25 to D-73. |
| 0.5 | 2026-11-01 | Amendment after the architecture review. §4.10 stores the conflict list whole as `conflicts_pending` (JSON `{table, id, label}`) and adds `notifications_built_for`; the `conflicts_since_notice` counter is gone. DB-26 adds `UNIQUE (id, user_id)` on `cars` and `parts` and composite `(parent_id, user_id)` foreign keys on `parts`, `odometer_entries` and `service_records`, in §4 and §5.2 alike, so orphans and cross-owner references fail loudly instead of needing a repair rule. OQ-01 closed; the intro no longer treats PostgreSQL as a fallback. |
| 0.6 | 2026-11-01 | Added the D-110 device/cloud ownership split, singleton `profile_state`, atomic profile claim and replacement, and Release 1 logical-export definition. |
