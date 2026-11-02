# TRD · Risks introduced, decisions and open questions (rationale)

> Part of [05-trd.md](../05-trd.md). Sections: §17, §18. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 17. Risks introduced

| ID | Risk | Mitigation |
|---|---|---|
| R-09 | A free Supabase project pauses after about a week of inactivity, and the free tier caps storage and egress. | Sync on every open keeps the project active; the paused state is detected and shown as an error; paid tier only if it becomes a nuisance. |
| R-10 | A wrong RLS policy or a stray `grant` exposes rows across accounts. | Two-account integration tests in CI, no direct write grant, service-role key never on device (§9, §14). |
| R-11 | The 7-day free-signing expiry interrupts iPhone testing, and notifications stop until the app is re-signed. | Weekly re-sign routine, re-signing proven in S-01 item 6, reminders rebuilt on next open. |
| R-12 | Pending-notification limits, delivery jitter, reboot or force-stop behaviour differ per device. | Budget formula (§11), real-device checks (S-01 item 7). |
| R-13 | `Intl` coverage in Hermes differs per platform, which would break number, date and later Arabic formatting. | Verified in S-01; fallback to an `Intl` polyfill or explicit formatters. |
| R-14 | A discarded local edit is only reported after the fact (§10.3). | The conflict notice; manual merge UI is out of scope. |
| R-15 | Free-tier auth email rate limits block sign-up or reset. | Tested in S-01; magic link or a custom SMTP as fallback. |

`R-01` (Turso and Clerk were beta) is closed by this change; `R-02` becomes R-10 (RLS instead of token scoping).

---

## 18. Decisions and open questions

### 18.1 Amendments to confirmed decisions

These are owner decisions already taken, or consequences of them, and need a README edit rather than a new `D` number. They were applied in README v0.9 on approval.

| ID | Change | Reason |
|---|---|---|
| D-03 | **Replaced.** Backend is Supabase (PostgreSQL + Auth + RLS), one shared project. Turso and Clerk are dropped; the conditional spike gate is removed. | Owner decision 2026-11-01: one service containing everything. |
| D-04 | Unchanged. Email/password and Google remain the login methods, now through Supabase Auth. | Still satisfied. |
| D-40 | **Exception dropped.** `users.id` is the Supabase auth UUID, not a provider subject. | The provider returns UUIDs, so the workaround is unnecessary. |
| R-01 | Closed. No Turso embedded replica is used. | — |
| R-02 | Replaced by R-10: misconfigured RLS rather than unscoped tokens. | — |
| A-13 | Closed by T-11 (minimum OS versions). | — |
| OQ-01 | Closed: Supabase. | — |
| S-01 | Retargeted (§18.4). Items 1 to 5 are replaced; items 6 and 7 keep their purpose. | — |

### 18.2 Confirmed decisions

Approved by the owner on 2026-11-01; the README register carries them as D-54 to D-72.

| T | Decision | Becomes |
|---|---|---|
| T-01 | Expo with development builds and continuous native generation, TypeScript `strict`, Expo Router. No Expo Go. | D-54 |
| T-02 | `expo-sqlite` is the only local engine: hand-written SQL migrations bundled as modules, repositories with Zod, no ORM and no packaged sync engine. | D-55 |
| T-03 | The domain layer is pure TypeScript; calendar dates use our own `LocalDate` with integer day arithmetic; `today()` reads the device clock, never the sync clock. | D-56 |
| T-04 | Every local write goes through a repository that validates, stamps the envelope and queues the row in `sync_dirty`, in one exclusive transaction. | D-57 |
| T-05 | Backend is Supabase: one shared database, RLS on every synced table, no per-user database, no provisioning server, no platform credential in the app. | D-58 |
| T-06 | The pull cursor is a server-assigned `sync_seq` on each row, never `updated_at`; no `sync_log` table. | D-59 |
| T-07 | Both directions are one SQL function each (`push_rows`, `pull_rows`); push is one transaction of conditional upserts; the client has no direct write grant. | D-60 |
| T-08 | One `Clock` module applies a measured server offset; implausible future timestamps are restamped on push; the clock is never used for local dates. | D-61 |
| T-09 | Supabase Auth with email/password and Google through the system browser; session in secure storage; local start from a last-user marker; a different user wipes local data. | D-62 |
| T-10 | `expo-notifications`, local only, two Android channels, no exact-alarm permission, one idempotent rebuild, and the 64-slot budget formula of §11. | D-63 |
| T-11 | Minimum Android 8.0 (API 26) and iOS 16, raised to the pinned SDK floor when higher; phones in portrait. Closes A-13. | D-64 |
| T-12 | All user-visible strings go through an `i18next` catalog from R1; right-to-left layout arrives with Arabic in R2. | D-65 |
| T-13 | Tests: Jest for the domain, Supabase CLI stack for RLS and sync functions, Node SQLite for migrations and queries, Maestro on Android, manual iOS and accessibility checks, GitHub Actions for CI. | D-66 |
| T-14 | R1 has no database encryption, no analytics and no crash reporting; Android backup and the iOS backup copy are both disabled. | D-67 |
| T-15 | No OTA updates in R1. Every change ships as a new build. | D-68 |
| T-16 | iOS testing uses IPA files: unsigned macOS CI build, signed on Windows with the free Apple ID, re-signed weekly. EAS iOS credentials are out of scope for R1. | D-69 |
| T-17 | A pull that discards a queued local edit records it in the conflict list and shows a notice naming the affected parts; there is no manual merge UI. | D-70, D-86 |
| T-18 | There is no server-side provisioning component. Account deletion (R2) is an operator step with the service-role key, not an app feature. | D-71 |
| T-19 | The bundle identifier and URL scheme are single constants in the app config. The scheme is frozen now; the identifier stays a neutral placeholder until OQ-09 closes, and changing it costs a reinstall plus a full pull. | D-72 |

