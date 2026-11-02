# 04 · UI/UX Design Document

| Field | Value |
|---|---|
| Project | Car Maintenance Tracker (working title, OQ-05) |
| Version | 0.1 (draft — proposal pending owner approval; the doc is not started in AGENTS.md and MVP-SCOPE §3 asks for a screen sketch, not a full spec) |
| Date | 2026-11-02 |
| Owner | Salmen Ben Ammar |
| Related | [PVD](../01-discovery/01-product-vision.md), [PRD](../02-product-requirements/02-prd.md), [SRS](../03-technical-specifications/03-srs.md), [TRD](../03-technical-specifications/05-trd.md), [MVP-SCOPE](../MVP-SCOPE.md) |

**Legend.** `FR-xxx`, `NFR-xxx` and `AC-xx` come from the SRS and PRD; `F-xx`, `J-xx`, `BR-xx` from the PRD; `D-xx` are confirmed decisions in `decisions.md`. `UI-xx` is this document's own label for a design decision proposed here — every `UI-xx` is a proposal and needs owner approval, like the doc itself. The design language follows two sources agreed with the owner: an **anti-generic house style** (flat colour, no gradients/glass/ornament, restraint, real content over decoration) and **Apple's fluid-interface discipline** (respond on touch-down, springs, interruptible motion, velocity handoff, platform familiarity, the eight design principles).

**Scope.** This document defines the screens, states, navigation and design tokens the MVP (Release 1a: F-02 to F-12, F-14, JSON export in F-15, per [MVP-SCOPE](../MVP-SCOPE.md)) needs to be built consistently. It deliberately stays at sketch level: layout intent, behaviour, and the rules that keep five screens one app. Pixel-exact redlines and a visual prototype are later work (§9). Account and sync (R1b) UI appears only where FR-105/FR-107 force it (a sync-state indicator); the full sync UI is deferred.

---

## Contents

This file is the index. Open only the part you need.

| File | Contents | Sections |
|---|---|---|
| [04-ui-ux-design/01-principles-foundations.md](04-ui-ux-design/01-principles-foundations.md) | Design principles, navigation model, design tokens (colour, type, spacing, shape, motion, haptics) | §1, §2, §3 |
| [04-ui-ux-design/02-screens-mvp.md](04-ui-ux-design/02-screens-mvp.md) | Sketches: first-time setup, home, mileage update, part detail, settings, odometer history; notification UX | §4, §5 |
| [04-ui-ux-design/03-states-feedback-accessibility.md](04-ui-ux-design/03-states-feedback-accessibility.md) | Screen states and errors, feedback and haptics, accessibility, review checklist, open decisions | §6, §7, §8, §9 |
