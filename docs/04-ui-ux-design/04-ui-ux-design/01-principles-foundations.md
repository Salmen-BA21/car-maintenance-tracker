# 04 · UI/UX · Principles, navigation, tokens

> Part of [04-ui-ux-design.md](../04-ui-ux-design.md). Sections: §1, §2, §3.

## §1. Design principles

Ten principles, derived from the anti-generic house style and Apple's design foundations (*Designing Fluid Interfaces*, *Principles of Great Design*), applied to this app. Every screen below was sketched against them; if a later change contradicts one, the change needs a reason written down.

| ID | Principle | What it means here |
|---|---|---|
| UI-01 | **The odometer is the product.** The app answers one question: "what does my car need next?" Every screen serves that; no decorative dashboards, no charts for their own sake, no icon-card rows. | Home is a status read, not a cockpit. |
| UI-02 | **Speed is a design property.** SC-01 (<15 s for a mileage update), NFR-001/002, NFR-050 shape the flows: the mileage number pad opens straight from the home button or the reminder tap (1 tap), and the form has nothing else on it. |
| UI-03 | **Familiarity over invention.** Standard iOS/Android navigation patterns, the system font, system date/time and number pickers, standard destructive-action conventions. Never break a familiar pattern without proof it is better. |
| UI-04 | **Honesty in every state.** Unknown, "Set interval", "date unknown"/"km unknown" are shown as plainly as OK/Overdue (PVD §8 principle 2, D-13, BR-20). The app never draws a fake progress bar or invents a value it does not have. |
| UI-05 | **Status is never colour alone.** NFR-060: every status shows an icon glyph + text label; colour is a third signal. Same rule for the per-part progress bar (text value beside it). |
| UI-06 | **Restraint.** Flat colour only: no gradients, no glass/blur panels, no shadows on surfaces at rest, no glows, no decorative shapes, no emoji in chrome. Separation between surfaces is a tone step, not a shadow. Shadows only for what truly floats (a menu, a dialog, a sheet while open). |
| UI-07 | **One accent.** One accent colour marks the primary action (and "Inspect", §3.1). Status colours are semantic, reserved for status. No accent-tinted icon squares. |
| UI-08 | **Motion is physics, not decoration.** Feedback appears on touch-down, instantly. Sheets and gestures move 1:1 with the finger, carry release velocity, are interruptible at any moment, rubber-band at boundaries. Springs, no fixed-duration tweens for anything touchable. Bounce only where the gesture itself had momentum. |
| UI-09 | **Forgiveness, sparingly.** Undo beats confirmation when possible. A confirmation dialog only for genuinely destructive actions (soft-delete a custom part, delete the latest odometer entry FR-024, "all serviced today" overwrites setup intent, FR-022 edit/delete). Soft-deleting a custom part preserves its service history for export. Over-confirming trains tapping through (Apple: agency + responsibility). |
| UI-10 | **Interactive prototype over static design.** Per Apple's process, the MVP screens are built and used on a device early (MVP-SCOPE build order step 4) — the design is corrected from what the flows feel like, not from more specification. |

## §2. Navigation model

### 2.1 Screen inventory (R1a)

| # | Screen | Purpose | Reached from |
|---|---|---|---|
| S-1 | First-time setup (car form + parts form) | J-01, F-02, F-08 | First launch only |
| S-2 | Home | F-09: status read + entry to everything | App open, after setup |
| S-3 | Mileage update | J-02, F-03: the <15 s flow | Home button, reminder tap (FR-084) |
| S-4 | Part detail | F-05/F-07: status, replace, history | Row tap on Home, reminder/alert (deep link to part), search? none |
| S-5 | Settings | F-14: reminder, currency, account (R1b), export, version | Home top-right |
| S-6 | Odometer history | F-03: list/edit/delete entries | Tap the odometer value on Home |
| S-7 | Forms (sheets): Mark as replaced, Add part, Edit part, Mark inspected | Short write actions | Part detail, Home "+ Add part" |

Multi-car is out of scope in R1 (F-18, OQ-08 → R3). The data model supports it; the UI single-car assumption is limited to labels ("the car") so a switcher can be added later without redesign.

### 2.2 Structure (UI-11)

- **Stack, no tab bar.** Five screens and all flows fit one navigation stack; a tab bar would spend a permanent strip on navigation a utility app does not need. Home is the stack root. This is revisited in R2/R3 only if a screen count change forces it.
- **Settings from Home top-right** (icon button, standard placement each platform). No overflow menu hiding a primary action.
- **Short write actions are bottom sheets** (replaced, add/edit part, inspected, entries edit): fast, keep Home context visible, platform-native. **Write flows with validation (car creation, setup, mileage update, odometer list) are full screens.** One rule for all short forms; never mix the same form across a sheet and a screen.
- **Deep links from notifications** (FR-084, F-11): reminder → S-3; part alert → S-4 for that part. The tap must land without forcing intermediate screens (direct to target; back goes Home).
- **Sync state** (FR-105/FR-107): a small status line on Settings and a compact chip on Home only when it is not "Synced" (silent when fine). R1a shows only "Not connected"/"Local"; the other states are R1b.

