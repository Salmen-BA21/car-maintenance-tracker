# SAD · Sync engine and notification scheduler

> Part of [06-system-architecture.md](../06-system-architecture.md). Sections: §7, §8. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 7. Sync engine

### 7.1 Responsibility

The engine owns *when* sync happens, *in what order*, and *what the visible state is*. It does not own the merge predicate (the cloud function and the apply routine implement it), the row shape (doc 07), the payload (doc 08) or the UI (doc 04).

### 7.2 Internal state machine

```
idle ──trigger──▶ scheduled ──▶ pushing ──▶ pulling ──▶ idle
                      ▲                                     │
                      └────────── backoff ◀─────────────────┘
                               (retryable failure)

blocked: entered from any state on a non-retryable failure;
only a cold start leaves it.
```

| State | Meaning | Exit |
|---|---|---|
| `idle` | No pass running, nothing queued | A trigger moves to `scheduled` |
| `scheduled` | A pass is wanted; debounce or gate not yet satisfied | `pushing`, or back to `idle` if cancelled |
| `pushing` | Push batch in flight (network, outside the gate) | `pulling` |
| `pulling` | Pull call in flight, then apply under the gate | `idle` on commit |
| `backoff` | A retryable failure occurred; a timer is running | `scheduled` on timer, `idle` if a success clears it |
| `blocked` | A failure retrying cannot fix | Only a cold start clears it |

The engine is single-flight (AR-02): a trigger arriving during a pass sets a `rerun` flag and returns. When the pass finishes, exactly one more pass runs if the flag is set. Triggers never stack.

### 7.3 Visible state

The badge shows four states (FR-105). They are derived, never stored (AR-07), with this precedence:

| Precedence | Visible state | Condition |
|---|---|---|
| 1 | Offline | No usable network, or no valid session |
| 2 | Error | The last pass failed for a non-offline reason, or the engine is `blocked` |
| 3 | Pending | `sync_dirty` is non-empty, or a pass is running |
| 4 | Synced | Nothing dirty and the last pass succeeded |

Offline outranks Error because "you are offline" is the more useful truth when both are true; Error outranks Pending because a queue that is not moving is not progress.

### 7.4 Triggers

| Trigger | Delay | Notes |
|---|---|---|
| A committed local write | 1 s debounce | Exists so NFR-003 is reachable without a call per keystroke |
| App open, after first frame | immediate | One pass on every launch |
| App foregrounded | immediate | Also checks the local date and zone |
| Network regained | immediate | Only when it was offline |
| Pull-to-refresh | immediate | User-initiated; bypasses the debounce, not the single-flight rule |
| Sign-in complete | immediate | Usually the first pull from cursor 0 |
| Backoff timer | 2 s, doubling, capped at 60 s | Reset on success, foreground or network regain |
| Midnight / date change | rebuild only | Not a sync trigger |

No trigger runs while the app is backgrounded. There is no periodic timer and no background fetch (AR-06).

### 7.5 Pass algorithm

1. Wait for `scheduled` precondition: not backgrounded, session valid, network present.
2. `pushing`: under the gate, read the dirty rows and their current values, ordered parent-first; release the gate.
3. Call `push_rows` with the batch and the JWT. Classify the result (AR-10).
4. Under the gate, clear acknowledged dirty entries by `loaded_updated_at` (AF-08 step 4).
5. `pulling`: read `pull_cursor`, call `pull_rows(cursor)`.
6. Update the clock offset from `server_now` (TRD §10.4).
7. Apply under the gate as in AF-07 step 4.
8. Publish the outcome; the pipeline requests a rebuild if rows changed.
9. A rejected id that is still dirty after the apply means the cloud refused a row the merge cannot reconcile: go to `blocked` (Data class) and stop, instead of retrying a deterministic rejection forever.
10. Otherwise set `idle`, clear the backoff, and run the follow-up pass if the rerun flag is set.

A failed push *call* — network error, 5xx, paused project — ends the pass in `backoff` before the pull (AR-02). Reading might still work, but splitting the pass would add a second state machine for little gain: a Supabase outage takes both functions together. A rejected row is not a failed call: the function returned, so the pull runs and reconciles it.

### 7.6 Merge rules on device

