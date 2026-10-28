# Transactional ticket distribution

Independent `ORDER BY random() LIMIT 1` sampling allowed repeated editions before
the collection had been exhausted. New issuance uses a server-only shuffle bag.
Historical assignments are intentionally unchanged.

## Activation and invariants

The additive `ticket_shuffle_bag` migration initializes cycle 1 with a random
permutation of the 12 original enabled edition IDs and `next_position = 1`.
No historical ticket consumes a position. The server-generated `activated_at`
records initialization; successful migration **commit** is the activation boundary.
The cutover briefly takes the existing reporting advisory lock exclusively,
draining in-flight old claim transactions before replacing the issuance core.
If the lock cannot be acquired within five seconds, migration aborts atomically;
inspect activity before retrying. No reporting reset is performed.

For successfully committed **new** tickets, claims 1–12 contain each edition once,
13–24 contain each once again, and claim 25 starts cycle 3. Each cycle is shuffled
independently with Postgres randomness. An edition can appear on either side of
a cycle boundary; two independently shuffled permutations can theoretically be
identical. There is no prohibition on duplicates across different cycles.

`private.ticket_distribution` stores the activation time, fixed catalog IDs,
current permutation, cycle number and next position. Position 13 means the current
cycle is exhausted; the next successful new issuance reshuffles and advances the
cycle. The total consumed slots is `(cycle - 1) * 12 + next_position - 1`.

## Transaction and permissions

The existing public service-role-only RPC and Edge response contract are unchanged.
The core still takes the owner advisory lock and returns an existing ticket before
touching the distribution state. Lookup, refresh, repeated claims and redeemed
ticket recovery consume no slots and do not wait on the bag's row lock.

Only a new claim calls `private.draw_ticket_edition()`. It takes a shared catalog
table lock to prevent concurrent configuration edits, then locks the singleton
distribution row `FOR UPDATE`. It verifies that the queue and enabled catalog both
match the original 12 IDs, draws the next edition and advances the position.
Ticket insertion, 256-bit credential creation and the draw commit together. Any
error rolls all three back, including a new permutation at rollover. A sequence
number may have a gap following failure, as before; that does not consume a bag slot.

Different owners serialize only for their short new-ticket transaction; lookup and
admission do not acquire a distribution lock. Existing reporting coordination is
preserved. RESET COUNT has no access to or effect on the bag.

The table is in the unexposed private schema with RLS and no client policies.
Anonymous/authenticated roles have no table or helper access. The service role
can read and update only the mutable queue fields, not insert/delete/reinitialize
the bag or change its catalog/activation time. Functions use SECURITY INVOKER,
empty search paths, explicit schema names and restricted EXECUTE grants.
Catalog corruption, missing state or unexpected enabled IDs fail closed; there is
no fallback to unrestricted randomness. Fix catalog configuration server-side
after investigation; do not reset the bag to repair an unrelated reporting period.

## Verification

`npm test` runs isolated Postgres/PGlite tests covering 12/24/25 claims,
independently shuffled permutations, historical row/credential preservation,
idempotency, lookup, rollback at rollover and after credential insertion, invalid
catalog/queue configuration, permissions, original-artwork mapping, permanent
used-QR invalidity, admission events, and reporting/reset independence.

Release verification also uses separate hosted Postgres connections against an
isolated disposable schema with synthetic users and copied issuance/reporting
functions. It tests 24 overlapping new claims across two cycles and concurrent
retries by one owner. Only fixture tables are written; no actual Auth users,
production tickets, redemptions or counting resets are created for these tests.
The fixture schema is removed afterward. Production ticket and private-credential
row digests and counting-history digests are compared before/after; credentials
are hashed on the server and are never included in logs or public documentation.

No frontend change, Edge Function redeployment or GitHub Pages build is required.
Existing QR formats, one-time redemption, Realtime policies, dashboard/History,
artwork geometry, quotes and animations remain unchanged.

## Production rollout — 28 October 2026

Applied migration `20261028154151_ticket_shuffle_bag.sql` only to project
`hefzzwfmpdukwceuwgqr`. Server initialization time:
`2026-10-28T15:41:51.374297Z` (17:41:51 Europe/Athens). The first read-only
verification found cycle 1, next position 1, zero consumed slots and 12 distinct
queued editions. Subsequent genuine guest claims advance it normally.

All 30 pre-rollout ticket rows and 30 private credential rows matched their
server-side pre-rollout digests afterward. Reporting/history, other function
definitions, RLS policies and existing constraints also matched. Read-only
recovery and scanner validation confirmed 20 issued credentials remained VALID
and 10 redeemed credentials remained ALREADY_USED, without consuming any slots.
No real ticket, admin counting baseline or redemption was changed for testing.

Validation passed: 144 automated tests, typecheck, lint, production build,
original-artwork integrity checks, and 16 isolated hosted checks including 24
overlapping new claim transactions and eight simultaneous same-owner retries.
The hosted fixture schema was removed. `guest-ticket` remains version 1 and
`admin-ticket` remains version 3; neither required redeployment.
