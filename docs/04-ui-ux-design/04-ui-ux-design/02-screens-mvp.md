# 04 · UI/UX · Screen sketches (MVP)

> Part of [04-ui-ux-design.md](../04-ui-ux-design.md). Sections: §4, §5. Sketch level per MVP-SCOPE §3: layout intent and behaviour, not redlines. Section headers name the screen's content (no index numbering on the screens themselves, house rule).

## §4. Screens

Every screen sketch lists: purpose and references, wireframe, behaviour, states (full state rules in part 3).

### 4.1 First-time setup (S-1) — F-02, F-08, J-01, FR-010, FR-060–063, AC-07, AC-08, AC-24

Two full screens in sequence, skippable where the requirement allows. No account step anywhere in this journey (D-107).

**S-1a Car profile.** One scroll, sections in plain order, inline validation, save on the bottom button:

```
┌──────────────────────────────────┐
│  Add your car                    │
│                                  │
│  Name *                          │
│  [                               │
│  [ie. nickname you'll recognise ]│
│                                  │
│  Fuel *                          │
│  ( Petrol )  ( Diesel )          │
│                                  │
│  Timing drive *                  │
│  ( Belt )    ( Chain )           │
│                                  │
│  Gearbox *                       │
│  ( Manual )  ( Automatic )       │
│                                  │
│  Diesel particulate filter       │      ← shown when Fuel = Diesel
│  ( Yes )     ( No )              │
│                                  │
│  Current odometer (km) *         │
│  [ 128 000        ]              │
│                                  │
│         [ Create car ]           │
└──────────────────────────────────┘
```

- Segmented controls where two options exist (platform-native). Required marked `*`, all of these are (FR-010).
- Odometer accepts whole numbers, locale separators on display (FR-022, FR-026); numeric keypad.
- Saving the first odometer creates the first entry (FR-025) and goes to S-1b.

**S-1b Last-change km.** The default parts grouped by category (BR-13), one row per part:

```
┌──────────────────────────────────┐
│  ← Back to car                   │
│  When were parts last changed?   │
│  Leave blank if you don't know — │
│  the part will show "check it".  │
│                                  │
│  ▾ Engine                        │
│    Engine oil     km [       ]   │
│                   date        ▾  │   ← date picker opens only on tap
│    Oil filter     km [       ]   │
│    Timing belt    [Set interval] │   ← no pre-filled km or date (BR-12)
│  ▾ Brakes                        │
│    Brake pads     (condition)    │   ← no fields; inspect prompt only
│  ▾ Tires                         │
│    …                             │
│                                  │
│  [ All serviced today ]          │   ← explains what it does, then confirms
│                                  │
│           [ Done ]               │
└──────────────────────────────────┘
```

- km and date are independent fields, both empty by default; the date never defaults to today (FR-060). Entering only km is fine (time side will show "date unknown", BR-20).
- "Timing belt" and "gearbox oil" show "Set interval"; their interval is set later from the car's manual (BR-12, FR-048).
- "All serviced today" (FR-062): the button states its effect ("records service today at the current odometer for every part above"), then a confirmation dialog (UI-09 — it creates baseline records in bulk). Records are shown as "Initial" later (BR-16).
- Done. No account connection step. Reminders are configured in Settings (S-5) or on the first Home visit's notification permission prompt (FR-085).

### 4.2 Home (S-2) — F-09, FR-070–075, D-14, NFR-050, AC-07

The status read; also the stack root and entry to everything.

```
┌──────────────────────────────────┐
│  Bertha            ⚙            │      ← car name left, settings right
│  128 340 km          [tabular]   │      ← tap value → S-6 odometer history
│  [ Update mileage ]              │      ← primary action, accent (NFR-050: 1 tap)
│                                  │
│  Needs attention                 │      ← hidden when empty (FR-071)
│  ! Engine oil      Overdue       │   ← glyph + label + (colour)
│      overdue 320 km              │
│  ▸ Brake pads      Inspect       │      ← inspection-due grouping per FR-047
│  ⏱ Brake fluid     Due soon   ·  │
│      21 days                     │
│                                  │
│  ▾ Engine                        │
│    Engine oil    9 930 km  OK    │      ← remaining value + status + progress bar
│    ▸ Oil filter  9 930 km  OK    │
│    + Add part                    │      ← in every category (FR-073)
│  ▸ Brakes                        │
│      Brake pads  –         Ins   │
│  ▾ Fluids                        │
│      …                           │
└──────────────────────────────────┘
```

