# SAD · Decisions, open questions, follow-ups (rationale)

> Part of [06-system-architecture.md](../06-system-architecture.md). Sections: §14, §16. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 14. Decisions

### 14.1 Architectural decisions

Approved 2026-11-01. `AR-01` to `AR-20` map in order onto README `D-74` to `D-93`.

| ID | Decision |
|---|---|
| AR-01 | Single process, single SQLite connection, single writer: every mutation — repository write, pull apply, migration, local wipe — passes through one serial write gate; reads do not. |
| AR-02 | Sync is one single-flight coordinator. A pass is push then pull; triggers coalesce; at most one pass runs; a write during a pass schedules exactly one follow-up pass. A failed push call ends the pass in backoff before the pull. |
| AR-03 | Network calls never hold the write gate: the engine snapshots under the gate, sends outside it, then re-enters to acknowledge. |
| AR-04 | One composition root builds every service once; no module constructs its own singleton or reads build configuration directly. |
| AR-05 | One post-commit pipeline owns query invalidation, the newly-due notice, the sync request and the notification rebuild, in that order. Features emit events and never call the scheduler or the engine. |
| AR-06 | Release 1 executes nothing while backgrounded: no background task, no headless sync, no push. Triggers are launch, foreground, network regain, pull-to-refresh and writes while foreground. |
| AR-07 | The visible sync state is derived from network, session, dirty count and last result, never stored; precedence Offline > Error > Pending > Synced. |
| AR-08 | An outdated client refuses to sync and says so; there is no grace period. Local work continues and retries stop until the next cold start. Closes OQ-14. |
| AR-09 | The notification service is the only caller of the notification library and rebuilds from a read snapshot after first paint, never inside a transaction. |
| AR-10 | Every failure has exactly one class and one surface: field error, local message, sync banner, or blocking screen. No silent catch and no duplicate surface. |
| AR-11 | Screens import hooks only; only `src/auth` and `src/sync/remote` import the cloud SDK; only `src/notifications` imports the notification library. Enforced by an import-boundary lint rule. |
| AR-12 | Test seams are constructor arguments (`Database`, `Clock`, `AuthProvider`, `RemoteStore`, `Notifier`); no module mocking, and the same fakes serve unit, integration and end-to-end tests. |
| AR-13 | The conflict notice payload is a JSON list of `{table, id, label}` stored whole — never capped — under `local_meta.conflicts_pending`, because a counter cannot name the affected parts; the screen truncates the display. The rebuild also stores `notifications_built_for` there. This was the amendment applied to doc 07 §4.10 and TRD §10.3 (D-86). |
| AR-14 | Sign-out is local and immediate: it clears the session and keeps every row, including queued ones. The only destructive confirmation is the account-switch wipe, which names how many rows are still unsynced. |
| AR-15 | A pull never overwrites a queued local row that wins the merge predicate: the local row is kept, stays dirty and is pushed on the next pass. A pulled row wins only when it wins the envelope comparison. |
| AR-16 | No orphan repair is written. Soft deletes plus a parent-first transactional push make an orphan impossible; a foreign-key failure rolls back the batch and holds the cursor. Child tables carry composite `(parent_id, user_id)` keys to `unique (id, user_id)` on `cars` and `parts`; `parts.category_id` stays a plain key because system categories have no `user_id`. |
| AR-17 | Deep links are `carmaint://mileage` and `carmaint://part/<url-encoded-id>`. Notification payloads carry ids and a kind only, never text, names or amounts; an unknown target falls back to the home screen. Frozen now, because scheduled notifications bake the URL into the OS (D-72). |
| AR-18 | The paused notice and the 8 reserved slots exist only while reminders are enabled. With reminders off the window is zero days, nothing is reserved, and part alerts take the whole notification ceiling. |
| AR-19 | A retry decision follows the engine error, not the phase: constraint, `CHECK` and foreign-key failures go to `blocked`; `SQLITE_FULL`, `SQLITE_BUSY` and I/O failures go to `backoff` with the cursor unchanged. |
| AR-20 | Errors cross layer boundaries as typed codes, never as sentences. Repositories, the engine and the remote adapter return enum members; only the UI layer maps them to i18n keys, and document 08 maps server errors into the same set. |

### 14.2 Open questions

| ID | Question | Status |
|---|---|---|
| OQ-14 | Answered here: refuse sync for an outdated client, no grace period (AR-08, D-81). The alternative would double the merge surface for a client the owner installs by hand. | Closed 2026-11-01 |

No open questions remain in this document. OQ-15, OQ-16 and OQ-17 remain owned by documents 11, the owner and 12.

---

## 16. Follow-ups

| Document | Point |
|---|---|
| Owner | Done 2026-11-01: AR-01 to AR-20 approved as D-74 to D-93, OQ-14 closed. |
| 07 Database | Done 2026-11-01 (v0.5): `conflicts_pending` and `notifications_built_for` described in §4.10 and §9; `unique (id, user_id)` and the composite foreign keys added; the orphan question closed as structurally impossible and removed from §14.2. |
| 05 TRD | Done 2026-11-01 (v0.5): §5.5 and §10.3 aligned; the orphan and composite-key follow-ups removed from §18.5; OQ-14 noted closed. |
| 08 API | The two function payloads, the error body shapes and the mapping of server errors onto the AR-20 codes. The deep-link grammar is already frozen (AR-17); only destination screens remain, with 04. |
| 09 Security | Threat model for RLS, the service-role key, the local database, and the capability table of §11. |
| 11 Testing | Turn §13 seams and the §10.2 matrix into test cases, including the contract suite that runs the fake's scenarios against the real functions; real-device checks for notification and pull latency. |
| 12 Deployment | The cold-start migration screen, the operator steps of §6 AF-12, and the re-signing routine. |
| 03 SRS | Done 2026-11-01 (v0.6): C-03 and the external-dependencies table now name Supabase, and NFR-083 no longer speaks of a fallback backend. |

---

## 16.1 Local-first connection amendment

Fresh installs route to local car setup, not sign-in. A dedicated account-connection coordinator owns authentication, the pre-claim pull, backup offer, upload confirmation, validated cloud staging, atomic replacement, cancellation, and state changes. The sync engine is idle for `unlinked` and `signed_out` profiles and exposes `Not connected`; repositories and notifications continue normally.

The coordinator stages a cloud dataset before requesting the write-gate transaction that replaces the local profile. A same-account reconnection resumes sync; a different account requires confirmed local-profile erasure. A read-only export service beside the repositories can export any profile state without sync involvement.
