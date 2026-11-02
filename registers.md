# README · Assumptions, open questions, spike S-01, risks, reviewer notes

> Part of [README.md](README.md). Sections: §4, §5, §6, §7, §8. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 4. Assumptions

Approved by the owner on 2026-11-01 unless marked otherwise. IDs are kept (no renumbering) so that references in all documents stay valid.

| ID | Assumption | Status |
|---|---|---|
| A-01 | "Due soon" means remaining distance ≤ 10% of the interval, or remaining time ≤ 30 days. | Superseded by D-22 |
| A-02 | An odometer entry equal to the latest value is accepted and changes nothing. | Approved |
| A-03 | Odometer values are whole numbers from 0 to 9,999,999 km. | Approved |
| A-04 | A service date cannot be in the future, and a service km cannot exceed the current odometer. | Approved |
| A-05 | Distance-based statuses refresh when the odometer is updated or the app opens. An in-app notice appears when a part newly becomes Due soon or Overdue. | Approved |
| A-06 | Each part has an alert on/off setting, on by default for every part. A separate due-date notification still requires a time interval. | Approved (revised in doc 07 v0.4) |
| A-07 | Time intervals count calendar months from the service date. | Approved (clamping in D-30) |
| A-08 | The default reminder time is 20:00. | Approved |
| A-09 | The inspection prompt for a condition-based part is every 3 months by default, adjustable per part. | Approved |
| A-10 | Service records can be edited and deleted. The active record is the one with the highest service km. | Superseded by D-25 (edit and delete remain approved) |
| A-11 | The owner can create custom categories (Should Have, Release 2). | Approved |
| A-12 | Currency (for cost) is a user setting, defaulting to the device region. | Approved (per-record storage in D-29) |
| A-13 | Minimum Android and iOS versions are decided in the TRD. | Closed: see D-64 |
| A-14 | Deleting the account and data from the app is a Should Have (Release 2) and is required before public release. | Approved |
| A-15 | Sync conflicts: odometer entries and service records merge without loss. Other records use the latest update time. | Superseded by D-23 |
| A-16 | The owner can mark a condition-based part as "inspected", which stores the date and restarts its prompt cycle. | Approved |
| A-17 | Numeric performance targets in the SRS are proposals to be validated in testing. | Approved |

## 5. Open questions

| ID | Question | Decide in |
|---|---|---|
| OQ-01 | Closed: Supabase selected (D-58); there is no backend spike gate any more. | Closed |
| OQ-02 | How to produce the iOS IPA without a Mac or a paid Apple account (tested inside S-01). | Deployment plan |
| OQ-03 | Closed: see D-31. | Closed |
| OQ-04 | Monetization details for ad removal (one-time or subscription, price). | Release 3 |
| OQ-05 | Final app name. | All |
| OQ-06 | Closed: see D-33. | Closed |
| OQ-07 | Closed: see D-34. | Closed |
| OQ-08 | When does the multi-car interface arrive, and what does it need from the data model? | UI/UX, roadmap |
| OQ-09 | Application and bundle identifier. The name is undecided (OQ-05), so the identifier is a neutral placeholder; freeze it before the first build that stores real data (D-72). | Owner, before the first production build |
| OQ-10 | Closed: see D-32. | Closed |
| OQ-11 | Custom category with live parts: block deletion, or move its parts to "Uncategorized"? Proposed: block (doc 07). | Release 2, UI/UX |
| OQ-12 | Withdrawn: there is no provisioning component (D-71). | Closed |
| OQ-13 | Withdrawn: replaced by OQ-14 when the per-user database was dropped. | Closed |
| OQ-14 | Closed 2026-11-01: an outdated client refuses to sync, with no grace period (D-81). | Closed |
| OQ-15 | Keep the 64-notification design ceiling on Android, or use the higher Android limit and accept different behaviour per platform? | Testing (11), after S-01 item 7 |
| OQ-16 | Email confirmation on sign-up: required in production, disabled in development? | Owner, before S-01 |
| OQ-17 | Crash reporting: none in Release 1 (D-67), or a development-only Sentry project? | Deployment (12) |
| OQ-18 | Keep `select` grants on the synced tables for the security-invoker `pull_rows`, or revoke them and make `pull_rows` security-definer with an explicit `user_id` filter? The second shrinks the surface but moves the ownership check into the function. | Security (09) |

## 6. Spike S-01 (one day, gate before the main build)

Goal: prove that Supabase plus the Expo build pipeline carries the app before the main build starts (D-03, D-58). Retargeted on 2026-11-01; the Turso and Clerk items are gone.

1. Supabase Auth: email/password sign-up with confirmation, password reset, and Google through the system browser, in a development build on Android and iPhone (D-62).
2. RLS isolation with two accounts: A cannot read, write or infer B's rows, and a direct client write is refused (D-58, D-60).
3. Offline write on device, then sync, then read on a second device through `push_rows` and `pull_rows`.
4. The same record edited on two devices: latest update wins, and the loser is reported by the conflict notice (D-23, D-70).
5. Expired session and no network, then restart: local data is shown and editable, sync state Offline (AC-21).
6. An IPA built on a macOS runner, signed on Windows with the free Apple ID, installed, and re-signed after 7 days without losing data (D-69, OQ-02).
7. The rolling reminder window on real Android and iOS devices: delivery, skipping today after an update, the "paused" notice, the 64-slot budget with the real alert count, and behaviour after reboot, force-stop and reinstall (D-24, C-10, D-63).
8. `push_rows`/`pull_rows` latency and a full pull of the whole dataset on the free tier; free-project pause behaviour (R-09).

Pass criteria: items 1 to 5 work reliably. Items 6 to 8 decide the iOS routine, the notification mechanics and the free-tier limits.

## 7. Risks

The risk register is in [PVD §9](01-discovery/01-product-vision.md) (R-01 to R-15; R-01 and R-02 are closed).

## 8. Notes for the reviewer

- The release split used in the PRD (R1 MVP, R2 localization and export, R3 public release) is a proposal. It is confirmed in document 10.
- Default part intervals come from public maintenance guidance and vary by manufacturer. The car's manual always takes priority (BR-14).
- No application source code is produced during the documentation phase.
