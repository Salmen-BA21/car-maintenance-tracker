# PRD · Acceptance criteria, MVP, feature dependencies

> Part of [02-prd.md](../02-prd.md). Sections: §7, §8, §9. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 7. Acceptance criteria

| ID | Feature | Given / When / Then |
|---|---|---|
| AC-01 | F-03 | Given the latest odometer is 120,500, when I enter 120,400, then the entry is rejected with a message and the stored value is unchanged. |
| AC-02 | F-03, F-05 | Given the latest odometer is 120,000 and engine oil (10,000 km) was changed at 120,000, when I enter 120,070, then engine oil shows 9,930 km remaining. |
| AC-03 | F-07 | Given a part replaced at 320,000 km with a 70,000 km interval, when the odometer is 340,000, then it shows 50,000 km remaining. |
| AC-04 | F-05 | Given engine oil with a 12-month interval serviced on 2026-01-15, when today is 2026-12-20, then its status is Due soon (26 days left). |
| AC-05 | F-05 | Given a part with 6,000 km remaining (OK) and a time interval 10 days past due, then its status is Overdue. |
| AC-06 | F-05 | Given brake pads are condition-based, then they show "Inspect" and no remaining value. |
| AC-07 | F-08 | Given I skipped a part at setup, then it shows "Unknown, check it". When I enter its last-change km, then it shows a normal status. |
| AC-08 | F-08 | Given I tap "all serviced today", then every part gets a baseline service record with km = current odometer and date = today, shown as "Initial" in history. |
| AC-09 | F-10 | Given a 20:00 reminder and I updated the mileage at 18:00, then no reminder appears at 20:00. Given I did not update, then a reminder appears at 20:00. |
| AC-10 | F-10 | Given a condition-based part not inspected for 3 months, then the reminder summary includes it (a count plus the most urgent item). |
| AC-11 | F-06 | Given I add "Power steering fluid" with 40,000 km in Fluids, then it appears in Fluids and updates like a default part. |
| AC-12 | F-07 | Given the odometer is 120,000, when I record a replacement at 121,000, then it is rejected. |
| AC-13 | F-12 | Given airplane mode, when I update the mileage, then it is saved and statuses update. |
| AC-14 | F-13 | Given two signed-in devices, when I update on one, then the other shows the change after sync. |
| AC-15 | F-01 | Given a new user, I can sign up with email/password and with Google, and stay signed in after restart. |
| AC-16 | F-11 | Given engine oil with alerts on, when it enters the Due soon window, then a local notification is delivered. With alerts off, none is delivered. |
| AC-17 | F-06 | Given a custom part with history, when I delete it and confirm, then the part and its history disappear (also on my other devices after sync). If I cancel, nothing changes. Hiding a default part keeps its history. |
| AC-18 | F-07 | Given a part with two service records, when I edit the older record, then the active record is the one with the latest date (ties: higher km) and the remaining values are recomputed from it. |
| AC-19 | F-13 | Given an account with data, when I sign in on a new phone, then the car, odometer entries, parts and service history appear after sync with the same statuses. |
| AC-20 | F-10 | Given notification permission is denied, then the app explains how to enable it, every other function keeps working, and no reminder or alert is scheduled. |
| AC-21 | F-01 | Given a signed-in user whose token has expired and no network, when the app restarts, then the car, odometer, parts and history are shown and editable, the sync state shows Offline, and the pending changes upload after the token refreshes. |
| AC-22 | F-10 | Given a 30-day reminder window and a 20:00 reminder, when I update the mileage at 18:00, then no reminder fires that day and the window is rebuilt from tomorrow. When 30 days pass without the app being opened, then the last notification states that reminders are paused and no further notification is delivered. |
| AC-23 | F-05 (second sentence: R2) | Given a custom part with an 800 km interval replaced at the current odometer, then it is OK (not Due soon) and becomes Due soon at 400 km remaining. A "warn earlier" value equal to or above the interval is rejected. |
| AC-24 | F-08 | Given setup, when I enter a last-change km for engine oil but no date, then the distance countdown is shown and the time side shows "date unknown". When I enter a date for brake fluid, then its due date is computed from that date. When I enter a date for a distance-only part but no km, then the time side is shown, the distance side shows "km unknown", and the status is Unknown. When I skip both for the battery, then it shows Unknown. |
| AC-25 | F-01, F-13 | Given a fresh install without an account, when I create and update a car, then all data is stored and usable offline and the sync state is Not connected. |
| AC-26 | F-01, F-13 | Given an account with no cloud rows and a local profile, when I review the upload count and confirm connection, then the complete profile uploads atomically and sync becomes Connected only after success. |
| AC-27 | F-01, F-13 | Given an account with cloud data and a local profile, when I choose Use cloud data, then the app offers JSON backup, validates the cloud dataset, and replaces the local profile only after validation. When I cancel, neither dataset changes and the account session is cleared. |
| AC-28 | F-15 | Given airplane mode, when I export from Settings, then the app creates a JSON backup through the system Share/Save sheet without changing local data; it contains live maintenance data and export metadata but no credentials, account email, device identifiers, sync metadata, or tombstones. |

## 8. MVP definition

**Release 1 (MVP)** contains F-01 to F-14 plus JSON backup in F-15, in English, with kilometres only. It runs on Android (installed directly) and on iPhone (sideloaded IPA) (D-18). A car is usable without an account; cloud sync (F-13) uses one Supabase project only after explicit account connection (D-03, D-58, D-107), proven by spike S-01 before the main build.

**Definition of done for the MVP:** all Must Have acceptance criteria (AC-01 to AC-28, excluding the Release 2 "warn earlier" clause of AC-23) pass on a real device, offline and online, and the test cases of the QA plan (document 11) cover the remaining Must Have requirements.

## 9. Dependencies between features

| Feature | Depends on |
|---|---|
| F-02 Car profile | None |
| F-04 Default parts | F-02 |
| F-05 Status | F-03, F-04 |
| F-07 Replacement | F-05 |
| F-08 First-time setup | F-04 |
| F-09 Home screen | F-05, F-06 |
| F-10 Reminder | F-03, F-14 |
| F-11 Part alerts | F-05, F-14 |
| F-13 Sync | F-01 (only when connected), F-12 |
| F-15, F-16, F-17, F-21 | R1 complete |
| F-18, F-19, F-20 | R2 complete (F-19 also needs F-01 and F-13) |
