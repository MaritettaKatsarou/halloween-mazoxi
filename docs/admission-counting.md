# Admission counting baseline

Superseded metric semantics: V2 resets Generated, Admitted and Waiting for the current period and moves lifetime totals plus frozen archives to the dedicated History route. See [counting-periods.md](counting-periods.md). The notes below describe the original admission-only baseline implementation.

RESET COUNT changes only the dashboard's counting window. It never deletes a ticket, updates a redeemed status, reissues a credential, changes a redemption timestamp or alters the guest admission animation.

## At the door

Open `#/admin/dashboard` with an authorized permanent admin account. REFRESH COUNTS and RESET COUNT sit together below edition distribution, recent arrivals and the history disclosure. RESET COUNT opens a modal explaining the effect; CANCEL or Escape sends no reset request. Confirm shortly before the party when you are ready to start counting arrivals.

Until the first reset, admissions are labeled **Admitted · all time**. Afterward, **Tonight admitted** counts successful redemptions at or after the saved server timestamp. A ticket issued earlier still counts when it is admitted later. Already-used QR codes remain invalid. Generated totals are all-time; still-to-arrive totals always include every issued, unredeemed ticket. Edition issuance is all-time, while its admission column follows the displayed counting window.

The primary arrivals list shows the latest 20 entries in that window. Expand **All-time admission history & reset audit** to browse every admission using keyset pagination and view the latest 20 resets. All older reset audit rows remain stored privately. Times are displayed in Europe/Athens. Lifetime admission totals remain visible independently of the event counter.

## Backend

Migration `20261028123841_admission_count_baseline.sql` creates the private append-only `admission_count_resets` audit table. Its latest identity-ordered row defines the baseline; no row is inserted by migration or deployment. Each row stores a unique request UUID, a database-generated timestamp and the authorized resetting admin UUID. Service-role permissions allow only SELECT/INSERT on this table; guests and ordinary authenticated users have no table or RPC access.

The original `admin_ticket_action` body is moved unchanged to `private.admin_ticket_core`. The public wrapper retains the original service-only, permanent-admin allowlist checks. Redemptions obtain a shared transaction advisory lock; resets obtain the matching exclusive lock and then capture `clock_timestamp()`. This lets independent admissions proceed concurrently while making a reset wait for earlier admissions to commit. Admissions beginning afterward wait for the reset to commit. Distinct simultaneous resets are ordered by the lock and audit identity. The last serialized reset wins.

The `admin-ticket` Edge Function accepts `reset-count` only with a valid UUID request ID, after Auth.getUser and a fresh private allowlist check. It calls `reset_admission_count`, which authorizes again inside the database transaction. No client baseline timestamp or admin identity is accepted. Reusing a request ID returns its original result without creating another reset or moving a newer baseline. The same confirmation retains its ID if the network response is lost; canceling and refreshing retrieves the authoritative current window. There is no automatic reset retry on a transport error.

The read-only `history` action calls the service-only `admin_admission_history` RPC. History cursors contain a redemption timestamp and UUID; no bearer QR credential is returned. Existing credential verification, atomic ticket redemption and private Realtime rules remain unchanged.

## Verification and deployment boundary

Local automated fixtures cover zero baseline at migration, authorized resets, guest/revoked denial, exact preservation of tickets/credentials, 0 → 1 → 2 later admissions from pre-issued tickets, used QR rejection, lifetime/remaining totals, idempotent retries, retained reset audits and paginated history. Hosted disposable fixture tables/functions use a separate private schema and advisory lock key; no real guest ticket or production baseline is reset. Separate CLI/database transactions verify actual overlapping reset requests and reset versus in-flight admission ordering. The fixture schema is removed afterward.

Browser checks use intercepted synthetic admin responses to exercise bottom controls at 320/375/390/430px, confirmation/cancel/keyboard behavior, reload, separate devices, logout/login, history and recovery after a lost response. Production verification must never confirm a real reset just to test deployment. Check the real migration audit table is still empty, inspect permissions and use read-only production dashboard queries. Physical camera/iOS testing is separate and is not implied by these checks.

Official references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [Postgres transaction advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS).