- **Order is meaning, not chrome.** Needs attention first (Overdue → inspection due → Due soon, urgency-ordered, FR-047), then categories. No summary numbers, no rings, no widgets beyond the two lists.
- Each part row: name, remaining value (km, days, or both — and the honest labels "date unknown"/"km unknown"/"Set interval"), status glyph + label, thin progress bar as a third signal (UI-05). Tapping opens S-4.
- Categories collapsible (FR-072), state remembered per category. A category with no parts shows only "+ Add part".
- Status chip copies follow §3.1. Home renders from the local DB only — offline is not a state here, it is the default (F-12). Sync chip appears (top, small) only when not "Synced"/"Not connected"-fine (§2.2).
- After a mileage update this screen shows the in-app notice (FR-093) as a banner between header and Needs attention: what became Due soon/Overdue, one row per part, auto-dismissable.

### 4.3 Mileage update (S-3) — F-03, FR-020–026, BR-01, J-02, SC-01, AC-01, AC-09

The screen a person reaches from a lock-screen reminder with one thumb, possibly standing at the car (or from a dashboard camera photo). Nothing else happens on it.

```
┌──────────────────────────────────┐
│  ← Back                          │
│                                  │
│  Latest entry                    │
│  128 340 km                      │      ← small, muted ("x km ago" hint)
│                                  │
│  131 050                         │      ← the entry being typed, Display size
│                                  │
│  7   8   9                       │      ← custom numeric keypad or
│  4   5   6                       │        system number pad with
│  1   2   3                       │        inline hint — whichever is faster
│      0   ⌫                       │
│                                  │
│         [ Save ]                 │
└──────────────────────────────────┘
```

- Lower value than latest: inline message immediately on the field ("below the latest entry (128 340)"), save disabled or tapping save shows the message — nothing is stored (FR-021, AC-01). Equal value: accepted, no change, returns Home.
- Max 9 999 999 (FR-022), enforced keypad-side.
- On valid save: write transactionally, statuses recompute ≤500 ms (NFR-002), success haptic, return Home, reminder for today silently cancelled (FR-081/FR-086), in-app notice if anything became urgent (FR-093). Total target <15 s (SC-01).
- Back without saving discards — no confirmation (nothing was written).

### 4.4 Part detail (S-4) — F-05, F-07, FR-074, J-03, J-04, FR-050–056, FR-063, AC-06, AC-12, AC-17, AC-18

Everything about one part. Structure top-down:

```
┌──────────────────────────────────┐
│  ← Back            (edit ⋯)     │
│  Engine oil                       │
│  Engine                          │
│                                  │
│  ⏱ Due soon                      │      ← status: glyph + label (colour third)
│  9 930 km remaining              │
│  21 days remaining               │      ← or "date unknown" (BR-20)
│  [progress: ▓▓▓▓▓░░░░] 30 %      │      ← text value beside it (UI-05)
│                                  │
│  Interval     10 000 km · 12 mo  │      ← tap to edit (editable, BR-14)
│  Alerts        On                │      ← toggle (FR-090)
│  Last replaced 120 000 km        │      ← active record summary
│                2026-01-15        │
│                                  │
│  [ Mark as replaced ]            │      ← primary action, opens sheet
│  [ Mark inspected ]              │      ← condition-based parts only (FR-055)
│                                  │
│  History                         │
│  2026-01-15  120 000 km  45 €    │      ← edit/delete each record (FR-054)
│  2025-07-02  114 500 km  Initial │      ← baseline rows labelled (BR-16)
│      (cost totals exclude Initial)│
└──────────────────────────────────┘
```

