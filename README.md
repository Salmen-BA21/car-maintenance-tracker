# Car Maintenance Tracker: Project Documentation

Working title (see OQ-05). Documentation language: English (D-20). Last updated: 2026-11-01.

## 1. Project overview

A mobile app (Android and iOS, React Native/Expo) that tracks the maintenance of petrol and diesel cars from odometer readings. The owner enters the current mileage, and the app shows the remaining distance and time for every tracked part. Parts are grouped in categories, and the owner can always add custom parts. Data is stored on the device (SQLite) and synced to the cloud. The app is built for personal use first, with an architecture that can grow to a public product later.

## 2. Documentation index and status

| # | Document | Folder | Status |
|---|---|---|---|
| 01 | [Product Vision Document](01-discovery/01-product-vision.md) | 01-discovery | Draft v0.1, awaiting review |
| 02 | [Product Requirements Document](02-product-requirements/02-prd.md) | 02-product-requirements | Draft v0.1, awaiting review |
| 03 | [Software Requirements Specification](03-technical-specifications/03-srs.md) | 03-technical-specifications | Draft v0.1, awaiting review |
| 04 | UI/UX Design Specification | 04-ui-ux-design | Not started (batch 2) |
| 05 | Technical Requirements Document | 03-technical-specifications | Not started (batch 2, after spike S-01 plan) |
| 06 | System Architecture Document | 05-architecture | Not started (batch 2) |
| 07 | Database Design Document | 06-database | Not started (batch 2) |
| 08 | API Specification | 07-api | Not started (batch 2) |
| 09 | Security Requirements Document | 08-security | Not started (batch 2) |
| 10 | Project Development Roadmap | 09-project-planning | Not started (batch 3) |
| 11 | Testing and QA Plan | 10-testing | Not started (batch 3) |
| 12 | Deployment and Maintenance Plan | 11-deployment-maintenance | Not started (batch 3) |

Identifier scheme used in every document: `F` feature, `US` user story, `BR` business rule, `AC` acceptance criterion, `FR`/`NFR` requirements, `C` constraint, `D` confirmed decision, `A` assumption, `OQ` open question, `R` risk, `SC` success criterion, `S` spike.

## 3. Confirmed decisions (approved by the owner)

| ID | Decision |
|---|---|
| D-01 | Mobile app for Android and iOS, built with React Native and Expo. |
| D-02 | Local-first: SQLite on the device is the working copy. Cloud sync is part of the MVP. |
| D-03 | Backend: Turso (sync) with Clerk (authentication), conditional on spike S-01. Fallback: Supabase. |
| D-04 | Login methods: email/password and Google. |
| D-05 | Odometer entries must not decrease. A lower value is rejected. |
| D-06 | Replacing a part restarts its counters from the km and date of service. History is kept. Example: replaced at 320,000 km with a 70,000 km interval, at 340,000 km it shows 50,000 km left. |
| D-07 | A part can have a distance interval, a time interval, both (whichever comes first), or be condition-based. |
| D-08 | Parts are grouped in categories. The owner can always add custom parts. |
| D-09 | The default parts list (PRD Appendix A) is approved and shown according to the car profile (fuel, belt/chain, gearbox, DPF). The timing belt and the gearbox oil have no pre-filled interval (the owner enters it from the manual). |
| D-10 | Mileage reminder: daily at a user-chosen time, skipped if the mileage was already updated that day, with periodic inspection prompts for condition-based parts. |
| D-11 | Alerts only for time-sensitive parts (e.g. engine oil). No background mileage tracking. All notifications are local. |
| D-12 | Service form: km (required), date (required), cost (optional), notes (optional). |
| D-13 | First setup asks for the last-change km per part. Skipped parts show "Unknown, check it". A bulk "all serviced today" action exists. |
| D-14 | Home screen: car header with odometer and Update mileage button, Needs attention list, collapsible categories with "+ Add part", part detail with Mark as replaced and history. |
| D-15 | Vehicles: petrol and diesel cars only. |
| D-16 | The product supports English, French and Arabic (right-to-left) and km/miles, delivered after the core MVP. |
| D-17 | Ads (AdMob) with paid removal belong to the public-release phase only. |
| D-18 | iOS for personal use through a sideloaded IPA, Android installed directly. Store releases happen in the public-release phase. |
| D-19 | Architecture is designed to scale (user-scoped data, UUID keys, timestamps, versioned schema, templates as data) while building for personal use first. |
| D-20 | Documentation language is English. |
| D-21 | Multi-car is supported by the data model from the start. The MVP interface shows one car. |