| Local row | Pulled row | Result |
|---|---|---|
| Clean, older | Newer | Pulled row written |
| Clean, newer | Older | Pulled row ignored (the cloud has not seen this device yet) |
| Dirty, newer | Older | Local kept, still dirty; pushed next pass (AR-15) |
| Dirty, older | Newer | Pulled row written, dirty entry cleared, conflict recorded and labelled |
| Absent | Any | Pulled row inserted |
| Present, not dirty | `deleted_at` set | Soft-deleted locally, hidden from queries |

The predicate is the cloud's: `updated_at` descending, then `origin_device_id` ascending as the tie-break (D-35). Applying it on both sides means a device that is behind cannot resurrect a row merely by reconnecting.

### 7.7 Failure classification

| Class | Examples | Engine reaction |
|---|---|---|
| Retryable | Network error, timeout, 5xx, paused free project | `backoff`, retried on timer and on the next trigger |
| Session | Expired or invalid JWT | Treated as Offline; refresh attempted once per foreground |
| Update required | Cloud `schema_version` newer than the app's | `blocked`, banner, no retries until cold start |
| Data | Local `CHECK` violation while applying a pull; a rejected push that the following pull did not reconcile | Transaction rolled back or push stopped, cursor unchanged where relevant, `blocked`, offending table and id logged without personal data |
| Programming | Missing table in the payload, malformed response | Treated as Data; the pass is not retried in a loop |

The rule behind the table: retry only what a retry can fix (NFR-012), and never loop on a deterministic failure. The engine has no path that discards local data on its own.

### 7.8 Clock

`Clock.now()` is the only source of `updated_at`; it is device time plus `clock_offset_ms`. The offset is recomputed from `server_now` on every successful pull, and a row more than 24 hours ahead of the server is restamped on push, locally as well, so the two never disagree. `LocalDate.today()` bypasses the clock entirely (D-61); mixing them would shift every status by a day near midnight.

### 7.9 What the engine deliberately does not do

- No paging of the pull, no partial apply, no resumable batch (doc 07 §9).
- No per-table conflict resolution, no field-level merge, no manual merge UI (D-70).
- No background sync, no push-triggered sync, no server scheduling.
- No retry of a rejected row as a push; the pull reconciles it.
- No "sync now" control and no last-synced timestamp: the four-state badge and pull-to-refresh are the whole surface (FR-105, AR-07).
- No UI work: it publishes state, and the badge renders it.

---

## 8. Notification scheduler

### 8.1 Placement

The scheduler is a leaf service in `src/notifications/`, called only by the post-commit pipeline and the lifecycle checks of §5.3 and §5.4. It sits beside the database, not inside it: it reads through a repository query, computes with the domain engine, and talks to the OS. That keeps three properties:

- the write path never waits for the notification system;
- a rebuild can never run inside a transaction, so it cannot observe a half-applied pull;
- the budget formula has exactly one implementation (D-63).

### 8.2 Rebuild algorithm

1. Read the snapshot inside one read transaction: `user_settings`, `cars`, `parts` with active records, inspection dates, and whether a live odometer entry is dated today.
2. Project each part's time status to each candidate date with the domain engine; distance status uses the odometer known now and is not projected (FR-082).
3. Count alerts and compute the reminder window from the budget formula.
4. Build the list: alert notifications nearest-first, then daily reminders, then the paused notice.
5. Cancel all pending notifications owned by the app, then schedule the list.
6. Store the build date for the rollover check.

If the OS refuses a scheduling call, the service schedules the rest and reports a degraded state; it never retries in a loop and never blocks a write.

### 8.3 Triggers owned by the pipeline

Odometer change, service record change, part or interval change, reminder setting change, app open, foreground, local date change, time-zone change, pull that changed parts or records, and permission granted after being denied (FR-046, FR-092). The list lives in one place so a new trigger cannot be added to only half the app.

### 8.4 Permission and channels

Permission is requested in context, when reminders or alerts are first enabled, never at launch (FR-085, AC-20). Denial schedules nothing and keeps every other feature working. On Android the two channels (`reminders`, `alerts`) are created before the first schedule so the owner can mute one without the other (D-63). No exact-alarm permission is requested; the Settings copy states that delivery may be a few minutes late.

### 8.5 Deep links

A notification carries ids and a kind only, never text, personal data or amounts, and the router resolves them after the app opens. Parsing, validation and fallback live in the notification service; navigation lives in the route layer. The grammar is frozen in AF-10 (AR-17). This keeps a notification from becoming a second, unvalidated way into the screens.
