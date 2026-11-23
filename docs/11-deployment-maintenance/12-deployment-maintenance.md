# 12 · Deployment and Maintenance

> Draft v0.1, 2026-11-23. Covers only the current R1a personal iOS preview path. It does not approve a change to D-18, D-54, D-69, D-111 or NFR-042 (see OQ-19).

## 1. Scope

The owner needs the local-only MVP on a personal iPhone without a paid Apple Developer Program and without an always-on development server. The app therefore runs inside Expo Go from a published EAS Update. This is a preview path, not distribution: there is no standalone app icon, no TestFlight and no App Store build.

## 2. Why Expo Go works for R1a

- Every native module used by R1a ships in Expo Go 58: `expo-sqlite`, `expo-notifications` (local notifications), `expo-sharing`, `expo-localization` and `expo-router`.
- The reason for D-54 and NFR-042 is native Google sign-in. That work is R1b and deferred (D-112), so it does not block R1a.
- EAS Update serves the JavaScript bundle and assets from Expo's servers. No Metro process, tunnel URL or local Wi-Fi is needed after publishing.
- Data stays in SQLite inside Expo Go on the device and survives app restarts. Local notifications keep working; remote push stays out of scope (D-11, D-24).

## 3. Conflict with approved decisions

D-18 and D-111 name a sideloaded IPA as the personal iPhone path. D-69 defines the weekly IPA signing routine. D-54 and NFR-042 say "no Expo Go". This document records what is actually running for R1a; it does not supersede those decisions. OQ-19 asks the owner to resolve the conflict before R1b or the first store-facing build.

## 4. One-time setup (performed 2026-11-23)

From `app/`, with a free Expo account:

```bash
npx expo login
npx expo install expo-updates
npx eas-cli@latest init --account salmen_ba --non-interactive
npx eas-cli@latest update:configure
npx eas-cli@latest update --channel production --environment production --message "Initial personal update" --platform all
```

Resulting state:

| Item | Value |
|---|---|
| EAS project ID | `86b13906-8460-49be-8560-8a96ca247e1a` |
| Branch and channel | `production` |
| Runtime version | `1.0.0` (`appVersion` policy) |
| First update group | `0dd12e64-9ce7-47ee-aead-f893da939abc` |
| Dashboard | `https://expo.dev/accounts/salmen_ba/projects/car-maintenance-tracker/updates/0dd12e64-9ce7-47ee-aead-f893da939abc` |

`app.json` carries `extra.eas.projectId`, `owner`, `runtimeVersion` and `updates.url`. Safe to revert locally; EAS can recreate them.

## 5. Daily use

1. Install Expo Go 58 on the iPhone and sign in as `salmen_ba`.
2. Open the **Projects** tab and launch Car Maintenance Tracker, or scan the dashboard QR code under **Preview**.
3. Force-close and reopen Expo Go to pick up a newer published update.

No computer needs to be on.

## 6. Publishing a change

```bash
cd app
npx eas-cli@latest update --channel production --environment production --message "short description" --platform all
```

Only JavaScript, styling and assets change this way. A new native module, a config plugin change or an SDK upgrade needs a new native build and a compatibility decision.

## 7. Limits and follow-ups

- EAS Update filters by SDK major version. When the App Store Expo Go moves to the next SDK, republish or the update stops loading.
- A custom app icon requires a signed native build; that returns to D-18/D-111 and needs a paid account or the weekly free-cert routine.
- R1b native Google sign-in needs a development build again (D-54, NFR-042).
- Resolve OQ-19 before R1b or the first store-facing build.
