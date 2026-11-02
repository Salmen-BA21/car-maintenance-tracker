# 07 · Database Design Document

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.6 (approved 2026-11-01; local-profile ownership amendment) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [PVD](../01-discovery/01-product-vision.md), [PRD](../02-product-requirements/02-prd.md), [SRS](../03-technical-specifications/03-srs.md), [README](../README.md) |

**Conventions.** `FR-xxx` and `NFR-xxx` come from the SRS, `BR-xx` and `D-xx` from the PRD and README. `DB-xx` is this document's schema label; every one maps to a confirmed decision in the README, `D-33` onward (§14.1). Table and column names are the canonical names used by document 08 (API) and the code.

**Scope.** This document defines the logical database: tables, columns, types, constraints, indexes, derived values, and the synchronization contract that sits on top of them. The *logical* schema is backend-neutral; the *device DDL* shown here is SQLite, because SQLite is the confirmed working copy (D-02). The *cloud* is one shared PostgreSQL database in Supabase (D-03, D-58), and its DDL is in §5.2. Engine choice and library selection are settled in the TRD; network endpoints in document 08; the sync engine's internal protocol in document 06.

---

## Contents

This file is the index. Open only the part you need.

| File | Contents | Sections | Size |
|---|---|---|---|
| [07-database-design/01-principles-conventions-entities.md](07-database-design/01-principles-conventions-entities.md) | Principles, conventions, entity overview | §1, §2, §3 | 5.4 KB |
| [07-database-design/02-tables.md](07-database-design/02-tables.md) | Table definitions (device) | §4 | 14.7 KB |
| [07-database-design/03-physical-settings.md](07-database-design/03-physical-settings.md) | Physical settings, device PRAGMAs, cloud notes (DDL in schema/cloud.sql) | §5 | 4.0 KB |
| [07-database-design/04-derived-queries-seed.md](07-database-design/04-derived-queries-seed.md) | Derived values, reference queries, seed data | §6, §7, §8 | 8.5 KB |
| [07-database-design/05-sync-migrations-lifecycle.md](07-database-design/05-sync-migrations-lifecycle.md) | Sync contract, migrations, data lifecycle, capacity | §9, §10, §11, §12 | 7.4 KB |
| [07-database-design/06-decisions.md](07-database-design/06-decisions.md) | Schema decisions DB-01..27, open questions, ownership amendment (rationale) | §14 | 5.9 KB |
| [../archive/07-database-design-archive.md](../archive/07-database-design-archive.md) | Change log / traceability (archive, skip by default) | §13, §15 | 4.3 KB |
