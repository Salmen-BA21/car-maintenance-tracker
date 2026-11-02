# SRS · Non-functional requirements, constraints, dependencies

> Part of [03-srs.md](../03-srs.md). Sections: §3, §4, §5. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

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
