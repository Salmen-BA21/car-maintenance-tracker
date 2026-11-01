# Car Maintenance Tracker: Project Documentation

Working title (see OQ-05). Documentation language: English (D-20). Version 1.5, last updated 2026-11-01.

## 1. Project overview

A mobile app (Android and iOS, React Native/Expo) that tracks the maintenance of petrol and diesel cars from odometer readings. The owner enters the current mileage, and the app shows the remaining distance and time for every tracked part. Parts are grouped in categories, and the owner can always add custom parts. Data is stored on the device (SQLite) and synced to the cloud. The app is built for personal use first, with an architecture that can grow to a public product later.

## 2. Documentation index and status

| # | Document | Folder | Status |
|---|---|---|---|
| 01 | [Product Vision Document](01-discovery/01-product-vision.md) | 01-discovery | Approved v0.5 |
| 02 | [Product Requirements Document](02-product-requirements/02-prd.md) | 02-product-requirements | Approved v0.5 |
| 03 | [Software Requirements Specification](03-technical-specifications/03-srs.md) | 03-technical-specifications | Approved v0.6 |
| 04 | UI/UX Design Specification | 04-ui-ux-design | Not started |
| 05 | [Technical Requirements Document](03-technical-specifications/05-trd.md) | 03-technical-specifications | Approved v0.5 |
| 06 | [System Architecture Document](05-architecture/06-system-architecture.md) | 05-architecture | Approved v0.3 |
| 07 | [Database Design Document](06-database/07-database-design.md) | 06-database | Approved v0.5 |
| 08 | [API Specification](07-api/08-api-specification.md) | 07-api | Approved v0.3 |
| 09 | Security Requirements Document | 08-security | Not started |
| 10 | Project Development Roadmap | 09-project-planning | Not started |
| 11 | Testing and QA Plan | 10-testing | Not started |
| 12 | Deployment and Maintenance Plan | 11-deployment-maintenance | Not started |

Planned writing order: 08 API and 09 Security, then 04 UI/UX, then 10 to 12.

Numbering note: document numbers 01 to 12 are the reading order and appear in every file name. The folders come from the 11-folder template, so document 05 (TRD) sits in `03-technical-specifications`, 06 (Architecture) in `05-architecture`, and documents 07 to 12 one folder lower: 07 in `06-database`, 08 in `07-api`, 09 in `08-security`, 10 in `09-project-planning`, 11 in `10-testing`, 12 in `11-deployment-maintenance`. Every link is relative: keep the folder structure intact (clone the whole repository, not single files).

Identifier scheme used in every document: `F` feature, `US` user story, `BR` business rule, `AC` acceptance criterion, `FR`/`NFR` requirements, `C` constraint, `D` confirmed decision, `A` assumption, `OQ` open question, `R` risk, `SC` success criterion, `S` spike. Documents may add a local prefix for decisions proposed in them (`T` in doc 05, `DB` in doc 07, `AR` in doc 06, `CMP` for architecture components); those become `D` numbers only when approved.

## 3. Confirmed decisions (approved by the owner)

