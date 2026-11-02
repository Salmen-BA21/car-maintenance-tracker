# API · Contract tests

> Part of [08-api-specification.md](../08-api-specification.md). Sections: §10. Section numbers are unchanged, so references such as "doc 07 §5.2" still resolve.

## 10. Contract tests

The scenario list is small enough to run against the real functions in CI, on the Supabase CLI stack, next to the in-memory fake (D-66, D-85). Each line is one assertion of this document, not of the UI:

1. A batch spanning all seven tables applies in one call and returns every key in `applied`.
2. A replayed batch returns the same keys in `rejected` and changes no `sync_seq`.
3. A batch whose car loses the predicate returns that key in `rejected`, and the following pull returns the winning version.
4. A row with another account's `user_id` is `rejected`; the pull does not reconcile it; the engine blocks.
5. A batch with an unknown table or column returns `INVALID_PAYLOAD` and writes nothing.
6. A row violating a `CHECK` returns `CONSTRAINT_VIOLATION` and rolls the whole call back.
7. `pull_rows(0)` on a second account returns only that account's rows, never the first's (two-account RLS test, D-66).
8. An empty delta returns `rows: []` with `max_seq` equal to the cursor.
9. `schema_version` changes after a migration and the app refuses to sync with `CLOUD_SCHEMA_NEWER`.
10. A `401` produces `SESSION_EXPIRED` and no partial write; a `429` and a `503` produce `RATE_LIMITED` and `SERVER_UNAVAILABLE`.
11. A tampered response (a row missing a column, a timestamp in the wrong shape) produces `RESPONSE_INVALID`, not a partial apply.

Items 3–6 and 11 are the ones a fake cannot prove; they are the reason the suite runs against the real functions.
