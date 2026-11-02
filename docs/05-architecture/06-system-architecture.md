# 06 · System Architecture Document (SAD)

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.4 (approved 2026-11-01; local-first connection amendment) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Related | [PVD](../01-discovery/01-product-vision.md), [PRD](../02-product-requirements/02-prd.md), [SRS](../03-technical-specifications/03-srs.md), [TRD](../03-technical-specifications/05-trd.md), [Database Design](../06-database/07-database-design.md), [README](../../README.md) |

**Conventions.** `AR-xx` labels an architectural decision in this document; the approved set maps in order onto README decisions `D-74` to `D-93`, exactly as `T-xx` became `D-54` to `D-72`. `D`, `A`, `OQ`, `FR`, `NFR`, `BR`, `C`, `R`, `AC` keep the meaning they have in the README, PRD and SRS. Paths such as `src/sync/engine.ts` name modules, not files that exist yet. No application source code is produced in the documentation phase; the snippets are illustrative contracts.

**Scope.** The runtime structure of the app: components and their boundaries, the execution and transaction model, the lifecycle of a process, the runtime flows that implement the PRD journeys, the sync state machine, where the notification scheduler sits, and how the system behaves when something fails. Document 04 owns screens, 08 owns endpoint payloads and error codes, 09 owns the threat model, 11 owns test cases and 12 owns build and release. This document is the bridge between the TRD's choices and the code that will be written from them.

**Position.** Documents 02, 03, 05 and 07 are approved. This document adds no new technology and no new data: it assigns responsibility, fixes the order of operations and states what each component may never do. Where it disagrees with an approved document, the disagreement is listed in §16 rather than silently resolved.

---

## Contents

This file is the index. Open only the part you need.

| File | Contents | Sections | Size |
|---|---|---|---|
| [06-system-architecture/01-drivers-context-components.md](06-system-architecture/01-drivers-context-components.md) | Drivers, system context, component decomposition | §1, §2, §3 | 10.8 KB |
| [06-system-architecture/02-execution-lifecycle-flows.md](06-system-architecture/02-execution-lifecycle-flows.md) | Execution model, process lifecycle, runtime flows AF-01..12 | §4, §5, §6 | 15.3 KB |
| [06-system-architecture/03-sync-engine-notifications.md](06-system-architecture/03-sync-engine-notifications.md) | Sync engine and notification scheduler | §7, §8 | 9.5 KB |
| [06-system-architecture/04-data-errors-security-seams.md](06-system-architecture/04-data-errors-security-seams.md) | Data ownership, errors, security, extension points, test seams | §9, §10, §11, §12, §13 | 10.3 KB |
| [06-system-architecture/05-decisions-followups.md](06-system-architecture/05-decisions-followups.md) | Decisions, open questions, follow-ups (rationale) | §14, §16 | 7.1 KB |
| [../archive/06-system-architecture-archive.md](../archive/06-system-architecture-archive.md) | Change log / traceability (archive, skip by default) | §15, §17 | 3.3 KB |
