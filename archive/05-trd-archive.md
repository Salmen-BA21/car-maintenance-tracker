# TRD · Archived sections

Change log and traceability tables moved out of the default reading path. Not needed to implement; read for audit history only. Source document: `03-technical-specifications/05-trd.md`.

## 16. Requirement mapping

| Requirement | Where addressed |
|---|---|
| NFR-001 (2 s cold start) | §5.7 startup budget |
| NFR-002 (500 ms after an update) | §5.6 one query plus in-memory status, §14 gate |
| NFR-003 (5 s to the cloud) | §10.5 1 s debounce, push batch |
| NFR-010, NFR-011 (offline, transactional) | §5.2, §5.4, §8 offline start |
| NFR-012 (idempotent retry) | §10.1 replay, §10.6 backoff |
| NFR-020, NFR-023 (TLS, no secrets) | §12 |
| NFR-021 (server-side isolation) | §9.1 RLS, §9.3 write surface, §14 two-account tests |
| NFR-022 (secure storage) | §8 session storage |
| NFR-024 (no credentials in the database) | §8 |
| NFR-025 (OS protection, no extra encryption) | §12 data at rest |
| NFR-030 (minimum data) | §9.1 schema, §12 logging |
| NFR-040 (minimum OS) | §3, T-11 |
| NFR-041 (phones, portrait) | §3 |
| NFR-042 (dev build, not Expo Go) | §2 build mode |
| NFR-050 (3 taps to mileage) | §11 deep link, UI doc 04 |
| NFR-060 (accessibility) | §14 manual checks, UI doc 04 |
| NFR-070, NFR-071 (translation, RTL) | T-12, §2 i18n |
| NFR-072 (locale formatting) | §7 `format`, §13 |
| NFR-080 (versioned schema) | §5.3, §9.4 |
| NFR-081 (templates as data) | §5.3 seeds |
| NFR-082 (UUID keys, timestamps) | §6, §10.4 |
| NFR-083 (swappable sync and auth) | §8 `AuthProvider`, §10 adapter |
| D-28, BR-17, AC-21 | §8 offline start |
| D-24, C-10, AC-22 | §11 budget and window |
| D-35, BR-19, AC-14 | §10.1 and §10.2 |
| D-29, D-30 | §7 `LocalDate` |
| D-50 | §5.6 "updated today", §7 validators, §11 |
| FR-093 | §5.6 newly-due notice |
| A-13 | §3 |

## 19. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First draft: stack, platform minimums (A-13), data layer, domain core, authentication, sync mechanics, notifications, security notes, PostgreSQL mapping, tooling and testing, T-01 to T-15. |
| 0.2 | 2026-11-01 | Owner chose Supabase: D-03 replaced, Turso and Clerk dropped, no per-user database and no provisioning function; `sync_seq` replaces `sync_log`; RLS and a two-function write surface replace scoped tokens. iOS is IPA-only for R1 (T-16). Fixes: non-paged pull, exclusive transactions, conflict notice, D-50 guard, FR-093, startup budget, debounce value, notification budget formula, corrected NFR-001 mapping, complete NFR traceability, atomic T-decisions, risks R-09 to R-15, retargeted S-01, document 07 follow-ups. |
| 0.3 | 2026-11-01 | Bundle identifier stays open (OQ-09): the product name is undecided, so the identifier is a neutral placeholder and the freeze point moves to the first build that stores real data. Added T-19 (identifier and scheme are single constants; the URL scheme is frozen now). §15 states what a later change costs. |
| 0.4 | 2026-11-01 | Cloud schema landed in document 07 v0.4: §13 now maps calendar dates to native `date` columns and drops the `to_char` workaround; §18.5 marks the PostgreSQL DDL and the reminder-default follow-ups done. `include_in_reminders` now defaults to 1, with A-06 and FR-090 revised. Approved 2026-11-01; T-01 to T-19 promoted to D-54 to D-72. |
| 0.5 | 2026-11-01 | Amendment after the architecture review (doc 06 v0.3). §5.5 and §10.3 store the conflict list whole as `conflicts_pending` and add `notifications_built_for`; T-17 wording follows, still D-70. §5.6 uses one change counter instead of per-table invalidation. §18.5 marks the orphan and composite-key follow-ups done after doc 07 v0.5 (DB-26); OQ-14 closed (D-81). |
| 0.6 | 2026-11-01 | Local-first amendment: authentication is optional; the device maintains one profile state; account connection first pulls, then either atomically claims an empty account or stages and atomically replaces with cloud data. JSON export is a SQLite-only read snapshot. |
