# README · Confirmed decisions register (authoritative)

> Part of [README.md](README.md). Sections: §3. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 3. Confirmed decisions (approved by the owner)

| ID | Decision |
|---|---|
| D-01 | Mobile app for Android and iOS, built with React Native and Expo. |
| D-02 | Local-first: SQLite on the device is the working copy from first launch. Cloud sync is an optional MVP capability after an account is connected (D-107). |
| D-03 | Backend: Supabase (PostgreSQL, authentication and row-level security in one project). Replaces the Turso + Clerk choice; OQ-01 is closed. |
| D-04 | Optional account-connection methods: email/password and Google. They enable Supabase sync and account actions; they never gate local use (D-107). |
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
| D-18 | iOS is for personal use through a sideloaded IPA; Android is installed directly. Any public release targets Google Play only unless a later owner decision funds App Store distribution (D-111). |
| D-19 | Architecture is designed to scale (user-scoped data, UUID keys, timestamps, versioned schema, templates as data) while building for personal use first. |
| D-20 | Documentation language is English. |
| D-21 | Multi-car is supported by the data model from the start. The MVP interface shows one car. |
| D-22 | "Due soon" means remaining distance ≤ half the distance interval, capped at 1,000 km, or remaining time ≤ half the time interval, capped at 30 days, so a custom part with a short interval is not Due soon right after a replacement. A per-part "warn earlier" setting overrides it but must stay below the interval (Should Have, Release 2). Replaces A-01. |
| D-23 | Sync is backup, restore, and refresh on open. One conflict rule for all data: records merge by UUID, the latest update time wins, deletions are soft deletes. The backend is Supabase (D-58). Replaces A-15. |
| D-24 | Reminder mechanism: about 30 days of one-shot local reminders, rebuilt on every app open and mileage update (today's is omitted after an update), ending with a "reminders paused, open the app" notice. Part alerts take priority and schedule their nearest dates first, adding the rest as the window is rebuilt. When the pending-notification limit is tight, the reminder window shrinks to 7 days plus the notice (8 reserved slots). Overdue and due parts are named inside the daily reminder instead of receiving extra notifications. Tested on real devices in S-01. |
| D-25 | The active service record of a part is the one with the greatest service date (ties: greatest km). Both counters restart from it. Replaces A-10. |
| D-26 | First-time setup entries and "all serviced today" create baseline service records. They anchor status, appear as "Initial" in history, and are excluded from cost totals. |
| D-27 | Condition-based parts whose inspection period has elapsed are flagged "inspection due" and listed in Needs attention between Overdue and Due soon. |
| D-28 | From first launch, local reads and writes never depend on a valid token or an account. Account connection gates only sync and account actions (D-107). |
| D-29 | Odometer and service dates are stored as local calendar dates (YYYY-MM-DD). Sync timestamps are UTC. Each service record stores its own currency code, and the currency setting only supplies the default. |
| D-30 | Time intervals use calendar months. If the target month is shorter, the due date is its last day (31 Jan + 1 month = 28 or 29 Feb). |
| D-31 | A lower mileage stays rejected. Replacing the instrument cluster (mileage reset) is unsupported in the MVP and documented as a limitation. Closes OQ-03. |
| D-32 | First-time setup asks for the last-change km and, separately and optionally, the last-change date. No date is assumed: a known km with an unknown date shows the distance countdown and "date unknown" on the time side, and a time-only part without a date stays Unknown. Only "Mark as replaced" defaults to today. Closes OQ-10. |
| D-33 | Status is derived on read and never stored. Closes OQ-06. |
| D-34 | Hiding a part records its cause: `user` (the owner) or `profile` (a car-profile change). Restoring a profile returns only profile-hidden parts; re-adding any hidden part restores its history. Closes OQ-07. |
| D-35 | Sync conflicts: latest `updated_at` wins, tie broken by `origin_device_id`. |
| D-36 | Every cloud row is owned by a non-null authenticated `user_id`. The device working copy permits an unlinked local profile before connection (D-110). |
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
| D-62 | Supabase Auth uses email/password and Google through the system browser; the session is in secure storage. Local use needs no session. A signed-out profile retains its prior account marker for same-account reconnection; a different account requires an explicit local-profile wipe (D-109). |
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
| D-80 | The visible sync state is derived from profile connection state, network, session, dirty count and last result, never stored. `Not connected` applies to unlinked or deliberately signed-out profiles; linked profiles use Offline > Error > Pending > Synced. |
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
| D-107 | Local-only use is a complete Release 1 path: a fresh install creates one device-local profile and car without authentication. No local row is sent to Supabase until the owner explicitly connects an account. |
| D-108 | Release 1 provides explicit JSON backup/export from a consistent SQLite snapshot. It works offline, uses the platform Share/Save sheet, includes live maintenance data plus export metadata, and excludes credentials, account email, device identifiers, sync metadata and tombstones. Import is deferred. |
| D-109 | Account connection is safe and explicit. The app pulls before mutating cloud data: an empty account receives one atomic parent-first profile upload; an account with cloud data offers only Use cloud data or Cancel. Use cloud validates and stages the pull before atomically replacing the local profile; Cancel signs out and changes neither copy. |
| D-110 | Device and cloud ownership differ intentionally. The device holds exactly one local profile and supports unlinked, connecting, linked and signed-out states. Device rows may have no `user_id` before connection; cloud rows always require the authenticated `user_id` and RLS. |
| D-111 | Personal iPhone use is through sideloaded IPAs. Google Play is the only planned public distribution channel; App Store publication requires a future owner decision. |
| D-106 | `Clock.now()` is monotonic — never equal to or below the previous value, bumped by 1 ms on a tie — and `clock_offset_ms` is recomputed from the freshest `server_now` of either response. Three-digit milliseconds stay. |
