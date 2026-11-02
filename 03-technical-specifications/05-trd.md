# 05 · Technical Requirements Document (TRD)

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.6 (approved 2026-11-01; local-profile connection amendment) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [PVD](../01-discovery/01-product-vision.md), [PRD](../02-product-requirements/02-prd.md), [SRS](03-srs.md), [Database Design](../06-database/07-database-design.md), [README](../README.md) |

**Conventions.** `T-xx` labels a technical decision proposed in this document. On approval each one is promoted to a README decision (`D-54` onward), exactly as `DB-xx` became `D-33` to `D-53` in document 07. `D`, `A`, `OQ`, `FR`, `NFR`, `BR`, `C`, `R`, `S` and `AC` keep the meaning they have in the README, PRD and SRS. Items marked **[S-01]** are validated in the spike (§18.4).

**Scope.** This document closes A-13 (minimum OS versions), chooses libraries, and defines the mechanics that turn documents 02, 03 and 07 into code: local data layer, domain core, authentication, the sync adapter, notifications, tooling and testing. It does not define component boundaries (document 06), endpoint contracts (08), the threat model (09) or release procedures (12). No application source code is produced in the documentation phase; the snippets below are illustrative contracts.

**Change from v0.1.** The owner selected **Supabase** on 2026-11-01: PostgreSQL, authentication and row-level security in one service, with no per-user database and no provisioning server. That replaces Turso with Clerk (D-03) and removes spike S-01's original gate. The consequences are listed in §18.1 and §18.5, and the spike is retargeted in §18.4.

---

## Contents

This file is the index. Open only the part you need.

| File | Contents | Sections | Size |
|---|---|---|---|
| [05-trd/01-stack-targets-code.md](05-trd/01-stack-targets-code.md) | Inputs, stack, platforms, code organization | §1, §2, §3, §4 | 6.4 KB |
| [05-trd/02-data-identity-domain.md](05-trd/02-data-identity-domain.md) | Local data layer, identifiers, domain core | §5, §6, §7 | 6.1 KB |
| [05-trd/03-auth-cloud-sync.md](05-trd/03-auth-cloud-sync.md) | Authentication, cloud schema, synchronization mechanics | §8, §9, §10 | 10.1 KB |
| [05-trd/04-notifications-security-engines.md](05-trd/04-notifications-security-engines.md) | Notifications, security notes, SQLite/PostgreSQL notes | §11, §12, §13 | 5.7 KB |
| [05-trd/05-tooling-environments.md](05-trd/05-tooling-environments.md) | Tooling, testing, delivery, environments | §14, §15 | 4.0 KB |
| [05-trd/06-risks-decisions.md](05-trd/06-risks-decisions.md) | Risks introduced, decisions and open questions (rationale) | §17, §18 | 10.5 KB |
| [../archive/05-trd-archive.md](../archive/05-trd-archive.md) | Change log / traceability (archive, skip by default) | §16, §19 | 3.7 KB |
