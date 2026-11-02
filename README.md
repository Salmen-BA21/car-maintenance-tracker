# Car Maintenance Tracker: Project Documentation

Working title (see OQ-05). Documentation language: English (D-20). Version 1.6, last updated 2026-11-01.

## 1. Project overview

A mobile app (Android and iOS, React Native/Expo) that tracks the maintenance of petrol and diesel cars from odometer readings. The owner enters the current mileage, and the app shows the remaining distance and time for every tracked part. Parts are grouped in categories, and the owner can always add custom parts. Data is stored on the device (SQLite) from first launch; connecting an account later enables Supabase backup and cross-device sync. The app is built for personal use first, with an architecture that can grow to a public product later.

## 2. Documentation index and status

| # | Document | Folder | Status |
|---|---|---|---|
| 01 | [Product Vision Document](01-discovery/01-product-vision.md) | 01-discovery | Approved v0.6 |
| 02 | [Product Requirements Document](02-product-requirements/02-prd.md) | 02-product-requirements | Approved v0.6 |
| 03 | [Software Requirements Specification](03-technical-specifications/03-srs.md) | 03-technical-specifications | Approved v0.7 |
| 04 | UI/UX Design Specification | 04-ui-ux-design | Not started |
| 05 | [Technical Requirements Document](03-technical-specifications/05-trd.md) | 03-technical-specifications | Approved v0.6 |
| 06 | [System Architecture Document](05-architecture/06-system-architecture.md) | 05-architecture | Approved v0.4 |
| 07 | [Database Design Document](06-database/07-database-design.md) | 06-database | Approved v0.6 |
| 08 | [API Specification](07-api/08-api-specification.md) | 07-api | Approved v0.4 |
| 09 | Security Requirements Document | 08-security | Not started |
| 10 | Project Development Roadmap | 09-project-planning | Not started |
| 11 | Testing and QA Plan | 10-testing | Not started |
| 12 | Deployment and Maintenance Plan | 11-deployment-maintenance | Not started |

Planned writing order: 08 API and 09 Security, then 04 UI/UX, then 10 to 12.

Numbering note: document numbers 01 to 12 are the reading order and appear in every file name. The folders come from the 11-folder template, so document 05 (TRD) sits in `03-technical-specifications`, 06 (Architecture) in `05-architecture`, and documents 07 to 12 one folder lower: 07 in `06-database`, 08 in `07-api`, 09 in `08-security`, 10 in `09-project-planning`, 11 in `10-testing`, 12 in `11-deployment-maintenance`. Every link is relative: keep the folder structure intact (clone the whole repository, not single files).

Identifier scheme used in every document: `F` feature, `US` user story, `BR` business rule, `AC` acceptance criterion, `FR`/`NFR` requirements, `C` constraint, `D` confirmed decision, `A` assumption, `OQ` open question, `R` risk, `SC` success criterion, `S` spike. Documents may add a local prefix for decisions proposed in them (`T` in doc 05, `DB` in doc 07, `AR` in doc 06, `CMP` for architecture components); those become `D` numbers only when approved.

## Where the registers moved

The old README sections were split so agents can load only what they need. Older references to "README §3" or "the README register" mean [decisions.md](decisions.md). Assumptions, open questions, spike S-01, risks and reviewer notes (old §4 to §8) are in [registers.md](registers.md). The README change log is in [archive/README-archive.md](archive/README-archive.md). Agents should start from [AGENTS.md](AGENTS.md).

---

## Contents

This file is the index. Open only the part you need.

| File | Contents | Sections | Size |
|---|---|---|---|
| [decisions.md](decisions.md) | Confirmed decisions register (authoritative) | §3 | 19.7 KB |
| [registers.md](registers.md) | Assumptions, open questions, spike S-01, risks, reviewer notes | §4, §5, §6, §7, §8 | 6.3 KB |
| [archive/README-archive.md](archive/README-archive.md) | Change log / traceability (archive, skip by default) | §9 | 6.1 KB |
