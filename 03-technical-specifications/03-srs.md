# 03 · Software Requirements Specification (SRS)

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.7 (approved 2026-11-01; local-first connection and backup aligned with D-107 to D-111) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [PRD](../02-product-requirements/02-prd.md), [PVD](../01-discovery/01-product-vision.md), [README](../README.md) |

**Conventions.** `FR-xxx` functional, `NFR-xxx` non-functional, `C-xx` constraint. Priorities follow the PRD (Must = Release 1, Should = Release 2, Could = Release 3). "Shall" marks a requirement. Terms follow the PRD glossary. Technology-specific decisions belong to the TRD, not here, except where already confirmed (D-xx).

---

## 1. Scope

The system is a mobile application (Android, iOS) with a local database on the device and a cloud service for authentication and synchronization (D-01, D-02, D-03).

## 2. Functional requirements

### 2.1 Authentication (F-01)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-001 | The system shall let a user sign up with email and password. | Must | D-04, AC-15 |
| FR-002 | The system shall let a user sign in and sign out. | Must | D-04 |
| FR-003 | The system shall let a user sign in with a Google account. | Must | D-04 |
| FR-004 | The system shall keep the user signed in across app restarts, including while offline. | Must | AC-15, D-02 |
| FR-005 | The system shall provide a password reset flow for email/password accounts. | Must | D-04 (basic account need) |
| FR-006 | Local reads and writes shall never depend on a valid authentication token. Authentication shall gate only synchronization and account actions. | Must | D-28, BR-17 |
| FR-007 | The system shall let a fresh installation create and use one local profile and car without authentication. | Must | D-107 |
| FR-008 | Before any first upload, the system shall pull the chosen account's cloud data. An empty account requires explicit upload confirmation; an account with data offers only validated cloud replacement or cancellation. | Must | D-109 |

### 2.2 Car profile (F-02)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-010 | The system shall let the user create a car with: name (required), fuel type (petrol or diesel), timing drive (belt or chain), gearbox (manual or automatic), DPF (yes/no, diesel only), and current odometer (required). | Must | D-09, D-15 |
| FR-011 | The system shall let the user edit the car profile. Changing the profile shall add or hide default parts (BR-13), shall not restore a part the owner hid (D-34), and shall never delete service records. | Must | BR-13, D-34 |
| FR-012 | The data model shall support several cars per user. The Release 1 interface shall show one car. | Must | D-21 |

### 2.3 Odometer (F-03)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-020 | The system shall let the user enter the current odometer value as a new dated entry. | Must | US-03 |
| FR-021 | The system shall reject a value lower than the latest entry, show a message, and save nothing. An equal value shall be accepted and change nothing. | Must | BR-01, AC-01, A-02 |
| FR-022 | The system shall accept whole numbers from 0 to 9,999,999 (km). | Must | A-03 |
| FR-023 | The system shall list odometer entries, newest first. | Must | F-03 |
| FR-024 | The system shall let the user edit or delete the latest entry only, after confirmation. The last remaining entry shall not be deletable. | Must | BR-01 |
| FR-025 | The initial odometer entered at car creation shall be the first entry. | Must | F-02 |
| FR-026 | Odometer numbers shall be displayed with locale-appropriate thousands separators. | Must | NFR-072 |
| FR-027 | Odometer entries and service records shall store a local calendar date (YYYY-MM-DD). Synchronization timestamps shall be UTC. | Must | D-29, BR-18 |

### 2.4 Parts and categories (F-04, F-06)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-030 | The system shall ship a catalog of part templates grouped by category, as in PRD Appendix A. Templates shall be stored as data, not code. | Must | D-09, NFR-081 |
| FR-031 | The system shall create the car's default parts from templates according to the car profile. | Must | BR-13 |
| FR-032 | The system shall display parts grouped by category. | Must | D-08 |
| FR-033 | The system shall let the user add a custom part to any category with: name, interval type (distance, time, both, or condition-based), the interval values, and the alert setting. | Must | D-08, AC-11 |
| FR-034 | The system shall let the user edit the name and intervals of any part (default or custom). | Must | BR-14 |
| FR-035 | The system shall let the user hide a default part and delete a custom part. Service history of a deleted part shall be deleted with it, after confirmation. | Must | D-08, AC-17 |
| FR-036 | The system shall let the user add a hidden default template through "+ Add part". | Must | BR-13 |
| FR-037 | The system shall let the user create custom categories. | Should | A-11 |

