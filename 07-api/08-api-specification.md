# 08 · API Specification

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.4 (approved 2026-11-01; account-claim amendment) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [SRS](../03-technical-specifications/03-srs.md), [TRD](../03-technical-specifications/05-trd.md), [SAD](../05-architecture/06-system-architecture.md), [Database Design](../06-database/07-database-design.md), [README](../README.md) |

**Conventions.** `API-xx` labels a decision in this document; the approved set maps in order onto README decisions `D-94` to `D-106`. `FR`, `NFR`, `C`, `BR`, `D`, `OQ` keep their meaning from the SRS, PRD and README; `AR-xx` and `DB-xx` are the labels of documents 06 and 07. Paths such as `src/sync/remote` name modules that do not exist yet. No application source code is produced in the documentation phase: the JSON and SQL below are contracts, not implementations.

**Scope.** The network surface between the app and Supabase: the two RPC functions, their payloads, the error vocabulary, the schema handshake, and the notification payload. It does not define the schema (document 07), the sync engine's state machine (document 06), the screens (document 04) or the threats (document 09).

**Position.** Documents 01, 02, 03, 05, 06 and 07 are approved. This document adds no new data and no new technology: it fixes the wire format of what those documents already decided, and where it disagrees with one of them the disagreement is listed in §12 rather than silently resolved.

---

## Contents

This file is the index. Open only the part you need.

| File | Contents | Sections | Size |
|---|---|---|---|
| [08-api-specification/01-surface-conventions-auth.md](08-api-specification/01-surface-conventions-auth.md) | Surface, conventions, authentication and transport | §1, §2, §3 | 4.7 KB |
| [08-api-specification/02-push-pull.md](08-api-specification/02-push-pull.md) | push_rows and pull_rows | §4, §5 | 7.6 KB |
| [08-api-specification/03-errors-handshake-clock-payloads.md](08-api-specification/03-errors-handshake-clock-payloads.md) | Errors, schema handshake, clock, notification payloads | §6, §7, §8, §9 | 8.8 KB |
| [08-api-specification/04-contract-tests.md](08-api-specification/04-contract-tests.md) | Contract tests | §10 | 1.6 KB |
| [08-api-specification/05-decisions-followups.md](08-api-specification/05-decisions-followups.md) | Decisions, open questions, follow-ups (rationale) | §12, §13 | 5.4 KB |
| [../archive/08-api-specification-archive.md](../archive/08-api-specification-archive.md) | Change log / traceability (archive, skip by default) | §11, §14 | 2.1 KB |