## 4. Assumptions awaiting approval

These are proposals by the documentation author. Please approve or change each one.

| ID | Assumption |
|---|---|
| A-01 | "Due soon" means remaining distance ≤ 10% of the distance interval, or remaining time ≤ 30 days. |
| A-02 | An odometer entry equal to the latest value is accepted and changes nothing. |
| A-03 | Odometer values are whole numbers from 0 to 9,999,999 km. |
| A-04 | A service date cannot be in the future, and a service km cannot exceed the current odometer. |
| A-05 | Distance-based statuses refresh when the odometer is updated or the app opens. An in-app notice appears when a part newly becomes Due soon or Overdue. |
| A-06 | Each part has an alert on/off setting, on by default for parts with a time interval. |
| A-07 | Time intervals count calendar months from the service date. |
| A-08 | The default reminder time is 20:00. |
| A-09 | The inspection prompt for a condition-based part is every 3 months by default, adjustable per part. |
| A-10 | Service records can be edited and deleted. The active record of a part is the one with the highest service km. |
| A-11 | The owner can create custom categories (Should Have, Release 2). |
| A-12 | Currency (for cost) is a user setting, defaulting to the device region. |
| A-13 | Minimum Android and iOS versions are decided in the TRD. |
| A-14 | Deleting the account and data from the app is a Should Have (Release 2) and is required before public release. |
| A-15 | Sync conflicts: odometer entries and service records merge without loss. Other records use the latest update time. |
| A-16 | The owner can mark a condition-based part as "inspected", which stores the date and restarts its prompt cycle. |
| A-17 | Numeric performance targets in the SRS are proposals to be validated in testing. |

## 5. Open questions

| ID | Question | Needed for |
|---|---|---|
| OQ-01 | Result of spike S-01 (see below). Decides Turso + Clerk or the Supabase fallback. | TRD, SAD, Database, API |
| OQ-02 | How to produce the iOS IPA without a Mac or a paid Apple account (to be tested inside S-01). | Deployment plan |
| OQ-03 | How to handle a legitimate mileage decrease (instrument cluster replacement). Current rule rejects it (BR-01). Proposed: out of the MVP. | PRD, QA |
| OQ-04 | Monetization details for ad removal (one-time or subscription, price). | Release 3 |
| OQ-05 | Final app name. | All |

## 6. Spike S-01 (one day, gate before the main build)

Goal: prove that Turso with Clerk works for this app, or choose the Supabase fallback (D-03).

1. Clerk email/password and Google sign-in in an Expo development build, on Android and iOS.
2. A Turso token issued through Clerk and restricted to one user's database only (R-02).
3. Offline write on device, then sync, then read on a second device.
4. The same record edited on two devices (conflict behavior, A-15).
5. Per-user database creation at sign-up.
6. Producing the iOS IPA and installing it by sideloading (OQ-02).

Pass criteria: items 1 to 5 work reliably. Item 6 only decides the iOS install method.

## 7. Risks

The risk register is in [PVD §9](01-discovery/01-product-vision.md) (R-01 to R-07).

## 8. Notes for the reviewer

- Release split used in the PRD (R1 MVP, R2 localization and export, R3 public release) is a proposal. It is confirmed in document 10.
- Default part intervals come from public maintenance guidance and vary by manufacturer. The car's manual always takes priority (BR-14).
- No application source code is produced during the documentation phase.