### 2.5 Status calculation (F-05)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-040 | The system shall compute remaining distance as: distance interval − (current odometer − service km). | Must | BR-02, AC-02, AC-03 |
| FR-041 | The system shall compute due date as service date + interval in calendar months, clamped to the last day of the target month when it is shorter, and remaining days as due date − today. | Must | BR-03, A-07, D-30, AC-04 |
| FR-042 | For parts with both intervals, the status shall be the more urgent of the two. | Must | BR-04, AC-05 |
| FR-043 | A part without a service record shall have the status "Unknown". A time-only part whose service date is unknown, and a distance-only part whose service km is unknown, shall also have the status "Unknown". A part whose service km is known but whose service date is not shall show its distance countdown and the label "date unknown" on the time side, and cannot become Due soon or Overdue by time. Symmetrically, a part whose service date is known but whose service km is not shall show its time countdown and the label "km unknown" on the distance side, and cannot become Due soon or Overdue by distance. | Must | BR-05, BR-20, D-32, D-51, AC-07, AC-24 |
| FR-044 | A condition-based part shall have the status "Inspect" and no remaining value. It shall carry an "inspection due" flag when its inspection period has elapsed, counted from the latest of its last inspection, its last service record, and its creation. | Must | BR-05, BR-08, D-27, D-52, AC-06 |
| FR-045 | The status shall be Overdue if any remaining value ≤ 0, Due soon if remaining distance ≤ min(half the distance interval, 1,000 km) or remaining days ≤ min(30, half the days between the service date and the due date) (or the part's own "warn earlier" value), otherwise OK. | Must | BR-05, D-22, D-53, AC-23 |
| FR-046 | The system shall recompute statuses when the odometer changes, when the app opens or returns to the foreground, when the date changes, and when a part or service record changes. | Must | BR-10, A-05 |
| FR-047 | The system shall list parts that are Overdue, inspection due, or Due soon in a "Needs attention" list, in that order, each group ordered by urgency. | Must | D-14, D-27 |
| FR-048 | A part that has no interval value yet (timing belt, gearbox oil) shall show "Set interval". | Must | BR-12 |
| FR-049 | The user shall be able to set, per part, a "warn earlier" value (distance and/or days) that replaces the default Due soon threshold. It shall remain below the part's interval. | Should | D-22 |

### 2.6 Service records (F-07)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-050 | The system shall offer "Mark as replaced" with fields: km at service (required, default current odometer), date (required, default today), cost (optional), notes (optional). | Must | D-12, D-06 |
| FR-051 | The system shall reject a service km above the current odometer and a service date in the future. | Must | BR-07, A-04, AC-12 |
| FR-052 | On save, the part's counters shall restart from the service km and date. Earlier records shall remain as history. | Must | BR-06, AC-03 |
| FR-053 | The system shall show the service history of each part. Baseline records shall appear as "Initial" and be excluded from cost totals. | Must | D-12, D-26 |
| FR-054 | The system shall let the user edit and delete service records. The active record shall be the one with the greatest service date, ties broken by the greatest service km; records with an unknown date rank after dated records. Both counters shall restart from it. | Must | D-25, D-42, BR-07, AC-18 |
| FR-055 | The system shall let the user mark a condition-based part as inspected, storing the date. | Must | A-16, BR-08 |
| FR-056 | A service record with a cost shall store its own currency code, chosen at save time. | Must | D-29, BR-18 |

### 2.7 First-time setup (F-08)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-060 | After car creation, the system shall show the default parts and let the user enter the last-change km and, separately and optionally, the last-change date per part. Entries are saved as baseline records. The setup date shall not default to today. | Must | D-13, D-26, D-32, BR-16, AC-24 |
| FR-061 | A skipped part shall show "Unknown, check it" until the user enters a value. | Must | D-13, AC-07 |
| FR-062 | The system shall offer a bulk action "all serviced today" that creates a baseline service record with km = current odometer and date = today for every part. | Must | D-13, D-26, AC-08 |
| FR-063 | The user shall be able to enter the last-change km later from the part detail. | Must | D-13 |

### 2.8 Home screen (F-09)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-070 | The home screen shall show the car name, the current odometer, and an "Update mileage" button. | Must | D-14 |
| FR-071 | The home screen shall show the "Needs attention" list, hidden when empty. | Must | D-14, FR-047 |
| FR-072 | The home screen shall show collapsible categories, each listing its parts with remaining value, status, and progress. | Must | D-14 |
| FR-073 | Every category shall contain a "+ Add part" row. | Must | D-08, D-14 |
| FR-074 | Tapping a part shall open its detail with "Mark as replaced", intervals, alert setting, and history. | Must | D-14 |
| FR-075 | Status shall be conveyed by text or icon as well as color. | Must | NFR-060 |

### 2.9 Reminders and alerts (F-10, F-11, F-14)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-080 | The system shall schedule a daily local notification at the user-chosen time (default 20:00) asking to update the mileage. | Must | D-10, A-08 |
| FR-081 | The system shall not show today's reminder if the odometer was updated that day (mechanism in FR-086). | Must | BR-09, AC-09 |
| FR-082 | The reminder shall summarise the parts that are inspection due, Due soon, or Overdue as a count plus the single most urgent item, because notification text is truncated. Inspection, due, and overdue lines cover only parts whose alert setting is switched on (D-49). Inspection lines cover condition-based parts whose inspection period has elapsed, counted from the latest of the last inspection, the last service record, and creation (D-52). | Must | BR-08, A-09, A-06, D-49, D-52, AC-10 |
| FR-083 | The user shall be able to turn the reminder off and change its time. | Must | D-10 |
| FR-084 | Tapping the reminder shall open the mileage entry. | Must | D-10 |
| FR-085 | The system shall request notification permission and explain what happens if it is denied. | Must | D-11, AC-20 |
| FR-086 | The system shall keep about 30 days of reminders scheduled as one-shot local notifications, rebuild that window on every app open and every mileage update (omitting today's reminder after an update), and end the window with a notification saying that reminders are paused until the app is opened. When the pending-notification limit is reached, reminder slots are reduced first: the window never drops below 7 days plus the paused notice (8 slots), and those 8 slots are never taken by part alerts. | Must | D-24, C-10 |
| FR-090 | Each part shall have an alert setting, on by default for every part. | Must | BR-10, A-06 |
| FR-091 | For parts with a time interval and alerts on, the system shall schedule local notifications for the Due soon date and the due date, for the nearest dates first; the rest are added as the notification window is rebuilt. No notification is scheduled for the overdue state; overdue parts appear in the daily reminder instead (FR-082). | Must | D-11, AC-16 |
| FR-092 | Scheduled notifications shall be rescheduled when a part, a service record, or the date settings change. | Must | FR-091 |
| FR-093 | After an odometer update, the system shall show an in-app notice listing parts that newly became Due soon or Overdue. | Must | A-05 |
| FR-094 | All notifications shall be local. The system shall not require a push server. | Must | D-11, C-05 |

### 2.10 Offline storage and sync (F-12, F-13)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-100 | The system shall store all data in a local database on the device and perform all reads and writes against it first. | Must | D-02, AC-13 |
| FR-101 | The system shall synchronize local changes with the cloud when a connection is available, without user action. Synchronization serves backup, restore, and refresh when the app opens or returns to the foreground. | Must | D-02, D-23, AC-14 |
| FR-102 | Cloud data shall be isolated per user. A user's credentials shall give access only to that user's data. | Must | BR-15, D-19, R-02 |
| FR-103 | Synchronization shall merge records by UUID. When the same record changed on several devices, the version with the latest update time shall win. Deletions shall be soft deletes so that they propagate. | Must | D-23, BR-19 |
| FR-104 | After signing in on a new device, the system shall download the user's data. | Must | AC-14, AC-19, US-14 |
| FR-105 | The system shall show the sync state (synced, pending, offline, error). | Must | FR-101 |
| FR-106 | Every syncable record shall carry a UUID key, a creation time, an update time, and a deletion time (empty while the record exists). `users.id` and local reference rows are the exceptions (D-40). | Must | D-19, D-23, D-40, NFR-082 |
| FR-107 | The visible sync state shall be Not connected for unlinked or signed-out profiles. A sync pass shall not run until the profile is linked to an account. | Must | D-80, D-110 |

### 2.11 Settings (F-14)

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-110 | Settings shall include: reminder on/off and time, account email and sign out, currency, app version. | Must | D-10, A-12 |
| FR-111 | The currency setting shall default to the device region, be changeable, and supply the default for new service records without changing existing ones. | Must | A-12, D-29 |
| FR-112 | Settings shall offer explicit JSON backup/export through the operating system Share/Save sheet. It shall work offline from a consistent local snapshot and shall not change data. | Must | D-108 |

### 2.12 Release 2 and 3 requirements

| ID | Requirement | Priority | Refs |
|---|---|---|---|
| FR-120 | The system shall later add CSV export and import. | Should | F-15 |
| FR-130 | The system shall let the user choose km or miles. Values shall be stored in km and converted for display. | Should | F-16, BR-11 |
| FR-131 | The system shall provide English, French and Arabic. | Should | F-17, D-16 |
| FR-132 | The Arabic interface shall use a right-to-left layout. | Should | F-17 |
| FR-140 | The system shall let the user delete their account and all associated data. | Should | F-21, A-14 |
| FR-150 | The system shall show AdMob ads to free users. | Could | F-19, D-17 |
| FR-151 | The system shall offer a paid option to remove ads. | Could | F-19, D-17, OQ-04 |
| FR-152 | The system shall meet store publication requirements for Google Play. | Could | F-20, D-111 |
| FR-160 | The interface shall let the user switch between several cars. | Could | F-18, D-21 |

## 3. Non-functional requirements

Numeric targets are proposals (A-17) to be validated in testing.

### 3.1 Performance

| ID | Requirement | Priority |
|---|---|---|
| NFR-001 | Cold start to a usable home screen shall take 2 seconds or less on a mid-range phone. | Must |
| NFR-002 | After an odometer update, all statuses shall be recalculated and shown within 500 ms for up to 100 parts. | Must |
| NFR-003 | A typical change shall reach the cloud within 5 seconds on a normal connection. | Must |

### 3.2 Reliability and offline

| ID | Requirement | Priority |
|---|---|---|
| NFR-010 | All Must Have functions except account connection and sync shall work offline, including first car setup and JSON export. | Must |
| NFR-011 | Writes shall be transactional so that an app crash or kill never loses a confirmed entry or leaves a half-saved record. | Must |
| NFR-012 | Synchronization shall be retried automatically and be safe to repeat (idempotent). | Must |

### 3.3 Security

| ID | Requirement | Priority |
|---|---|---|
| NFR-020 | All network traffic shall use TLS. | Must |
| NFR-021 | Per-user isolation shall be enforced by server-side credentials, not only by app logic. Tokens shall be scoped to the user's own data. | Must |
| NFR-022 | Authentication tokens shall be kept in the platform secure storage (Keychain/Keystore). | Must |
| NFR-023 | The app bundle shall contain no private secrets. Only public keys are allowed. | Must |
| NFR-024 | Passwords shall be handled by the authentication provider and never stored by the app. | Must |
| NFR-025 | The local database shall rely on operating-system storage protection. Additional app-level encryption is not required in this version. | Must |

### 3.4 Privacy

| ID | Requirement | Priority |
|---|---|---|
| NFR-030 | The system shall store only the data needed: account email, car data, odometer entries, parts, service records, and settings. | Must |
| NFR-031 | Export and deletion of user data shall be available (FR-120, FR-140). | Should |
| NFR-032 | A privacy policy shall be published before any public release. | Could |

### 3.5 Compatibility

| ID | Requirement | Priority |
|---|---|---|
| NFR-040 | Minimum Android and iOS versions shall be set in the TRD (A-13). | Must |
| NFR-041 | The layout shall target phones in portrait. Tablets are not targeted. | Must |
| NFR-042 | The app shall be built as a development/production build, not Expo Go, because native Google sign-in needs native modules. | Must |

### 3.6 Usability and accessibility

| ID | Requirement | Priority |
|---|---|---|
| NFR-050 | The mileage entry shall be reachable in at most 3 taps from the home screen and 1 tap from the reminder. | Must |
| NFR-060 | Status shall never rely on color alone. Text scaling, sufficient contrast, and screen-reader labels shall be supported. | Must |

### 3.7 Localization

| ID | Requirement | Priority |
|---|---|---|
| NFR-070 | All user-visible text shall be externalized from the first release, even though only English ships in Release 1. | Must |
| NFR-071 | The layout shall mirror correctly for right-to-left languages. | Should |
| NFR-072 | Dates, numbers, and currency shall follow the locale. | Must |

### 3.8 Maintainability and scalability

| ID | Requirement | Priority |
|---|---|---|
| NFR-080 | The database schema shall be versioned with migrations on device and in the cloud. | Must |
| NFR-081 | Part templates shall be data, so a template change is a seed migration rather than a code change. | Must |
| NFR-082 | Syncable records shall use UUID keys and timestamps so sync and later growth need no schema rewrite; reference rows and `users.id` are excepted (D-40). | Must |
| NFR-083 | Sync and authentication shall sit behind an interface, so the backend can be replaced without touching features. | Must |

## 4. System constraints

| ID | Constraint | Source |
|---|---|---|
| C-01 | The app is built with React Native and Expo. | D-01 |
| C-02 | A local SQLite database is the working copy on the device. | D-02 |
| C-03 | Backend: one Supabase project providing PostgreSQL, authentication and row-level security. Isolation is a row-level policy, not a per-user database. | D-03, D-58 |
| C-04 | The app cannot read mileage in the background. | D-11 |
| C-05 | Notifications are local only. | D-11 |
| C-06 | iOS runs through a sideloaded IPA. With a free Apple ID the signature expires after about 7 days (to verify). Remote push is unavailable without a paid account. | D-18, R-05 |
| C-07 | Native Google sign-in requires a development build. | NFR-042 |
| C-08 | Free tiers of external services limit usage. Limits must be re-checked before public release. | R-06 |
| C-09 | One developer builds and maintains the app. | Owner |
| C-10 | Platforms limit the number of pending local notifications (about 64 on iOS and 500 on Android, to be verified in S-01). Part alerts take priority over the reminder window, which shrinks to 7 days plus the paused notice (8 reserved slots). | D-24 |

## 5. External dependencies

| Dependency | Purpose | Status |
|---|---|---|
| Supabase (PostgreSQL, Auth, Row Level Security) | Cloud database, authentication and per-row isolation in one project | Selected (D-03, D-58); proven in S-01 |
| Expo SQLite, Notifications, SecureStore | Local database, local notifications, token storage | Planned |
| Google Sign-In (via the auth provider) | Google login | Planned |
| Google AdMob | Ads | Release 3 only (D-17) |
| Google Play | Public publication | Release 3 only (D-111) |

## 6. Traceability: features to requirements

| Feature | Functional requirements |
|---|---|
| F-01 Authentication | FR-001 to FR-006 |
| F-02 Car profile | FR-010 to FR-012 |
| F-03 Odometer | FR-020 to FR-027 |
| F-04, F-06 Parts and custom parts | FR-030 to FR-037 |
| F-05 Status | FR-040 to FR-049 |
| F-07 Service records | FR-050 to FR-056 |
| F-08 First-time setup | FR-060 to FR-063 |
| F-09 Home screen | FR-070 to FR-075 |
| F-10, F-11 Reminders, alerts | FR-080 to FR-094 |
| F-12, F-13 Offline, sync | FR-100 to FR-106 |
| F-14 Settings | FR-110, FR-111 |
| F-15 Export | FR-120 |
| F-16, F-17 Units, languages | FR-130 to FR-132 |
| F-21 Delete account | FR-140 |
| F-19 Ads | FR-150, FR-151 |
| F-20 Store release | FR-152 |
| F-18 Multi-car | FR-012, FR-160 |
