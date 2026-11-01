# 01 · Product Vision Document (PVD)

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, see OQ-05) |
| Version | 0.1 (draft) |
| Date | 2026-11-01 |
| Owner | Salmen Ben Ammar |
| Status | Draft, awaiting owner review |

**Legend.** *Confirmed* = approved by the owner (`D-xx`). *Assumption* = proposed by the documentation author, needs approval (`A-xx`). *Risk* = `R-xx`. *Open question* = `OQ-xx`. All registers are in [README](../README.md).

---

## 1. Product overview

A mobile app (Android and iOS) that tracks the maintenance of petrol and diesel cars from odometer readings (D-01, D-15).

The owner types the current mileage. The app recalculates, for every tracked part, how much distance and time remain before the next service. Parts are grouped in categories. The owner can always add custom parts (D-08). Service history is kept per part. Data lives on the phone and syncs to the cloud, so a new or second phone has the same data (D-02).

Example of the core behavior, after the owner enters a mileage that is 70 km above the last entry:

| Component | Maintenance interval | Remaining |
|---|---|---|
| Engine oil | 10,000 km | 9,930 km |
| Oil filter | 10,000 km | 9,930 km |
| Air filter | 15,000 km | 14,930 km |
| Brake pads | Condition-based | Inspection needed |
| Spark plugs | 30,000 km | 29,930 km |

## 2. Problem statement

- Service intervals are usually tracked from memory, on paper, or with generic calendar reminders.
- Distance-based intervals change with every drive, so the remaining distance is never visible at a glance.
- Some parts expire by time regardless of distance (oil, brake fluid, wipers, battery), so distance-only tracking misses them.
- Intervals differ between manufacturers and engines, so a fixed generic list is not enough. The owner needs to adjust values and add parts.
- Missing a service can cause avoidable wear or expensive failures (for example a timing belt).

## 3. Vision and objectives

**Vision.** Open the app, enter the mileage in seconds, and know exactly what the car needs next.

| ID | Objective |
|---|---|
| O-01 | After each odometer update, show remaining distance and/or time for every tracked part. |
| O-02 | Make updating the mileage fast and habitual, with a reminder (D-10). |
| O-03 | Keep a trustworthy service history per part (D-06, D-12). |
| O-04 | Stay flexible: custom parts, editable intervals, distance, time, or condition-based tracking (D-07, D-08). |
| O-05 | Work offline and survive a phone change or a second phone (D-02). |
| O-06 | Build for personal use first, with an architecture that can grow to a public product without a rewrite (D-19). Public-release features are not built now. |

## 4. Target audience

| Segment | Description | Priority |
|---|---|---|
| Primary | The owner: a technically capable petrol/diesel car owner who enters mileage manually. | Now |
| Secondary (future) | Everyday owners of petrol/diesel cars who are not mechanics. They need sensible defaults, plain language, and Arabic/French/English. | Only if public release goes ahead (D-17, D-19) |
| Not targeted | Fleet managers, garages/mechanics, EV and hybrid owners (D-15). | Won't |

## 5. Value proposition

| Benefit | How the product delivers it |
|---|---|
| Know what is due | Remaining distance/time per part after every update. |
| One source of truth | Service history per part with km, date, cost, notes (D-12). |
| Fits any car | Default parts by car profile, all editable, plus custom parts (D-08, D-09). |
| Safe data | Offline-first on device, synced to the cloud (D-02). |
| No hardware needed | Works from manual mileage entry. |

**Honest trade-off:** the app cannot read the odometer by itself. Its accuracy depends on the owner entering mileage, which is why the reminder is a core feature (D-10, D-11).

## 6. Product scope

| Area | Scope | Where defined |
|---|---|---|
| In scope, Release 1 (MVP) | Login, car profile, odometer updates and history, default and custom parts, status calculation, replacement with history, first-time setup, home screen, mileage reminder, part alerts, offline storage, cloud sync, settings. English, kilometres. | PRD §3 (F-01 to F-14) |
| Planned, Release 2 | Kilometres/miles setting, French and Arabic (right-to-left), data export, delete account and data. | PRD §3 (F-15, F-16, F-17, F-21) |
| Planned, Release 3 (public-release phase) | Multi-car interface, ads (AdMob) with paid removal, store release. | PRD §3 (F-18, F-19, F-20) |
| Out of scope | Automatic mileage reading, photos/receipts, fuel logs, garage records, EV/hybrid vehicles, web app. | PRD §3.2 |

The release split is a proposal pending confirmation in the roadmap (D-16, D-17 fix the order of delivery; exact release boundaries are confirmed in document 09).

## 7. Success criteria (proposed, to be confirmed)

| ID | Criterion |
|---|---|
| SC-01 | Updating the mileage takes under 15 seconds from opening the app. |
| SC-02 | Part statuses match a manual calculation in all test cases defined in the QA plan. |
| SC-03 | The owner updates the mileage at least weekly during the first 8 weeks of real use. |
| SC-04 | After signing in on a second device, the data appears within 1 minute. |
| SC-05 | No entered data is lost in offline, crash, and sync tests. |
| SC-06 | Spike S-01 passes, or the fallback backend is chosen, before the main build starts (D-03). |

## 8. Guiding principles

1. Simple first: the MVP stays small and practical.
2. Honest statuses: an unknown part stays "Unknown" until the owner supplies data (D-13).
3. Offline-first: the app never depends on a connection to record data (D-02).
4. Parts are data, not code, so defaults and custom parts behave the same (D-08).
5. No feature is added without owner approval.

## 9. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Turso offline sync and its Clerk (JWKS) login were labeled beta in the sources reviewed. | Core sync may be unstable. | One-day spike S-01 before commitment. Fallback: Supabase (D-03). |
| R-02 | If tokens are not scoped to one user's database, a token could reach other users' data. | Security flaw, critical for public release. | Scoped tokens/JWT templates, verified in the spike (see Security doc). |
| R-03 | The app depends on the owner entering mileage. | Statuses go stale. | Daily reminder (D-10), inspection prompts, time-based alerts (D-11). |
| R-04 | Default intervals vary by manufacturer. | A wrong default could mislead. | Defaults are editable, the timing belt and gearbox oil have no pre-filled value (D-09), the app states that the car's manual takes priority. |
| R-05 | iOS sideloading with a free Apple ID expires after about 7 days (as understood, to verify). | Interrupted use on iPhone. | Android as the main device; AltStore-style refresh; paid account only for public release (D-18). |
| R-06 | Free tiers and pricing of Clerk and Turso may change. | Cost or limits change. | Re-verify before public release. |
| R-07 | Scope: sync, three languages with right-to-left layout, and later ads. | Schedule risk. | Phased releases (D-16, D-17). |