- **Mark as replaced sheet** (J-03): km (default = current odometer, FR-050), date (default today — the setup screen never defaults dates, this normal replace flow does), cost optional with currency preset from Settings (FR-056, FR-111), notes optional. Validation per BR-07/AC-12 inline (km > odometer rejected, future date rejected). Save restarts counters (BR-06) — full interval shows again, success haptic, sheet closes to the recomputed detail.
- **Edit ⋯ menu**: edit name and intervals (FR-034), change alert setting, per-part "warn earlier" (R2, FR-049), hide default part / delete custom part — delete or hide confirmations per AC-17 (deleting a custom part destroys its history: explicit copy; hiding keeps it).
- **History**: newest first by active-record rule (D-42); each record editable/deletable after confirmation (FR-054); cost totals exclude "Initial" (BR-16).
- A part with no service record yet shows, instead of numbers: "No service recorded yet — enter the last-change km" with an inline field (FR-063). Statuses Unknown / "Set interval" / Inspect each show a one-line explanation of what to do (honesty + next action, UI-04).

### 4.5 Settings (S-5) — F-14, FR-083, FR-085, FR-110–112, FR-111, AC-20, AC-28, FR-011

```
┌──────────────────────────────────┐
│  ← Back                          │
│  Reminder                        │
│  Daily odometer reminder   [On]  │
│  Time                      20:00 │      ← system time picker
│  (notifications permission row,  │       with "allow in Settings" link
│   when denied — AC-20)           │
│                                  │
│  Car                             │
│  Bertha · edit profile       ›   │      ← FR-011 (add/hide parts follows)
│  Odometer history            ›   │      ← alternate path to S-6
│                                  │
│  Account                         │
│  Not connected — data stays      │      ← R1a; R1b adds sign in/out (FR-110)
│  local, backup via export        │
│                                  │
│  General                         │
│  Currency                  EUR › │      ← default: device region (FR-111)
│  Export backup (JSON)        ›   │      ← Share/Save sheet, works offline (AC-28)
│  App version          0.1.0 (12) │
└──────────────────────────────────┘
```

- Grouped static list, native patterns. Export runs a snapshot, never mutates data (FR-112); success confirmed with a toast/haptic.
- Reminder off is a valid state; the copy states the consequence plainly ("you won't be asked to update the odometer").

### 4.6 Odometer history (S-6) — FR-023, FR-024, BR-01

Simple list, newest first, separators, entries shown with locale separators and their date. The latest entry is editable/deletable (confirmation dialog, UI-09); all older rows read-only (BR-01). The last remaining entry cannot be deleted (FR-024). Reached from Home (tap the odometer value) or Settings (alternate path §4.5).

## §5. Notification UX — F-10, F-11, FR-080–094, AC-09, AC-10, AC-16, AC-20, AC-22

Design of the copy, not the scheduling mechanics (TRD 04's job). All notifications are local (D-11, D-24).

| Notification | Copy pattern | Tap target |
|---|---|---|
| Daily reminder (FR-080) | **"Bertha — update the odometer"** body: when urgent parts exist, a count + the single most urgent item (FR-082): *"2 parts need attention: engine oil is 320 km overdue"*; otherwise a plain prompt. | S-3 |
| Part alert (FR-091) | **"Engine oil due soon"** body: *"Service it by 2026-11-20 (21 days)."* Nearest dates first. | S-4 for that part |
| Inspection prompt (BR-08) | **"Brake pads: inspect"** body: *"No countdown for this part — check it, then mark inspected."* | S-4 |
| Window-end "paused" (FR-086) | **"Reminders paused"** body: *"Open the app to keep odometer reminders going."* | Home |
| Permission denied (AC-20) | Not a notification — an in-Settings row (§4.5) explaining what is off and how to fix it. App keeps working; no reminder or alert is scheduled, nothing else is blocked (AC-20). | Settings → system settings |

Deep links go straight to the target screen (§2.2); back from there is the stack root, never the notification.
