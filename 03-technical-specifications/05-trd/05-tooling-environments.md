# TRD · Tooling, testing, delivery, environments

> Part of [05-trd.md](../05-trd.md). Sections: §14, §15. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 14. Tooling, testing and delivery

| Topic | Decision |
|---|---|
| Code quality | TypeScript `strict`, ESLint with import boundaries, Prettier, a pre-commit hook running lint and type check. |
| Unit tests | Jest on `domain`: every pure-logic acceptance criterion (AC-01 to AC-08, AC-10, AC-12, AC-18, AC-23, AC-24), plus month-end, leap-year and day-boundary cases. The clock is injected. |
| SQL tests | The same migration modules run against a Node SQLite database (`better-sqlite3`): every `CHECK`, the active-record query, the home query, the odometer guards including D-50, seed idempotency, and an upgrade fixture that applies v1…vN in order. |
| Cloud tests | The Supabase CLI local stack in CI: `push_rows`/`pull_rows` round trips, replay, out-of-order timestamps, a row changed during a pull, and **two accounts proving RLS**: user A cannot select, insert or update user B's rows, and cannot bypass the functions with a direct write. |
| Sync tests | Two device databases and one local cloud: concurrent edits, a device offline with older timestamps, a rejected push followed by a pull that restores the winner, and a conflict notice. |
| End-to-end | Maestro flows on an Android device or emulator: first launch (J-01), mileage update (J-02), replace a part (J-03), airplane-mode write (AC-13). Maestro has no iOS route from Windows; iOS flows are manual (§17). |
| Real-device checks | Notifications (AC-09, AC-16, AC-20, AC-22), sign-in, and accessibility (NFR-060: font scaling, screen reader, contrast) are verified manually on both phones. |
| CI | GitHub Actions: lint, type check, unit, SQL and cloud tests on every push. |
| Android build | Local Gradle, or EAS Build if local fails. Direct APK install (D-18). |
| iOS delivery | R1 tests with **IPA files** (owner decision): an unsigned build on a macOS CI runner, downloaded and signed on Windows with Sideloadly or AltServer using the free Apple ID, then installed. Re-signed every 7 days (C-06). EAS-managed iOS credentials require a paid account and are out of scope for R1. |
| Versioning | `version` for the user, `android.versionCode` and `ios.buildNumber` incremented per build, tags per build. No OTA updates in R1 (T-15): every change ships as a new build. |
| Performance gate | 100-part fixture: home query plus status computation within 500 ms after an update (NFR-002), and cold start within 2 s (NFR-001) on the oldest supported phone. |

---

## 15. Environments and configuration

| Environment | Backend | Purpose |
|---|---|---|
| `dev` | A second Supabase project (or the local CLI stack) | Development, S-01 and destructive tests |
| `prod` | The production project | The owner's real data |

Configuration reaches the app only as public build-time variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The service-role key exists only in the developer's shell and CI secrets and is never bundled (NFR-023).

The bundle identifier and the URL scheme are single constants in `app.config.ts` (T-19). Nothing else in the code refers to them by literal.

The product name is still open (OQ-05), so the identifier stays a **neutral placeholder**, not one derived from the working title. Changing it is not free but is not a rewrite:

- A new identifier is a **new app** on the phone: fresh local database, fresh keychain entry, and the old install must be removed by hand.
- Cloud data is unaffected. Signing in on the new identifier pulls everything back from cursor 0 (FR-104, AC-19).
- The identifier must therefore be frozen before the first build that holds data the owner would miss. The development build appends `.dev` to it so both can coexist.

The URL scheme used by the Google redirect and by notification deep links (`carmaint://`) is separate from the identifier, is not a store identity, and **is frozen now**, because it has to be allowlisted in Supabase and baked into the scheduled notifications.
