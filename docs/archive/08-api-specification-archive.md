# API · Archived sections

Change log and traceability tables moved out of the default reading path. Not needed to implement; read for audit history only. Source document: `docs/07-api/08-api-specification.md`.

## 11. Traceability

| Requirement | Where addressed |
|---|---|
| FR-101 | §1 (both endpoints), §4.1, §5.3 |
| FR-102 | §4.3 step 2, §5.2 (invoker under RLS) |
| FR-103 | §4.3 step 3, §4.4, §5.2 |
| FR-104 | §5.2, §5.4 |
| FR-105 | §6.3 (codes feed the badge) |
| FR-106 | §2, §4.1 (envelope travels with every row) |
| NFR-012 | §4.4 |
| NFR-020 | §3 |
| NFR-021 | §4.3 step 2, §5.2 |
| NFR-022, NFR-024 | §3 |
| NFR-023 | §3, §9 (payload carries no secrets) |
| NFR-070 | §6.1, §9 |
| C-03 | §1, §3 |
| D-35, D-70, D-86, D-88 | §4.2, §4.4, §5.2 |
| D-58, D-59, D-60 | §1, §4.3, §5.2 |
| D-61 | §8 |
| D-81 | §7 |
| D-89 | §4.3 step 2, §5.2 (composite keys make a cross-owner row fail) |
| D-90 | §9 |
| D-93 | §6.1, §6.3 |

## 14. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First version: the two-function surface, request and response shapes, wire conventions (timestamps, flags, nulls), authentication rules, the row-level versus call-level split, the typed error vocabulary and its HTTP/SQLSTATE mapping, the client-side schema handshake, the clock contract, notification payloads and the deep-link encoding, the contract-test scenario list, API-01 to API-12 and OQ-18. |
| 0.2 | 2026-11-01 | Revision after an owner grilling round. The monotonic clock guard and the offset from either response are now API-13, so three-digit milliseconds are safe and the push response's `server_now` is no longer dead weight. The notification `kind` enum drops `permission`, which is a screen state and never an OS record. Kept as reviewed: `rejected` stays a bare key list (the pull is the arbiter), one call and one transaction per pass, a client-side handshake, retry on an unclassified failure, server-side response ordering, `max_seq` as a greatest-of, and the synced `users.email`. |
| 0.3 | 2026-11-01 | Approved: API-01 to API-13 promoted to D-94 to D-106. No content change. |
| 0.4 | 2026-11-01 | Added the pre-claim `pull_rows(0)` rule, atomic initial profile upload, unlinked-call guard, and cancellation/session-cleanup behavior. |
