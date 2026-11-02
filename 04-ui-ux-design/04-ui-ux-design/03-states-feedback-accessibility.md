# 04 · UI/UX · States, feedback, accessibility, review

> Part of [04-ui-ux-design.md](../04-ui-ux-design.md). Sections: §6, §7, §8, §9.

## §6. States and errors

Local-first means most classic states are rare: reads never wait on a network, so screens render straight from SQLite (F-12). The states that exist:

| State | Where | Behaviour |
|---|---|---|
| Empty — Needs attention | Home | Section hidden entirely (FR-071). No "nothing to do here" illustration — silence is the reward. |
| Empty — category | Home | Only "+ Add part" shows. |
| Empty — history | Part detail | "No service recorded yet" + inline last-change km field (FR-063). |
| Loading | Anywhere | Local reads are sync-fast; no spinners. The only async UI is the sheet moment and (R1b) sync — none in R1a. |
| Form validation | All forms | Inline, field-level, immediate (validates as the field blurs/keystrokes, not only on submit — Apple's four feedback kinds: error is inline, warning is a dialog, status is the chip). Style: message under the field, muted→danger-coloured text, field keeps value. |
| Rejected mileage (lower/equal) | S-3 | §4.3. Nothing persisted (AC-01). |
| Cancelled destructive action | Sheets/dialogs | Nothing changes. Cancel is always available; drag-away also cancels a sheet (Apple gesture rules). |
| Notifications denied | Settings, S-3 | App never breaks: no reminder/alert is scheduled (AC-20), Settings shows the row with the path to system settings (§4.5). |
| First launch cold start | S-1 → S-2 | NFR-001 (usable home ≤2 s). Setup is the only first-run path; no splash beyond platform default. |
| Odometer stale | Home (subtle) | If the last entry is old, the reminder does the work (F-10) — no nagging banner in the app itself. |
| Sync / account (R1b) | Home, Settings | Chip only per §2.2: Synced (silent), Pending, Offline, Error (tap → Settings explanation). R1a shows only Not connected (FR-107). Not designed here. |

Error copy rule: say what happened, what it means for the data, and the next action. Never show raw codes. Nothing is ever at risk of silent loss (NFR-011 transactional writes back this promise).

## §7. Feedback, haptics, gestures

Haptic vocabulary — three uses only (Apple §13: causality, harmony, utility; over-use trains ignoring):

| Event | Haptic | Visual |
|---|---|---|
| Valid save (mileage, replaced record, new part, settings change) | Success, once, on the save's frame | Value cross-fades into place; sheet closes |
| Rejected input | Warning, once, with the message | Inline message appears |
| Long-list scroll, screen transitions, chips, tabs | None | None |

Gestures (from the fluid-interface rules, kept small because a utility app earns gestures slowly):

- Every touchable highlights on **touch-down**; commit on release; drag-away cancels (Apple §10).
- Sheets are fully draggable: 1:1 tracking while dragging, release velocity handed to the spring (§3.4), grabbable mid-close without waiting.
- Collapsible categories expand/collapse with content height spring, re-targetable mid-motion.
- Rubber-banded overscroll native; no pull-to-refresh on Home (status is derived on read, nothing to refresh — the app opens by recomputing, FR-046).
- No swipe row actions in R1 (edit/delete live in part detail's ⋯ menu — discoverable, no hidden destructive edge-swipes). Revisit if the ⋯ menu gets crowded.

## §8. Accessibility

| Requirement | Implementation |
|---|---|
| Status not colour-only (NFR-060) | Icon glyph + text label in every status chip, on both Home rows and part detail; progress bar annotated with the number. |
| Contrast | All text ≥ WCAG AA against its surface; proposed status colours checked in light **and** dark. Contrast raised, not lowered, if a proposal value fails. |
| Dynamic Type / font scaling | Platform text styles throughout (§3.2); layouts allow growth without clipping; the odometerDisplay row is the designated "grows less" exception (Apple's accessibility sizes allow a smaller multiplier for the display number, with the same info in the header label). |
| Screen reader labels | Every interactive element has a label; part rows read as "Engine oil, 9,930 km remaining, due soon, button"; status glyphs are decorative (label carries the meaning). Form fields' limits announced. |
| Touch targets | ≥ 44 pt; the "+ Add part" row and chips are full-row/ generous targets (Apple gesture rules: ~10 px fail padding). |
| Reduced motion | Springs → cross-fade, bounce removed, press-scale → tint change only; content never hidden by animation loss (accessibilityInfo reduce-motion hook in the theme, §3.4). |
| Reduced transparency / contrast | Chips and surfaces go solid + bordered (prefers-reduced-transparency / increased-contrast equivalents on each platform). |
| Locale (NFR-072) | Dates, numbers, currency via platform formatters through one utility (BR-18); km and units built correctly from R1 so R2's conversion touches formatting only. |
| RTL (NFR-071, R2) | Layout built with start/end semantics from R1 so mirroring later is a flag flip, not a rewrite (out of scope to ship now). |

## §9. Review checklist and open decisions

### 9.1 Checklist (the gate before any screen is called done)

1. Status never colour alone: glyph + label + value present (UI-05).
2. Every value real: no invented numbers, no placeholder text shipped (UI-04); honest labels for Unknown cases surface per BR-20.
3. One accent on the screen (UI-07); no gradient, glow, glass, or rest-shadow (UI-06).
4. Primary action reachable: mileage in ≤3 taps from Home, 1 from the reminder (NFR-050); SC-01 timed on a device.
5. Touch-down feedback everywhere, springs per §3.4 values, nothing input-locked during motion (UI-08).
6. Confirms only where irreversible (UI-09); cancel always possible.
7. Dynamic Type at largest settings: nothing clips, labels still legible (§8).
8. Screen renders from local data alone (F-12).
9. Deep links land on the target, back returns Home (§2.2).
10. New copy follows the notification and error patterns (§4.6, §6).

### 9.2 Proposed decisions needing owner sign-off (with the doc itself)

| ID | Decision |
|---|---|
| UI-12 | Stack navigation, no tab bar (§2.2). |
| UI-13 | Sheets for short forms; full screens for flows with validation (§2.2). |
| UI-14 | Palette and status colours as proposed (§3.1) — needs a contrast pass on-device; the accent follows the platform tint rather than a custom brand colour until the app has a name (OQ-05). |
| UI-15 | System font only, Dynamic Type everywhere (§3.2). |
| UI-16 | Custom number pad on S-3 only if the system keypad proves slower in the device round (§4.3) — decide by use, not speculation. |
| UI-17 | No swipe actions in R1 (§7). |
| UI-18 | Odometer history as its own screen (S-6), reached from Home's odometer value (§4.6). |

### 9.3 Open questions proposed for `registers.md` (pending — not yet entered)

- *OQ (new)*: App name affects Home header length and the notification copy (OQ-05 intersection).
- *OQ (new)*: Should S-3 use a custom keypad from day one for the ≥15 s target, or system pad (UI-16 timings settle it)?
- *OQ-08* (existing, multi-car UI) stays R3; nothing in this doc designs for it beyond label neutrality (§2.1).
