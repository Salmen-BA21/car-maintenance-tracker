# MVP-SCOPE.md: cut-down plan (approved 2026-11-02, see D-112 and D-113)

Goal: ship a working local-only app first, then add sync. This splits the PRD's Release 1 into **R1a (local MVP, build now)** and **R1b (account + sync, later)**. Nothing in the approved docs is deleted; sync-related parts are marked deferred, not removed. Decision IDs refer to `decisions.md`.

## 1. Features

| Build now (R1a) | Defer to R1b | Defer further |
|---|---|---|
| F-02 car profile, F-03 odometer, F-04 default parts, F-05 status, F-06 custom parts, F-07 replaced + history, F-08 first-time setup, F-09 home screen, F-10 mileage reminder, F-11 part alerts, F-12 offline (this is simply the app), F-14 settings (reminder on/off and time, currency, app version), F-15 JSON export (build last) | F-01 account connection, F-13 cloud sync | F-16 km/miles, F-17 French/Arabic, F-18 multi-car UI, F-19 ads, F-20 store release, F-21 delete account |

## 2. Decisions

**Keep (needed for the local app):** D-01, D-02 (local part), D-05 to D-15, D-20, D-21, D-25 to D-34, D-37 to D-45, D-47 to D-56, D-64, D-65, D-67, D-68, D-72, D-79, D-90, D-93, D-107, D-108.
Also D-69 and D-111 (iOS sideload, Play only) if you test on iPhone.

**Simplify (keep the intent, drop the machinery):**

| Decision | Proposed MVP version |
|---|---|
| D-24, D-63, D-91 notification window, 64-slot budget | Rebuild a fixed 7-day window of one-shot reminders on app open and mileage update, plus a "paused, open the app" notice. Part alerts first. Skip the 30-day window and slot-budget formula until real devices show a limit. |
| D-57 write path | Repository validates and writes in one transaction. No `sync_dirty` queue. |
| D-74, D-77, D-78, D-82, D-83, D-85 | One SQLite connection, plain module-level services, one function that runs after a write (invalidate queries, rebuild notifications). Keep the "screens call hooks, only one module touches the notification library" rule. No write gate, composition root, or formal event pipeline. |
| D-66 tests | Jest for the domain (status rules, dates, active record) and Node SQLite for migrations and queries. Add Maestro later. |
| D-19, D-40 schema | Keep UUID keys, `created_at`, `updated_at`, `deleted_at`. They are cheap now and painful to retrofit. Skip `user_id`, `origin_device_id`, `sync_seq`, `sync_dirty`, the `users` table and composite owner keys. Add them by migration in R1b (D-46 pattern). |

**Defer to R1b (sync and account):** D-03, D-04, D-23, D-35, D-36, D-58 to D-62, D-70, D-71, D-73, D-75, D-76, D-80, D-81, D-86 to D-89, D-92, D-94 to D-106, D-109, D-110.

**Defer further:** D-16 (units, languages, RTL), D-17 (ads), and the per-part "warn earlier" override in D-22.

## 3. Docs: what to read and what to skip for MVP work

Read (about 100 KB, roughly a third of the docs):
- PRD (all four parts), SRS `01-functional`, `01-discovery` only if scope is unclear
- DB parts 01 to 04 (`06-database/07-database-design/`)
- TRD parts 01, 02, 05 and the notifications section of 04
- SAD part 01 (layers and component catalog)
- `decisions.md`, using only the IDs listed under Keep and Simplify

Skip until R1b: TRD part 03, SAD part 03, DB part 05 and `schema/cloud.sql`, the whole API doc, TRD §8 to §10 and §13, spike S-01 items 1 to 4 and 8.

Do not write yet: security doc (09) beyond a short checklist, testing plan (11), deployment plan (12). For UI/UX (04), sketch the five screens (setup, home, part detail, mileage update, settings) instead of a full spec.

## 4. Suggested build order

1. Domain core: `LocalDate`, status engine, active-record rule (D-22, D-25, D-30, D-33, D-52, D-53) with Jest tests.
2. SQLite schema + migrations + seed (categories, part templates from PRD Appendix A).
3. Repositories and the single post-write function.
4. Screens: setup, home, part detail, mileage update.
5. Local notifications, tested on a real Android phone and iPhone (the one S-01 item worth keeping).
6. Settings, JSON export.
7. Update the docs from what the code taught you, then decide on R1b.

## 5. Risks of this cut

- The PRD, SRS and TRD say sync is Must for Release 1. Splitting R1 changes an approved decision, so record it as a new D-number.
- Adding sync later needs a migration for the dropped columns and a first-connect merge (D-109). That cost is real but smaller than building sync before knowing the app works.
- Cheap insurance kept: UUIDs, soft deletes, timestamps, and templates as data.
