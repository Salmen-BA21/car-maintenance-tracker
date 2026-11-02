# PRD · Overview, glossary, features, user stories

> Part of [02-prd.md](../02-prd.md). Sections: §1, §2, §3, §4. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 1. Product overview

See PVD §1. In short: the owner enters the odometer, and the app shows remaining distance and time for every tracked part of a petrol or diesel car. Data is local-first and synced.

## 2. Glossary (terms used in all documents)

| Term | Meaning |
|---|---|
| Car | A vehicle with a profile (name, fuel, timing drive, gearbox, DPF, odometer). |
| Odometer entry | A dated mileage reading. Entries never decrease (BR-01). |
| Category | A group of parts (Engine, Filters, Fuel, Brakes, Fluids, Tires, Electrical, Visibility, Emissions, plus custom). |
| Part | A tracked item (e.g. Engine oil). Created from a template or by the owner (custom part). |
| Part template | A default part definition shipped with the app (Appendix A). |
| Distance interval | Kilometres between services. Always stored in km (BR-11). |
| Time interval | Calendar months between services (A-07). |
| Condition-based part | A part with no countdown. It is inspected, not scheduled (BR-08). |
| Service record | A replacement entry: km, date, optional cost, optional notes (D-12). |
| Inspection record | A dated "inspected" mark for a condition-based part (A-16). |
| Inspection due | A flag on a condition-based part whose inspection period (default 3 months) has elapsed (BR-08). |
| Baseline record | A service record created by first-time setup or "all serviced today". It anchors status but is shown as "Initial" and excluded from cost totals (BR-16). |
| Date unknown | Shown on the time side of a part whose service km is known but whose service date is not (BR-20). |
| Status | One of OK, Due soon, Overdue, Unknown, Inspect, Set interval (BR-05). |
| Reminder | The daily local notification asking the owner to update the mileage (D-10). |
| Alert | A local notification about a specific part (D-11). |

## 3. Features and priorities

### 3.1 Feature list (MoSCoW)

Must Have = Release 1 (MVP). Should Have = Release 2. Could Have = Release 3 / public-release phase. The release split is a proposal, confirmed in the roadmap.

| ID | Feature | Description | Priority | Release | Basis |
|---|---|---|---|---|---|
| F-01 | Account connection | Optionally connect an account with email/password or Google to enable sync. Password reset for email accounts. Local use never requires an account. | Must | R1 | D-04, D-107 |
| F-02 | Car profile | Create a car: name, fuel (petrol/diesel), timing belt or chain, manual or automatic, DPF yes/no (diesel only), current odometer. | Must | R1 | D-09, D-15 |
| F-03 | Odometer update and history | Enter the current mileage. It must not be lower than the latest entry. List, edit, and delete the latest entry. | Must | R1 | D-05, A-02, A-03 |
| F-04 | Default parts and categories | Default parts grouped in categories, shown according to the car profile. | Must | R1 | D-08, D-09 |
| F-05 | Part tracking and status | Remaining distance/time and status per part. A per-part "warn earlier" setting is a Should Have (R2). | Must | R1 | D-06, D-07, D-22 |
| F-06 | Custom parts | Add own parts in any category (distance, time, both, or condition-based). Edit intervals of any part. Custom categories are a Should Have. | Must (parts), Should (categories) | R1 / R2 | D-08, A-11 |
| F-07 | Mark as replaced, service history | Record a replacement and reset the counters. Keep history per part. Mark a condition-based part as inspected. | Must | R1 | D-06, D-12, D-25, A-16 |
| F-08 | First-time setup | Enter the last-change km per part at setup. Skipped parts show "Unknown, check it". Bulk "all serviced today" action. | Must | R1 | D-13 |
| F-09 | Home screen | Car header with odometer and Update mileage button, Needs attention list (Overdue, inspection due, Due soon), collapsible categories with "+ Add part", part detail. | Must | R1 | D-14 |
| F-10 | Mileage reminder and inspection prompts | Daily local notification at a chosen time, skipped if mileage was updated that day. Includes periodic inspection prompts. | Must | R1 | D-10, A-08, A-09 |
| F-11 | Part alerts | Per-part alerts for time-sensitive parts (e.g. engine oil). | Must | R1 | D-11, A-05, A-06 |
| F-12 | Offline use | All core functions work without a connection. Data stored on the device. | Must | R1 | D-02 |
| F-13 | Cloud sync | Sync data across devices and restore it on a new phone. | Must | R1 | D-02, D-03, D-23 |
| F-14 | Settings | Reminder on/off and time, account (email, sign out), currency, app version. | Must | R1 | D-10, A-12 |
| F-15 | Data backup/export | Export the live local maintenance dataset as JSON from Settings. CSV and import are deferred. | Must (JSON), Should (CSV/import) | R1 / R2 | D-108 |
| F-16 | Units km/miles | Setting for display units. Storage stays in km. | Should | R2 | D-16 |
| F-17 | French and Arabic | Translations and right-to-left layout. English is available from R1. | Should | R2 | D-16 |
| F-21 | Delete account and data | Remove the account and all its data from the app. | Should | R2 | A-14 |
| F-18 | Multi-car interface | Switch between several cars. The data model supports it from R1. | Could | R3 | D-21 |
| F-19 | Ads and ad removal | AdMob ads for free users, paid option to remove them. | Could | R3 | D-17 |
| F-20 | Store release | Google Play publication. App Store publication needs a later owner decision. | Could | R3 | D-111 |

### 3.2 Won't Have (this version)

| Item | Reason |
|---|---|
| Automatic mileage reading (OBD-II, GPS, background tracking) | The app depends on manual entry by design (D-11). |
| Photos and receipts, garage records, fuel logs | Explicitly deferred by the owner. |
| Electric and hybrid vehicles | Scope is petrol and diesel (D-15). |
| Web app | Mobile only (D-01). |

## 4. User stories

| ID | As a... | I want to... | So that... | Feature | Priority |
|---|---|---|---|---|---|
| US-01 | owner | connect an account with email or Google when I choose | my data follows me across devices | F-01 | Must |
| US-02 | owner | create my car with its fuel, belt/chain, gearbox and DPF | the app shows only relevant parts | F-02 | Must |
| US-03 | owner | enter the current mileage | all parts update | F-03 | Must |
| US-04 | owner | be stopped from entering a lower mileage | I do not corrupt my data | F-03 | Must |
| US-05 | owner | see remaining km and time per part | I know what is due | F-05 | Must |
| US-06 | owner | see which parts need attention first | I act on the urgent ones | F-09 | Must |
| US-07 | owner | record that I replaced a part at a given km and date | its counter restarts | F-07 | Must |
| US-08 | owner | add a custom part with my own interval | I track what my car needs | F-06 | Must |
| US-09 | owner | enter last-change km for each part at setup, or skip | statuses are honest | F-08 | Must |
| US-10 | owner | get a daily reminder to update the mileage, but not after I already did | I keep the data current | F-10 | Must |
| US-11 | owner | be reminded to inspect condition-based parts | I do not forget brakes and similar parts | F-10 | Must |
| US-12 | owner | get alerts for time-sensitive parts | oil does not expire unnoticed | F-11 | Must |
| US-13 | owner | use the app offline | a missing signal never blocks me | F-12 | Must |
| US-14 | owner | find my data on a new phone | I never lose my history | F-13 | Must |
| US-15 | owner | export my data as JSON | I keep an offline copy outside the app | F-15 | Must |
| US-16 | owner | use miles and my language (English, French, Arabic) | the app matches my preference | F-16, F-17 | Should |
