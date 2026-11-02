# AGENTS.md

Car Maintenance Tracker (working title): React Native + Expo mobile app that tracks petrol/diesel car maintenance from odometer readings. Local-first (SQLite), optional Supabase backup and sync. Personal use first, public product later.

Status: documentation phase, no application code yet. Docs 01-03, 05-08 approved; 04 (UI/UX), 09-12 not started. Docs are in English.

## Rules for agents

- Do NOT read every doc. Read this file, then only the files the task needs (map below). Each doc folder has an index file listing its parts with sizes.
- Look facts up by ID instead of reading whole files: `grep -n "D-22" decisions.md`. IDs: `D` decision, `BR` business rule, `FR`/`NFR` requirement, `AC` acceptance criterion, `OQ` open question, `R` risk, `DB`/`T`/`AR`/`API` decisions local to a doc.
- Cross-references like "doc 07 §5.2" mean document number 07, section 5.2. Section numbers are stable across the split files.
- `decisions.md` is the authoritative register. If a doc and `decisions.md` disagree, `decisions.md` wins; report the conflict.
- Do not read `archive/` unless asked about history. Change logs and traceability tables live there.
- Editing an approved doc: bump its version and add a row to its changelog in `archive/`.

## Current scope

Building the local-only MVP (R1a) first; account and sync (R1b) are deferred. For MVP work, read `MVP-SCOPE.md` and skip the sync/auth/API docs it lists (TRD part 03, SAD part 03, DB part 05, `schema/cloud.sql`, the API doc). Status of that proposal: pending owner approval.

## Stack (details: 03-technical-specifications/05-trd/01-stack-targets-code.md)

TypeScript strict, React Native + Expo (dev builds), Expo Router, `expo-sqlite` with hand-written SQL repositories and Zod, Supabase (PostgreSQL, Auth, RLS) via `supabase-js`, React Hook Form, i18next, `expo-notifications` (local only), Jest and Maestro. Layering: `domain` imports nothing from React/Expo/SQLite; `data` imports `domain`; `sync`, `notifications`, `auth` import `data` and `domain`; screens stay thin.

## Core invariants (verify in decisions.md before relying on them)

- Odometer entries never decrease (D-05). Current odometer = `MAX(value_km)`, never stored.
- Replacing a part restarts its counters from the service km/date (D-06). Status is derived on read.
- Sync: records merge by UUID, latest update wins, soft deletes (D-23). Cloud writes go only through `push_rows`/`pull_rows`.
- Local use never requires an account (D-107). All notifications are local (D-11, D-24).

## Where to read, by task

| Task | Read |
|---|---|
| Scope, goals | `01-discovery/01-product-vision.md` |
| Features, user stories, business rules, MVP | `02-product-requirements/02-prd/` (parts 01-03) |
| Default parts catalog | `02-product-requirements/02-prd/04-appendix-a-default-parts.md` |
| Functional / non-functional requirements | `03-technical-specifications/03-srs/` |
| Stack, local data layer, auth, sync mechanics, notifications | `03-technical-specifications/05-trd/` |
| Components, execution model, runtime flows, sync engine | `05-architecture/06-system-architecture/` |
| Tables, derived values, seed data | `06-database/07-database-design/` |
| Cloud SQL (PostgreSQL DDL) | `schema/cloud.sql` |
| Client/server calls, errors, payloads | `07-api/08-api-specification/` |
| Why something was decided | the `*decisions*` part of that doc, or `decisions.md` |
| Open questions, risks, spike S-01 | `registers.md` |

`UI/UX`, security, roadmap, testing and deployment docs (04, 09-12) do not exist yet.
