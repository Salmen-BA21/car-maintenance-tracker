# SAD · Archived sections

Change log and traceability tables moved out of the default reading path. Not needed to implement; read for audit history only. Source document: `05-architecture/06-system-architecture.md`.

## 15. Traceability

| Requirement | Where addressed |
|---|---|
| FR-001 to FR-006 | §6 AF-03, AF-11; CMP-09; §9 ownership |
| FR-020 to FR-027 | §6 AF-04; CMP-07; §10 field class |
| FR-030 to FR-037 | §6 AF-06; §9 reference data |
| FR-040 to FR-049 | CMP-04 pure domain; TRD §5.6 recompute list; §5.4 day rollover; §6 AF-04 |
| FR-050 to FR-056 | §6 AF-05 |
| FR-060 to FR-063 | §6 AF-06 |
| FR-070 to FR-075 | §3.1 dependency rules; CMP-02, CMP-03 |
| FR-080 to FR-094 | §8 scheduler; §6 AF-09, AF-10; AR-18 conditional pause notice |
| FR-100 to FR-106 | §1, §4, §7, §9 |
| FR-110, FR-111 | CMP-07 settings repository; §5.1 |
| NFR-001 | §5.1 critical path |
| NFR-002 | §4.4, §6 AF-04 |
| NFR-003 | §7.4 debounce |
| NFR-010, NFR-011 | §4.3 write gate, §6 AF-02 |
| NFR-012 | §7.7 classification, §7.9 |
| NFR-021, NFR-023 | §2.2, §11 |
| NFR-022, NFR-024 | §11 token handling |
| NFR-025 | §2.2 data at rest |
| NFR-030 | §10.3 logging, §9 ownership |
| NFR-050 | §6 AF-10, AR-17 |
| NFR-070 | §10.1 typed codes, CMP-15 |
| NFR-080, NFR-081 | CMP-06, §9 reference data |
| NFR-082 | §7.8, CMP-12 |
| NFR-083 | §3.2 composition root, §13 seams |
| D-28, AC-21 | §5.1, §6 AF-02 |
| D-35 | §7.6 merge rules |
| D-49, A-06 | §8.2 snapshot and budget |
| D-50 | §6 AF-04, AF-09 |
| D-02, D-60 | §9.1 transactional apply, AR-16 |
| D-58 to D-60 | §2.2, §7, §11 |
| D-70 | §6 AF-07, §7.6, AR-13 |
| D-73, OQ-14 | §7.7, §6 AF-12, AR-08 |

## 17. Change log

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-11-01 | First version: architectural drivers, system context and trust boundaries, component catalog with a dependency and an import-boundary matrix, execution model with the write gate and post-commit pipeline, process lifecycle, twelve runtime flows, the sync state machine with visible-state derivation, trigger table, pass algorithm, local merge rules and failure classification, notification scheduler placement and rebuild algorithm, data ownership, the error and degradation matrix, security capabilities, extension points, test seams, AR-01 to AR-15, traceability and follow-ups. |
| 0.2 | 2026-11-01 | Revision after an owner grilling round. Sign-out is now local and immediate; the only destructive confirmation is the account-switch wipe (AR-14 rewritten), so the sign-out flush and its trigger are gone. The pipeline requests sync before the rebuild; one global change counter replaces per-table invalidation. AR-13 stores the conflict list whole and adds `notifications_built_for`. AR-16 closes the orphan question as structurally impossible and adds composite keys; AR-17 freezes the deep-link grammar; AR-18 makes the paused notice and its reserved slots conditional on reminders being enabled; AR-19 classifies retries by engine error so a full disk is not `blocked`; AR-20 makes errors cross layers as codes. The in-memory remote is now guarded by a contract suite against the real functions. |
| 0.3 | 2026-11-01 | Approved. AR-01 to AR-20 promoted to D-74 to D-93 in the README register; OQ-14 closed; follow-ups for documents 05 and 07 marked done after their amendments landed. |
| 0.4 | 2026-11-01 | Added the local-first startup, account-connection coordinator, idle unlinked sync state, staged cloud replacement, same-account reconnection and read-only export-service amendment. |
