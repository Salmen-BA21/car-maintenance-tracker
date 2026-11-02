# TRD · Inputs, stack, platforms, code organization

> Part of [05-trd.md](../05-trd.md). Sections: §1, §2, §3, §4. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 1. Inputs and constraints

| Source | Constraint | Technical consequence |
|---|---|---|
| D-01, D-02 | React Native and Expo; SQLite is the working copy | The UI reads and writes only SQLite. It never waits on the network. |
| D-03 (amended) | Supabase: PostgreSQL + Auth + RLS, one project | One shared cloud database; isolation is enforced by RLS, not by per-user databases. |
| D-04 | Email/password and Google sign-in | Supabase Auth provides both; no third-party identity broker. |
| D-18, OQ-02 | Direct APK on Android; sideloaded IPA on iPhone | Development and preview builds, never Expo Go. iOS testing uses IPA files (§14). |
| D-24, C-10 | 30-day reminder window, pending-notification limit, 8 reserved slots | One scheduler owns every notification and is budget-aware (§11). |
| D-28, BR-17, AC-21 | Local reads and writes never depend on a valid token | The database opens before authentication resolves. |
| D-29 | Calendar dates are local `YYYY-MM-DD`; sync timestamps are UTC | Calendar arithmetic never goes through a time-zone-aware date object. |
| D-35, D-40, D-47 | Row envelope, latest-update-wins merge, local reference data | The adapter carries seven synced tables and never touches reference tables. |
| D-39 | Cross-row rules live in the write path, not in triggers | One repository layer is the only local writer; one SQL function is the only cloud writer. |
| D-19 | Built for personal use, architected to scale | Versioned schema, templates as data and user-scoped rows from day one. |
| C-06 | A free Apple ID signature expires after about 7 days | The IPA is re-signed weekly; the pipeline is proven in S-01 item 6. |
| C-08, R-06 | Free tiers limit usage | Free-tier limits are recorded in §17 and re-checked before public release. |
| C-09 | One developer | No component that needs separate operational care in R1 (§18.1). |
| A-13, NFR-040 | Minimum OS versions decided here | Android 8.0 (API 26) and iOS 16 (§3). |

---

## 2. Technology stack

| Layer | Choice | Reason | Rejected |
|---|---|---|---|
| Language | TypeScript, `strict` | Shared types between domain, data and sync | Plain JavaScript |
| App framework | React Native with Expo, pinned stable SDK | D-01; native modules through config plugins | Bare React Native |
| Build mode | Development builds, continuous native generation (prebuild) | Notifications, secure storage and OAuth need native code | Expo Go |
| Navigation | Expo Router | File-based routes, deep links from a notification | React Navigation by hand |
| Local database | `expo-sqlite` | Official Expo module, WAL and PRAGMAs, change listener | WatermelonDB, op-sqlite |
| Data access | Repositories with hand-written SQL and Zod at the boundary | Document 07 relies on `CHECK`s, partial indexes and a custom merge that ORMs fight | Drizzle, Kysely, TypeORM |
| Backend | Supabase (PostgreSQL, Auth, RLS) | D-03 amended; one service, one project, server-side isolation | Turso + Clerk, Firebase |
| Cloud access | `@supabase/supabase-js` over HTTPS; two SQL functions for sync | No hand-written REST surface; the merge lives in the database | PostgREST upserts, packaged sync engines |
| Authentication | Supabase Auth; email/password and Google through the system browser | D-04; no native Google SDK, so no Play Services dependency | Own auth, Clerk |
| UI state | React state plus the SQLite change listener | The screen state is small; data is queried, not cached | Redux, Zustand, TanStack Query |
| Forms | React Hook Form with Zod | Reuses the same validators as the write path | Hand-rolled forms |
| Dates | Own `LocalDate` module (§7) | Removes time-zone and DST defects from calendar arithmetic | moment, `Date` arithmetic |
| IDs | `expo-crypto` `randomUUID()` | UUID v4 (D-40) | `uuid` package |
| Connectivity | `@react-native-community/netinfo` | Sync on network regain | Polling |
| Notifications | `expo-notifications`, local only | D-11, D-24 | Push notifications |
| i18n | `i18next` + `react-i18next` + `expo-localization` | English catalog from R1; plurals and RTL in R2 (D-16) | Hard-coded strings |
| Tests | Jest (`jest-expo`), Supabase CLI local stack, Node SQLite, Maestro | §14 | Detox |
| CI | GitHub Actions | Free tier is enough for one developer; macOS runner for the IPA | Self-hosted CI |

Expo SDK upgrades are deliberate: one bump per release, with a build, a smoke test on both phones and a reviewed changelog. The exact SDK version is frozen in `package.json` and written back into this table at approval; "latest stable" is not a specification.

---

## 3. Platform targets (closes A-13)

| Platform | Minimum | Reason |
|---|---|---|
| Android | 8.0 (API 26) | Notification channels exist from 8.0, and the reminder/alert split depends on them (§11). Newer runtime permissions (notifications from 13) are handled in context. |
| iOS | 16 | The sideloaded device is current, and a higher floor lowers the test matrix. |

The effective floor is the higher of this table and the pinned Expo SDK minimum, re-checked when the SDK is pinned (T-11).

- Phones in portrait only (NFR-041): orientation is locked in the app config.
- The only permission requested is notification permission, and only when the owner enables reminders or alerts (§11). No location, camera, contacts, storage or activity access.
- Tablet layouts and landscape are out of scope in R1.

---

## 4. Code organization

```
app/                  Expo Router screens (thin; no business rules)
src/domain/           Pure TypeScript: status engine, LocalDate, validators, money
src/data/             SQLite connection, migrations, repositories, row types
src/sync/             Cloud adapter, push/pull, clock, conflict reporting
src/notifications/    Scheduler, channels, permission handling
src/auth/             Supabase session, signed-in marker, deep-link callback
src/i18n/             Catalogs (en in R1)
src/ui/               Components, theme, accessibility helpers
```

Dependency rule: `domain` imports nothing from React, Expo or SQLite. `data` imports `domain` types. `sync`, `notifications` and `auth` import `data` and `domain`. Screens call hooks that call repositories. Violations fail an ESLint import-boundary rule.

This section fixes layering and dependency direction only; runtime components and their boundaries belong to document 06.
