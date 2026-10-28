# Current counting periods and permanent History

The admin hash routes are Scanner (`#/admin/scan`), The night (`#/admin/dashboard`) and History (`#/admin/history`). All require the existing permanent-admin Auth session and current private allowlist authorization. Guest sessions remain separate.

## Metric definitions

All three dashboard headline counters and the edition table use the latest reset timestamp as their period start. Before any reset, the first period includes all existing records.

- Generated: tickets created in this period.
- Admitted: tickets redeemed in this period, including tickets generated earlier.
- Waiting: tickets generated in this period that are still unredeemed. This can never be negative; it is independent of Admitted and is not the count of all valid tickets.

History displays the current all-time generated, admitted and outstanding valid-ticket totals as separate operational statistics. This keeps pre-period valid tickets visible without mixing them into the resettable headline counters.

## Confirmed resets and snapshots

The existing RESET COUNT confirmation now explains that all three period counters restart and the closing period is archived. Cancel/Escape sends no request. A confirmation retains one request UUID across retries; a repeated UUID never creates another audit entry or snapshot. A reset response includes the authoritative new period, followed by a normal dashboard refresh. Activity that occurs after reset can legitimately increase these counters before refresh finishes.

The additive `counting_period_snapshots` migration extends `private.admission_count_resets` with nullable `period_start` and `snapshot` columns. It does not insert a baseline, backfill history, update tickets, change ownership/credentials/redemption timestamps, delete users, or restart a ticket sequence. Each new reset inserts one audit row containing its server cutoff, admin ID, previous period start and frozen metrics, edition distribution and lifetime totals at closing. SELECT/INSERT-only service-role permissions preserve append-only history; guests and ordinary authenticated roles cannot read or execute these admin operations.

Existing legacy audit entries keep their original IDs, timestamps and resetting admin. Their snapshot fields remain NULL and are explicitly shown as unavailable. We do not reconstruct supposed immutable statistics from today's mutable ticket statuses. The first new reset captures the actual current period beginning at the last legacy baseline.

## Boundary and concurrency guarantees

Periods are half-open intervals `[start,end)`. Issuance and admission hold the same shared transaction advisory lock; reset takes its exclusive counterpart. Reset waits for earlier writers to commit before capturing `clock_timestamp()` and saving the snapshot/baseline atomically. Writers starting afterward wait for reset commit. The original issuer and atomic redemption implementations remain private and unchanged; their public wrappers coordinate this lock.

The ticket `created_at` default for future inserts is now `clock_timestamp()` rather than transaction-start `now()`. This is essential when an issuing transaction begins before a reset but waits for its lock: its timestamp must be assigned after the wait. No existing creation timestamp changes. There are no client-supplied period cutoffs.

## Read-only History

`admin_counting_history` returns paginated audit rows, immutable snapshots and live operational totals. The Edge `periods` action accepts only a bounded numeric before-ID cursor and checks authorization again in SQL. Newest periods appear first, with expandable local Europe/Athens timestamps including seconds, exact stored UTC boundaries, resetting admin ID, edition distribution and lifetime statistics at closing. Legacy statistics are marked unavailable. There are no edit, delete or reset controls on this page.

Detailed admission history remains separately paginated by exact redemption timestamp and ticket UUID using the existing read-only `history` action. Period IDs and admission cursors are not QR credentials.

## Verification boundary

Automated local fixtures test legacy migration preservation, 0/0/0 resets, new generation and admission, older valid tickets, used QR rejection, second resets, frozen waiting snapshots, half-open boundaries, independent counters, pagination, authorization and Europe/Athens time. Hosted fixture tables/functions use a separate private schema and lock key; genuinely concurrent CLI sessions test issuance on both sides of reset, in-flight admission, duplicate requests and distinct resets. The fixture schema is removed afterward.

Browser tests intercept admin responses for reset/History interactions, navigation, cancellation, network retry, separate devices and login persistence. No real production reset is performed for verification. Production checks read actual dashboard/history RPCs and their privileges, compare ticket and legacy-audit fingerprints, and check the deployed public assets. Physical-device camera/Safari testing is not implied.