### 2.3 Deferred structure

R2/R3 (out of scope here, listed so nothing in R1 blocks it): km/miles and language switching UI (F-16, F-17, NFR-071), the account/sync flows (F-01/F-13 full UI), multi-car switcher (OQ-08), ads (F-19).

## §3. Design tokens

All values are proposals. Tokens live in one theme module; screens reference tokens only — no raw hexes in a screen. Both light and dark are supported from R1 by following the system (dark is not a feature, it is a correctness obligation). Android and iOS map these roles to their platform conventions (§1 UI-03).

### 3.1 Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `ground` | system background (iOS `systemGroupedBackground` / M3 surface) | system | Screen background |
| `surface` | secondary grouped background (white / `secondarySystemGroupedBackground`) | system | Cards, list rows, sheets |
| `ink` | label (near-black) | label (near-white) | Primary text — always full contrast, never grey for body |
| `muted` | secondary label (grey) | secondary label | Secondary text, empty states |
| `accent` | platform tint (iOS system blue) | platform tint | Primary button, links, "Inspect" status, progress fill |
| `status-ok` | `#1D7A34` | `#4CC35E` | OK chip (with glyph + label) |
| `status-due-soon` | `#8A5A00` | `#FFB340` | Due soon chip |
| `status-overdue` | `#C03221` | `#FF6F61` | Overdue chip |
| `status-unknown` | = `muted` | = `muted` | Unknown, "Set interval", "date/km unknown" |

Rules: chips use a low-opacity tinted background with the status colour's text on it (AA contrast required, NFR-060); the accent appears only on the primary action and "Inspect"; no other colours enter the UI. Status never rides on colour alone (UI-05): icon + text first, colour third.

### 3.2 Type

| Property | Decision |
|---|---|
| Family | System font only (SF Pro on iOS, Roboto/system on Android). One family, zero shipped fonts. |
| Scaling | Dynamic Type / system font scaling fully supported; layout uses scaled units so larger text never clips (Apple: respect text-size settings). |
| Tracking | Tightened on the large odometer display (≈ −0.02 em); none on body. Size-specific, never one global value. |
| Figures | Tabular figures everywhere a number sits in a column or updates (odometer, remaining values, history) so values don't shift width. |
| Leading | Tight on the display row, roomy on body. Hierarchy from size + weight together (Apple §15). |

Type roles (mapped to platform text styles, so scaling comes free):

| Role | Use |
|---|---|
| Display (largeTitle) | Odometer value on Home and S-3 — the one very large thing per screen |
| Title (title2) | Car name, screen titles, category headers |
| Headline (semibold body) | Part names, form field labels |
| Body | Everything else, full `ink` |
| Footnote (secondary) | Timestamps, hints, "date unknown" — only truly secondary text |

### 3.3 Spacing and shape

- 4 pt grid. Screen margin 16; card/row padding 12–16; row height ≥ 44 pt touch target (Apple minimum, all platforms); section gap 24; card gap 8 inside a category.
- Corner radius: 10 pt continuous (cards, buttons, chips, text fields — one scale). Sheeted forms and dialogs use the platform sheet radius. The same value everywhere; no mixed soft radii (a deliberate break from web landing-page rules to the native convention, per UI-03).
- Elevation: no shadows at rest (UI-06). A sheet gets the system elevation + dimmed scrim beneath while open.
- Icons: platform icon set / a single consistent line-icon set, stroke 1.5–2, no filled-square backdrops. Status glyphs (check, clock, warning, question mark) are geometric, drawn to match the system weight.

### 3.4 Motion and haptics

The house has two speeds and no more. Concrete parameters (from the springs work, proven values):

| Moment | Motion | Parameters |
|---|---|---|
| Press feedback on every touchable | Highlight/scale on **touch-down**, not release | 100 ms ease-out, scale 0.97 tint feedback; identical everywhere (UI-08) |
| Sheet open/close (all forms) | Spring | damping 0.8, response 0.3 (bounce only because a drag preceded it); while open it tracks the finger 1:1; release hands velocity to the spring (relative velocity = v / remaining distance); re-grabbing mid-flight starts from the current on-screen position, never the target |
| Screen push/pop, tab-less navigation | Platform default transition | Never custom |
| Value change (remaining km/days, statuses after a save) | Cross-fade | 150 ms opacity; **no counting/roll animation** — honesty and reduced-motion friendliness beat flourish |
| Needs attention appearing | Appear in the list order | No entrance stagger choreography; the list simply renders (a utility app re-reading itself dozens of times a day must not perform every time) |
| Rejected input | Inline, immediate | Field-level message + one warning haptic; the value stays for correction |
| Boundary overscroll | Rubber-band | Native scroll behaviour only |

Interruptibility rules (non-negotiable): input is never locked during a transition; every movement is re-targetable from its current value; enter and exit share the same path (a sheet slides back down where it came from, it does not slide sideways to disappear); feedback visual/haptic fire on the same frame. Reduced-motion/tranparency/contrast settings drop springs to cross-fades, make chips solid, and never remove text (§8).