### 18.3 Open questions

| ID | Question | Decide in |
|---|---|---|
| OQ-09 | Application and bundle identifier. The product name is not chosen yet (OQ-05), so the identifier remains a neutral placeholder that is independent of the working title. Freeze it before the first build that stores real data; afterwards a change means a reinstall, a new local database and a full pull from the cloud. The URL scheme is frozen independently (T-19). | Owner, before the first production build |
| OQ-14 | Closed 2026-11-01: an outdated client refuses to sync, with no grace period (D-81). Local work continues and retries stop until the next cold start. | Closed |
| OQ-15 | Do we keep the 64-notification design ceiling on Android, or use the higher Android limit and accept different behaviour per platform? | Testing (11), after S-01 item 7 |
| OQ-16 | Email confirmation on sign-up: required in production, disabled in development? | Owner, before S-01 |
| OQ-17 | Crash reporting: none in R1 (T-14), or a development-only Sentry project? | Deployment (12) |

### 18.4 Spike S-01, retargeted

Goal: prove that Supabase plus the Expo build pipeline carries the app before the main build starts. One day; two if item 6 is slow.

1. Supabase Auth: email/password sign-up with confirmation, reset, and Google through the system browser, in a development build on Android and iPhone.
2. RLS isolation with two accounts: A cannot read, write or infer B's rows; a direct write from the client is refused.
3. Offline write on the device, sync, then read on a second device through `push_rows`/`pull_rows`.
4. The same record edited on two devices: latest `updated_at` wins; the loser is reported by the conflict notice.
5. Expired session, no network, app restart: local data is shown and editable, state Offline (AC-21).
6. An IPA is produced on a macOS runner, signed on Windows with the free Apple ID, installed, and re-signed after 7 days without losing data.
7. The reminder window on real devices: delivery, skip-today after an update, the paused notice, the 64-slot budget with the real alert count, and behaviour after reboot, force-stop and reinstall.
8. `push_rows`/`pull_rows` latency and a full pull of the whole dataset on the free tier; free-project pause behaviour.

Pass: items 1 to 5 work reliably. Items 6 to 8 decide the iOS routine, the notification mechanics and the size of the free tier.

### 18.5 Follow-ups for other documents

| Document | Point |
|---|---|
| 07 Database | **Done in v0.4**: PostgreSQL cloud schema published in §5.2 (`sync_seq`, RLS, read-only clients, `date` columns, deferred keys); DB-22 to DB-25 proposed there; adapter-local tables added as §4.10. |
| 07 Database | **Done in v0.4**: `include_in_reminders` now defaults to 1 for every part. A-06 and FR-090 were revised to match (SRS v0.5). |
| 07 Database | **Done in v0.5**: orphaned children are structurally impossible (soft deletes plus a parent-first transactional push), so no repair rule is written; DB-26 added `UNIQUE (id, user_id)` on `cars` and `parts` and composite `(parent_id, user_id)` foreign keys on the child tables. An orphan or cross-owner reference now fails the batch and holds the cursor. |
| 08 API | Name the two RPC functions, their payloads and error codes; they are the whole cloud API. |
| 09 Security | Threat model for RLS, the service-role key, and the local database. |
| 11 Testing | Inherit the split in §14: cloud tests in CI, notifications and accessibility by hand, Maestro on Android only. |
| 12 Deployment | The IPA re-signing routine, the weekly calendar reminder, and the operator steps to apply cloud migrations and delete an account. |

---

## 18.6 Local-profile amendment

The device creates a singleton local profile before authentication. Its state is `unlinked`, `connecting`, `linked`, or `signed_out`; it stores the associated account ID only when one exists. Sync is disabled unless the state is `linked`.

The SQLite working copy permits `user_id` to be absent before connection and uses ordinary parent foreign keys because only one local profile exists. Supabase keeps non-null `user_id`, composite ownership keys, and RLS. On confirmed connection to an empty account, one exclusive device transaction assigns the authenticated ID to all owned rows, creates the user/settings rows, resets the cursor, and queues one complete parent-first upload. For an account with data, the app validates and stages a full pull before one transaction replaces the local profile. Cancellation signs out without changing either dataset.

The export service reads one consistent SQLite snapshot and emits maintenance data plus export metadata. Soft-deleted part rows are retained when needed to keep preserved service history referentially complete. It never calls Supabase and excludes identity, device and sync data.