| ID | Decision |
|---|---|
| D-01 | Mobile app for Android and iOS, built with React Native and Expo. |
| D-02 | Local-first: SQLite on the device is the working copy. Cloud sync is part of the MVP. |
| D-03 | Backend: Supabase (PostgreSQL, authentication and row-level security in one project). Replaces the Turso + Clerk choice; OQ-01 is closed. |
| D-04 | Login methods: email/password and Google. |
| D-05 | Odometer entries must not decrease. A lower value is rejected. |
| D-06 | Replacing a part restarts its counters from the km and date of service. History is kept. Example: replaced at 320,000 km with a 70,000 km interval, at 340,000 km it shows 50,000 km left. |
| D-07 | A part can have a distance interval, a time interval, both (whichever comes first), or be condition-based. |
| D-08 | Parts are grouped in categories. The owner can always add custom parts. |
| D-09 | The default parts list (PRD Appendix A) is approved and shown according to the car profile (fuel, belt/chain, DPF). The gearbox type is stored on the profile but no default part depends on it yet. The timing belt and the gearbox oil have no pre-filled interval (the owner enters it from the manual). |
| D-10 | Mileage reminder: daily at a user-chosen time, skipped if the mileage was already updated that day, with periodic inspection prompts for condition-based parts. |
| D-11 | Alerts only for time-sensitive parts (e.g. engine oil). No background mileage tracking. All notifications are local. |
| D-12 | Service form: km (required), date (required), cost (optional), notes (optional). |
| D-13 | First setup asks for the last-change km per part. Skipped parts show "Unknown, check it". A bulk "all serviced today" action exists. |
| D-14 | Home screen: car header with odometer and Update mileage button, Needs attention list, collapsible categories with "+ Add part", part detail with Mark as replaced and history. |
| D-15 | Vehicles: petrol and diesel cars only. |
| D-16 | The product supports English, French and Arabic (right-to-left) and km/miles, delivered after the core MVP. |
| D-17 | Ads (AdMob) with paid removal belong to the public-release phase only. |
| D-18 | iOS for personal use through a sideloaded IPA, Android installed directly. Store releases happen in the public-release phase. |
| D-19 | Architecture is designed to scale (user-scoped data, UUID keys, timestamps, versioned schema, templates as data) while building for personal use first. |
| D-20 | Documentation language is English. |
| D-21 | Multi-car is supported by the data model from the start. The MVP interface shows one car. |
| D-22 | "Due soon" means remaining distance ≤ half the distance interval, capped at 1,000 km, or remaining time ≤ half the time interval, capped at 30 days, so a custom part with a short interval is not Due soon right after a replacement. A per-part "warn earlier" setting overrides it but must stay below the interval (Should Have, Release 2). Replaces A-01. |
| D-23 | Sync is backup, restore, and refresh on open. One conflict rule for all data: records merge by UUID, the latest update time wins, deletions are soft deletes. The backend is Supabase (D-58). Replaces A-15. |
| D-24 | Reminder mechanism: about 30 days of one-shot local reminders, rebuilt on every app open and mileage update (today's is omitted after an update), ending with a "reminders paused, open the app" notice. Part alerts take priority and schedule their nearest dates first, adding the rest as the window is rebuilt. When the pending-notification limit is tight, the reminder window shrinks to 7 days plus the notice (8 reserved slots). Overdue and due parts are named inside the daily reminder instead of receiving extra notifications. Tested on real devices in S-01. |
| D-25 | The active service record of a part is the one with the greatest service date (ties: greatest km). Both counters restart from it. Replaces A-10. |
| D-26 | First-time setup entries and "all serviced today" create baseline service records. They anchor status, appear as "Initial" in history, and are excluded from cost totals. |
| D-27 | Condition-based parts whose inspection period has elapsed are flagged "inspection due" and listed in Needs attention between Overdue and Due soon. |
| D-28 | After the first sign-in, local reads and writes never depend on a valid token. Sign-in gates only sync and account actions. |
| D-29 | Odometer and service dates are stored as local calendar dates (YYYY-MM-DD). Sync timestamps are UTC. Each service record stores its own currency code, and the currency setting only supplies the default. |
| D-30 | Time intervals use calendar months. If the target month is shorter, the due date is its last day (31 Jan + 1 month = 28 or 29 Feb). |
| D-31 | A lower mileage stays rejected. Replacing the instrument cluster (mileage reset) is unsupported in the MVP and documented as a limitation. Closes OQ-03. |
| D-32 | First-time setup asks for the last-change km and, separately and optionally, the last-change date. No date is assumed: a known km with an unknown date shows the distance countdown and "date unknown" on the time side, and a time-only part without a date stays Unknown. Only "Mark as replaced" defaults to today. Closes OQ-10. |
| D-33 | Status is derived on read and never stored. Closes OQ-06. |
| D-34 | Hiding a part records its cause: `user` (the owner) or `profile` (a car-profile change). Restoring a profile returns only profile-hidden parts; re-adding any hidden part restores its history. Closes OQ-07. |
| D-35 | Sync conflicts: latest `updated_at` wins, tie broken by `origin_device_id`. |
| D-36 | `user_id` is stored on every user-owned table, including on per-user cloud databases. |
| D-37 | Template values are copied into a part at creation and never re-applied. |
| D-38 | Cost is stored as integer minor units plus an ISO-4217 currency code. |
| D-39 | Cross-row validity is enforced by the write path, never by triggers. |
| D-40 | Keys are UUID v4 stored as `TEXT`. Exceptions: system rows use their code, template parts use `carId:templateCode`. `users.id` is the Supabase auth user id, itself a UUID. |
| D-41 | The current odometer is never stored; it is `MAX(value_km)` before and after a merge. |
| D-42 | Date-unknown service records rank after dated records when choosing a part's active record. |
| D-43 | Replacements and inspections share one table, `service_records`, separated by `kind`. |
| D-44 | System categories are rows with `user_id IS NULL`; custom categories carry a `user_id`. |
| D-45 | "Set interval" means any required interval value is missing: distance for distance and both, months for time and both. |
| D-46 | Release 2 and 3 settings (distance unit, locale, warn-earlier thresholds) are added by migration, not pre-created. |
| D-47 | Reference tables (`part_templates`, system categories) are local: seeded by migration on every database, never synced. Only custom categories sync. |
| D-48 | A template-derived part's ID is `carId:templateCode`, enforced by a check. |
| D-49 | The per-part reminder flag is `include_in_reminders` and is valid for every part type; a separate alert still requires a time interval. |
| D-50 | Odometer entries order by value, then date, then creation time. "Updated today" means a live entry dated today. Editing or deleting the latest entry is blocked when a live service record would sit above the result. |
| D-51 | A replacement requires both km and date; only a baseline record may omit either, and never both. |
| D-52 | Inspection due counts from the latest of the last inspection, the last service record, and the part's creation. |
| D-53 | The Due soon time threshold is `min(30, half the days between the service date and the due date)`. |
| D-54 | Expo with development builds and continuous native generation, TypeScript `strict`, Expo Router. No Expo Go. |
| D-55 | `expo-sqlite` is the only local engine: hand-written SQL migrations bundled as modules, repositories with Zod, no ORM and no packaged sync engine. |
| D-56 | The domain layer is pure TypeScript; calendar dates use an own `LocalDate` with integer day arithmetic; `today()` reads the device clock, never the sync clock. |
| D-57 | Every local write goes through a repository that validates, stamps the envelope and queues the row in `sync_dirty`, in one exclusive transaction. |
| D-58 | Backend is Supabase: one shared PostgreSQL database, isolation by RLS on `user_id = auth.uid()::text`. No per-user databases, no provisioning server, no platform credential in the app. |
| D-59 | The pull cursor is a server-assigned `sync_seq` on each row, never `updated_at`; there is no `sync_log` table. |
| D-60 | Sync is two SQL functions (`push_rows`, `pull_rows`); push is one transaction of conditional upserts; clients hold no direct write grant. |
| D-61 | One `Clock` module applies a measured server offset; implausible future timestamps are restamped on push; the clock is never used for local dates. |
| D-62 | Supabase Auth with email/password and Google through the system browser; session in secure storage; local start from a last-user marker; a different user wipes local data. |
| D-63 | `expo-notifications`, local only, two Android channels, no exact-alarm permission, one idempotent rebuild, and the 64-slot budget formula of TRD §11. |
| D-64 | Minimum Android 8.0 (API 26) and iOS 16, raised to the pinned SDK floor when higher; phones in portrait. Closes A-13. |
| D-65 | All user-visible strings go through an `i18next` catalog from Release 1; right-to-left layout arrives with Arabic in Release 2. |
| D-66 | Tests: Jest for the domain, the Supabase CLI stack for RLS and sync functions, Node SQLite for migrations and queries, Maestro on Android, manual iOS and accessibility checks, GitHub Actions for CI. |
| D-67 | Release 1 has no database encryption, no analytics and no crash reporting; Android backup and the iOS backup copy are both disabled. |
| D-68 | No OTA updates in Release 1; every change ships as a new build. |
| D-69 | iOS testing uses IPA files: an unsigned macOS CI build, signed on Windows with the free Apple ID and re-signed weekly. EAS iOS credentials are out of scope for Release 1. |
| D-70 | A pull that discards a queued local edit shows a notice naming the affected parts; the conflict list is stored whole (D-86); there is no manual merge UI. |
| D-71 | There is no server-side provisioning component. Account deletion (Release 2) is an operator step with the service-role key, not an app feature. |
| D-72 | The bundle identifier and URL scheme are single constants in the app config. The scheme is frozen now; the identifier stays a neutral placeholder until OQ-09 closes, and changing it costs a reinstall plus a full pull. |
| D-73 | Cloud migrations are applied by the operator with the Supabase CLI, never by the app, and stay backward compatible for one app release. |
| D-74 | Single process, single SQLite connection, single writer: every mutation — repository write, pull apply, migration, local wipe — passes through one serial write gate; reads do not. |
| D-75 | Sync is one single-flight coordinator. A pass is push then pull; triggers coalesce; at most one pass runs; a write during a pass schedules exactly one follow-up pass. A failed push call ends the pass in backoff before the pull. |
| D-76 | Network calls never hold the write gate: the engine snapshots under the gate, sends outside it, then re-enters to acknowledge. |
| D-77 | One composition root builds every service once; no module constructs its own singleton or reads build configuration directly. |
| D-78 | One post-commit pipeline owns query invalidation, the newly-due notice, the sync request and the notification rebuild, in that order. Features emit events and never call the scheduler or the engine. |
| D-79 | Release 1 executes nothing while backgrounded: no background task, no headless sync, no push. Triggers are launch, foreground, network regain, pull-to-refresh and writes while foreground. |
| D-80 | The visible sync state is derived from network, session, dirty count and last result, never stored; precedence Offline > Error > Pending > Synced. |
| D-81 | An outdated client refuses to sync and says so; there is no grace period. Local work continues and retries stop until the next cold start. Closes OQ-14. |
| D-82 | The notification service is the only caller of the notification library and rebuilds from a read snapshot after first paint, never inside a transaction. |
| D-83 | Every failure has exactly one class and one surface: field error, local message, sync banner, or blocking screen. No silent catch and no duplicate surface. |
| D-84 | Screens import hooks only; only `src/auth` and `src/sync/remote` import the cloud SDK; only `src/notifications` imports the notification library. Enforced by an import-boundary lint rule. |
| D-85 | Test seams are constructor arguments (`Database`, `Clock`, `AuthProvider`, `RemoteStore`, `Notifier`); no module mocking, and the same fakes serve unit, integration and end-to-end tests. |
| D-86 | The conflict notice payload is a JSON list of `{table, id, label}` in `local_meta.conflicts_pending`, stored whole and never capped; the screen truncates the display. `local_meta.notifications_built_for` records the date of the last rebuild. |
| D-87 | Sign-out is local and immediate: it clears the session and keeps every row, including queued ones. The only destructive confirmation is the account-switch wipe, which names how many rows are still unsynced. |
| D-88 | A pull never overwrites a queued local row that wins the merge predicate: the local row is kept, stays dirty and is pushed on the next pass. A pulled row wins only when it wins the envelope comparison. |
| D-89 | No orphan repair is written: soft deletes plus a parent-first transactional push make an orphan impossible, and a foreign-key failure rolls back the batch and holds the cursor. Child tables carry composite `(parent_id, user_id)` keys to `unique (id, user_id)` on `cars` and `parts`; `parts.category_id` stays a plain key. |
| D-90 | Deep links are `carmaint://mileage` and `carmaint://part/<url-encoded-id>`. Notification payloads carry ids and a kind only, never text, names or amounts; an unknown target falls back to the home screen. |
| D-91 | The paused notice and the 8 reserved notification slots exist only while reminders are enabled. With reminders off the window is zero days, nothing is reserved, and part alerts take the whole ceiling. |
| D-92 | A retry decision follows the engine error, not the phase: constraint, `CHECK` and foreign-key failures go to `blocked`; `SQLITE_FULL`, `SQLITE_BUSY` and I/O failures go to `backoff` with the cursor unchanged. |
| D-93 | Errors cross layer boundaries as typed codes, never as sentences. Repositories, the engine and the remote adapter return enum members; only the UI layer maps them to i18n keys, and document 08 maps server errors into the same set. |
| D-94 | The cloud API is exactly two RPC functions, `push_rows` and `pull_rows`, `POST`ed with the anonymous key and a bearer token. The app uses no table endpoint; authentication is Supabase Auth's own surface and belongs to `src/auth`. |
| D-95 | A row travels as its complete column set except `sync_seq`: explicit nulls, flags as `0`/`1`, unknown keys rejected. The server never receives a sparse row and never guesses a missing column. |
| D-96 | Every timestamp is fixed-width UTC `YYYY-MM-DDTHH:MM:SS.sssZ`; local dates stay `YYYY-MM-DD`. The text comparison in the merge predicate depends on this format and nothing else may produce a timestamp. |
| D-97 | `push_rows` takes a parent-first array of `{table, row}` over seven whitelisted tables and returns `{applied, rejected, server_now}`. `rejected` covers both a lost merge predicate and a row the caller does not own; the following pull tells them apart, so the body carries no reason field. |
| D-98 | `pull_rows` takes only the cursor and returns `{rows, max_seq, schema_version, server_now}`. `max_seq` is `GREATEST(p_cursor, MAX(sync_seq))`, rows are parent-first then `sync_seq` then `id`, and `sync_seq` never appears inside a row. |
| D-99 | The pull is not paged and no batch is resumable: one call returns the whole delta, bounded by the capacity of document 07 §12. A response over the platform limit is a capacity defect, not a paging requirement. |
| D-100 | The schema handshake is client-side, from `schema_version` in the pull response stored in `local_meta.cloud_schema_version`, checked before each pass. An unknown version is treated as matching for that pass, because it can only occur where the batch is empty. |
| D-101 | Server error text never reaches the UI. The adapter maps the HTTP status and SQLSTATE onto the app's typed codes, logs the raw body locally and returns only the enum member. |
| D-102 | Retryability belongs to the code, not the status: network, timeout, `5xx`, `429`, session and database-unavailable retry; every other failure is deterministic and blocks. An unknown status is retried, never blocked. |
| D-103 | The adapter never refreshes a token: on `401` it reports `SESSION_EXPIRED` and stops, and the auth service refreshes at most once per foreground. A 15 s per-request timeout applies to both functions. |
| D-104 | A notification payload is `{v, kind, partId?}` only, with `kind` one of `reminder`, `part-alert`, `paused`; the link is `carmaint://mileage` or `carmaint://part/<encodeURIComponent(partId)>`. An unknown kind, missing id or unparsable link falls back to the home screen and is logged. |
| D-105 | A response the client cannot validate is `RESPONSE_INVALID`: nothing is applied, the cursor stays, the pass blocks and logs. A partly valid body is never partly applied. |
| D-106 | `Clock.now()` is monotonic — never equal to or below the previous value, bumped by 1 ms on a tie — and `clock_offset_ms` is recomputed from the freshest `server_now` of either response. Three-digit milliseconds stay. |

## 4. Assumptions

Approved by the owner on 2026-11-01 unless marked otherwise. IDs are kept (no renumbering) so that references in all documents stay valid.

| ID | Assumption | Status |
|---|---|---|
| A-01 | "Due soon" means remaining distance ≤ 10% of the interval, or remaining time ≤ 30 days. | Superseded by D-22 |
| A-02 | An odometer entry equal to the latest value is accepted and changes nothing. | Approved |
| A-03 | Odometer values are whole numbers from 0 to 9,999,999 km. | Approved |
| A-04 | A service date cannot be in the future, and a service km cannot exceed the current odometer. | Approved |
| A-05 | Distance-based statuses refresh when the odometer is updated or the app opens. An in-app notice appears when a part newly becomes Due soon or Overdue. | Approved |
| A-06 | Each part has an alert on/off setting, on by default for every part. A separate due-date notification still requires a time interval. | Approved (revised in doc 07 v0.4) |
| A-07 | Time intervals count calendar months from the service date. | Approved (clamping in D-30) |
| A-08 | The default reminder time is 20:00. | Approved |
| A-09 | The inspection prompt for a condition-based part is every 3 months by default, adjustable per part. | Approved |
| A-10 | Service records can be edited and deleted. The active record is the one with the highest service km. | Superseded by D-25 (edit and delete remain approved) |
| A-11 | The owner can create custom categories (Should Have, Release 2). | Approved |
| A-12 | Currency (for cost) is a user setting, defaulting to the device region. | Approved (per-record storage in D-29) |
| A-13 | Minimum Android and iOS versions are decided in the TRD. | Closed: see D-64 |
| A-14 | Deleting the account and data from the app is a Should Have (Release 2) and is required before public release. | Approved |
| A-15 | Sync conflicts: odometer entries and service records merge without loss. Other records use the latest update time. | Superseded by D-23 |
| A-16 | The owner can mark a condition-based part as "inspected", which stores the date and restarts its prompt cycle. | Approved |
| A-17 | Numeric performance targets in the SRS are proposals to be validated in testing. | Approved |

## 5. Open questions

| ID | Question | Decide in |
|---|---|---|
| OQ-01 | Closed: Supabase selected (D-58); there is no backend spike gate any more. | Closed |
| OQ-02 | How to produce the iOS IPA without a Mac or a paid Apple account (tested inside S-01). | Deployment plan |
| OQ-03 | Closed: see D-31. | Closed |
| OQ-04 | Monetization details for ad removal (one-time or subscription, price). | Release 3 |
| OQ-05 | Final app name. | All |
| OQ-06 | Closed: see D-33. | Closed |
| OQ-07 | Closed: see D-34. | Closed |
| OQ-08 | When does the multi-car interface arrive, and what does it need from the data model? | UI/UX, roadmap |
| OQ-09 | Application and bundle identifier. The name is undecided (OQ-05), so the identifier is a neutral placeholder; freeze it before the first build that stores real data (D-72). | Owner, before the first production build |
| OQ-10 | Closed: see D-32. | Closed |
| OQ-11 | Custom category with live parts: block deletion, or move its parts to "Uncategorized"? Proposed: block (doc 07). | Release 2, UI/UX |
| OQ-12 | Withdrawn: there is no provisioning component (D-71). | Closed |
| OQ-13 | Withdrawn: replaced by OQ-14 when the per-user database was dropped. | Closed |
| OQ-14 | Closed 2026-11-01: an outdated client refuses to sync, with no grace period (D-81). | Closed |
| OQ-15 | Keep the 64-notification design ceiling on Android, or use the higher Android limit and accept different behaviour per platform? | Testing (11), after S-01 item 7 |
| OQ-16 | Email confirmation on sign-up: required in production, disabled in development? | Owner, before S-01 |
| OQ-17 | Crash reporting: none in Release 1 (D-67), or a development-only Sentry project? | Deployment (12) |
| OQ-18 | Keep `select` grants on the synced tables for the security-invoker `pull_rows`, or revoke them and make `pull_rows` security-definer with an explicit `user_id` filter? The second shrinks the surface but moves the ownership check into the function. | Security (09) |

## 6. Spike S-01 (one day, gate before the main build)

Goal: prove that Supabase plus the Expo build pipeline carries the app before the main build starts (D-03, D-58). Retargeted on 2026-11-01; the Turso and Clerk items are gone.

1. Supabase Auth: email/password sign-up with confirmation, password reset, and Google through the system browser, in a development build on Android and iPhone (D-62).
2. RLS isolation with two accounts: A cannot read, write or infer B's rows, and a direct client write is refused (D-58, D-60).
3. Offline write on device, then sync, then read on a second device through `push_rows` and `pull_rows`.
4. The same record edited on two devices: latest update wins, and the loser is reported by the conflict notice (D-23, D-70).
5. Expired session and no network, then restart: local data is shown and editable, sync state Offline (AC-21).
6. An IPA built on a macOS runner, signed on Windows with the free Apple ID, installed, and re-signed after 7 days without losing data (D-69, OQ-02).
7. The rolling reminder window on real Android and iOS devices: delivery, skipping today after an update, the "paused" notice, the 64-slot budget with the real alert count, and behaviour after reboot, force-stop and reinstall (D-24, C-10, D-63).
8. `push_rows`/`pull_rows` latency and a full pull of the whole dataset on the free tier; free-project pause behaviour (R-09).

Pass criteria: items 1 to 5 work reliably. Items 6 to 8 decide the iOS routine, the notification mechanics and the free-tier limits.

## 7. Risks

The risk register is in [PVD §9](01-discovery/01-product-vision.md) (R-01 to R-15; R-01 and R-02 are closed).

## 8. Notes for the reviewer

- The release split used in the PRD (R1 MVP, R2 localization and export, R3 public release) is a proposal. It is confirmed in document 10.
- Default part intervals come from public maintenance guidance and vary by manufacturer. The car's manual always takes priority (BR-14).
- No application source code is produced during the documentation phase.

## 9. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First batch: README, PVD, PRD, SRS. |
| 0.2 | 2026-11-01 | Review fixes: fixed the "Due soon" rule (D-22), one sync conflict rule (D-23), reminder window (D-24), active record by date (D-25), baseline records (D-26), inspection due in Needs attention (D-27), local data not gated by login (D-28), local dates and per-record currency (D-29), month-end clamp (D-30), mileage limitation (D-31), four new acceptance criteria (AC-17 to AC-20), "Set interval" status, wrong document number in the PVD, assumptions marked approved, open questions OQ-06 to OQ-10. |
| 0.3 | 2026-11-01 | Second review: Due soon thresholds capped at half the interval (D-22, AC-23), setup asks for an optional date with no default (D-32, BR-20, AC-24, OQ-10 closed), notification budget priority and reserve (D-24, C-10, FR-086), overdue and due parts named in the daily reminder instead of new alerts (FR-082, FR-091), data usable with an expired token (AC-21), reminder window behaviour (AC-22), superseded references in F-07 and F-13 corrected, current odometer is the greatest entry after a merge (BR-01). |
| 0.4 | 2026-11-01 | Document 07 (Database Design) added as draft: nine tables, sync contract, derived status, seeds, migrations. It proposes DB-01 to DB-21 and a closure for OQ-06 and OQ-07 (see doc 07 §14). Review round applied in v0.2: reference data is not synced, deterministic part IDs, odometer ordering and guards, reminder flag on all part types, day-based Due soon threshold, inspection reset on replacement, km and date required for replacements. |
| 0.5 | 2026-11-01 | Document 07 approved. DB-01 to DB-21 promoted to D-33 to D-53; OQ-06 and OQ-07 closed. |
| 0.6 | 2026-11-01 | Documents 01, 02 and 03 approved at v0.3. |
| 0.7 | 2026-11-01 | Consistency pass: DB-05/DB-09 aligned with §14.1; inspection anchor includes the last service record (BR-08, FR-044, FR-082); date-only baseline defined (BR-20, FR-043, AC-24); profile hide no longer overwrites an owner hide; home query returns the last inspection; `cars.sort_order` removed; gearbox removed from D-09's profile rule; default count corrected to 17; Due soon threshold aligned with D-53; date-unknown ranking added to BR-07/FR-054; password reset added to F-01; F-15 basis fixed; AC-23 R2 clause excluded from the MVP gate; service_date format check; seed conflict targets; small reference fixes. |
| 0.8 | 2026-11-01 | Document 05 (TRD) added as a draft (v0.3) and indexed. Backend changed to Supabase: D-03 amendment proposed in TRD §18.1, Turso and Clerk dropped, OQ-01 and R-01 close, R-02 becomes an RLS risk, S-01 retargeted. iOS testing uses IPA files in R1. Document 07 v0.4 adds the PostgreSQL cloud schema (`sync_seq`, RLS, read-only clients, operator-applied migrations) and defaults `include_in_reminders` to 1 so reminder lines cover every part; A-06 and FR-090 revised (SRS v0.5). Bundle identifier stays open (OQ-09). |
| 0.9 | 2026-11-01 | Documents 05 (TRD) and 07 (Database) approved at v0.4. T-01 to T-19 promoted to D-54 to D-72; DB-22 to DB-24 restate D-58 to D-60 and DB-25 becomes D-73. D-03 replaced with Supabase, D-40's provider-subject exception dropped. A-13 and OQ-01 closed, OQ-09 reworded, OQ-12 and OQ-13 withdrawn, OQ-14 to OQ-17 added. Spike S-01 retargeted to Supabase and the IPA routine; risk register now R-01 to R-15 with R-01 and R-02 closed. |
| 1.0 | 2026-11-01 | Document 06 (System Architecture) added as a draft (v0.1) and indexed: components and boundaries, write gate and post-commit pipeline, process lifecycle, twelve runtime flows, the sync state machine, scheduler placement, the error matrix and test seams. It proposes AR-01 to AR-15 and answers OQ-14 (refuse sync for an outdated client). AR-13 would rename one `local_meta` key in doc 07 and align TRD §10.3, applied only on approval. |
| 1.1 | 2026-11-01 | Document 06 revised to v0.2 after an owner grilling round: sign-out no longer flushes (AR-14), sync is requested before the notification rebuild, one global change counter replaces per-table invalidation, the conflict list is stored whole, the orphan question is closed with composite keys (AR-16), the deep-link grammar is frozen (AR-17), the paused notice is conditional on reminders (AR-18), retries are classified by engine error (AR-19) and errors cross layers as codes (AR-20). AR-01 to AR-20 wait for approval. |
| 1.2 | 2026-11-01 | Document 06 approved at v0.3: AR-01 to AR-20 promoted to D-74 to D-93 and OQ-14 closed. Amendments landed: doc 07 v0.5 (`conflicts_pending` plus `notifications_built_for`, DB-26/DB-27 composite keys, OQ-01 closed), TRD v0.5 (adapter keys, conflict payload, one change counter, follow-ups closed), SRS v0.6 (C-03 and dependencies), PVD v0.5 (R-06, SC-06) and PRD v0.5 (§8). Stale Turso and Clerk references are gone. |
| 1.3 | 2026-11-01 | Document 08 (API) added as a draft (v0.1) and indexed: the two-function surface, request and response shapes, wire conventions (24-character timestamps, `0`/`1` flags, explicit nulls), token rules, the row-level versus call-level split, the typed error vocabulary with its HTTP and SQLSTATE mapping, the client-side schema handshake, the clock contract, notification payloads and deep-link encoding, the contract-test list, and API-01 to API-12. Raises OQ-18 on the read grant. |
| 1.4 | 2026-11-01 | Document 08 revised to v0.2 after an owner grilling round: a monotonic clock guard and the offset from either response (API-13), and three notification kinds without `permission`. Confirmed unchanged: bare `rejected` keys, one call per pass, client-side handshake, retry on unclassified failures, ordered responses, greatest-of `max_seq`, synced account email. API-01 to API-13 await approval. |
| 1.5 | 2026-11-01 | Document 08 approved at v0.3: API-01 to API-13 promoted to D-94 to D-106. OQ-18 stays open for document 09. |
