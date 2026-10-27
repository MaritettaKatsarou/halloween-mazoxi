# Phase 4 — private admission and hanging souvenir

Implemented in `C:\Users\marit\Documents\halloween-mazoxi`. Only the verified `halloween-mazoxi` backend (`hefzzwfmpdukwceuwgqr`) was changed. The frontend has not been published. No new Edge Function deployment was necessary: the existing atomic `admin-ticket` operation now activates a database trigger.

## Database deployment and authorization

Applied migration: `20261027202935_private_admission_broadcast.sql` (confirmed in hosted migration history).

- `ticket_admission_owner_receive` allows authenticated users, including anonymous Auth guests, to receive Broadcast on exactly `ticket-admission:<their-ticket-uuid>`. It joins `public.tickets` against `auth.uid()` and `realtime.topic()`. Other ticket owners, unknown topics and unauthenticated requests are denied.
- `ticket_admission_no_client_publish` is a restrictive INSERT policy protecting the ticket-admission namespace. No permissive client publishing policy exists. Guests cannot publish authoritative messages.
- `private.broadcast_ticket_admission()` is a trigger-only SECURITY DEFINER function with an empty search path. EXECUTE is revoked from PUBLIC, anon, authenticated and service_role. It sends only after a genuine issued-to-redeemed transition with a redemption actor and timestamp, unchanged ticket ID and unchanged owner.
- The private `admitted` event contains only `ticketId`. Supabase adds its transport event `id`; no ticket row, QR, hash or owner identity is broadcast.
- `realtime.send` inserts in the redemption transaction. A rollback removes the notification. Hosted tests verified that the received event followed a committed redeemed row. Repeated/invalid/unauthorized redemptions emit no admission event.

The user disabled **Realtime → Settings → Allow public access**. Hosted public-channel subscription rejection confirms this setting is effective. No further Realtime Dashboard change is required. Keep it disabled. No Postgres Changes publication or table replication setting is needed for Broadcast.

Supabase's send helper can log a warning rather than abort the transaction if Broadcast delivery fails. Redemption remains authoritative and final. The client recovery paths intentionally cover missing notifications; a websocket cannot guarantee uninterrupted delivery on a sleeping phone.

Official references: [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [database Broadcast](https://supabase.com/docs/guides/realtime/broadcast).

## Guest flow and recovery

The guest client retains its anonymous session separately from the permanent admin client. It authenticates Realtime with that guest session and joins with `private: true`. A matching notification only requests an owner-authenticated `guest-ticket` lookup. The controller checks identity and accepts admission only from the authoritative response.

The subscription's SUBSCRIBED callback re-fetches status after the initial join and every rejoin, closing the initial-load/subscription race. Visibility, online events and a 30-second visible-page fallback also recheck the database. Requests are serialized with queued refreshes so an event arriving during a fetch is not dropped. Account changes invalidate in-flight results and remove the former ticket channel. Failed subscription setup is retried on a later refresh.

State is ISSUED → ANIMATING → REDEEMED. Repeated events do not restart the animation. An already redeemed ticket on initial load goes directly to REDEEMED without replaying the tear. The backend suppresses its active QR and permanently rejects the copied original credential. The development simulation only changes local React state and cannot restore database validity.

## Physical animation

The existing Ticket component, original PNGs and QR layout configuration are reused. Each edition's perforation and lower-left hinge define the same pivot in both fragments' coordinate systems. The main and stub masks retain a small common paper hinge and an asymmetrical edge. Rotation settles front-facing before the tear, then the stub swings below the main artwork with restrained oscillations, ending at 116 degrees from its original right-hand position. The configured QR center ends below the ticket for every edition.

The original ADMITTED typography, warm ink colors and placement are retained. Final tickets stay stationary and hanging after refresh. Reduced motion uses the final state directly. Stage space is reserved before admission; the scan-ready card keeps its dimensions when its invalid QR becomes a souvenir message. No audio was added.

## Verification

- `npm run typecheck`: frontend, Edge Function and test TypeScript targets pass.
- `npm run lint`: passes.
- `npm test`: 91 tests in 13 files pass, including existing Phase 2/3 tests.
- `npm run build`: passes; artwork audit confirms all 12 original PNG hashes, dimensions and QR bounds.
- Geometry tests cover all 12 exact pivots, final QR location, shared mask hinge, reserved height and the full swing envelope within a 320px viewport. These are mathematical checks, not screenshots.
- Hosted integration: 22 checks pass for private owner access, foreign/unknown/unauthenticated denial, public-channel rejection, denied WebSocket and modern REST publishing, no private delivery from legacy REST batch publishing, guest redemption denial, invalid QR rejection, transaction rollback, genuine committed event delivery, minimal payload, unrelated-owner isolation, one event only, missed-event/reconnect recovery, redemption before join, restored sessions and permanent QR invalidity.

The legacy REST batch API acknowledges a batch even when a private message is rejected; the harness therefore verifies **no event delivery**, rather than treating its HTTP success as authorization. Modern `httpSend` rejects the unauthorized message. The first harness attempt stopped on that overly strict HTTP-status assertion before redeeming anything. The corrected run passed all 22 checks.

Only newly created disposable guests were used. Their retained records affect dashboard counts:

| Run | Ticket numbers | Final status |
| --- | --- | --- |
| `b059636a-8640-4111-97e9-ceb5439d7955` | HM-7, HM-8, HM-9 | issued (initial assertion stopped the run) |
| `812c5ebd-757e-4675-9deb-4e339b34afcb` | HM-10, HM-11, HM-12 | redeemed |

These accounts carry `phase4_test_run` metadata. No pre-existing party ticket was redeemed or deleted by Phase 4 testing. HM-3/HM-4 remain issued; the earlier Phase 3 HM-5/HM-6 test admissions retain their earlier timestamps. The disposable permanent test admin was disabled, banned and its sessions removed. The ignored one-use login fixture was consumed/deleted, password memory cleared, and the temporary hashing dependency removed.

The optional hosted harness is `scripts/test-realtime-live.mjs`, with `scripts/run-realtime-live.mjs` as its terminal orchestrator. Use only a new, confirmed, allowlisted disposable admin and the ignored `.artifacts/phase4-test-auth.json` fixture containing `adminEmail`/`adminPassword`; never use a personal host account or put passwords in shell arguments. It prints the new test IDs and pauses before redemption for a trusted transaction-rollback check. Do not type `continue` until that check has actually run. Disable the disposable admin afterwards. Normal `npm test` needs no hosted credentials.

## Two-device test

1. For a concrete local two-device test, use a laptop with a camera as admin and a phone as guest, both on the same Wi-Fi. Run `npm ci`, then `npm run dev -- --host 0.0.0.0` on the laptop. Allow the development server on your private network if prompted. Read the LAN URL printed by Vite; open `http://<laptop-LAN-IP>:5173/halloween-mazoxi/` on the guest phone. The guest page does not require camera permission.
2. Use a fresh disposable guest browser profile, claim a ticket, record its display number, and leave its ticket visible. Select PRESENT MY QR.
3. On the laptop open `http://localhost:5173/halloween-mazoxi/#/admin/login`. Localhost is a secure camera context. Sign in with your authorized permanent account (setup remains in `phase-3.md`), then open the scanner and allow the laptop camera. If using a second phone as admin instead, serve the development app through an HTTPS origin first: plain LAN HTTP cannot request its camera. No frontend publication was performed for this phase.
4. Scan the guest code, verify the actual assigned artwork and display number, and tap ADMIT once. Watch the guest phone: rotation settles, the tear opens, the stub remains attached below at its lower-left pivot, and ADMITTED appears. Admin shows success and SCAN NEXT.
5. Reload the guest page: the final hanging souvenir should appear immediately without replay. Rescan a previously saved copy of the QR: ALREADY USED, with no second admission.
6. Repeat with a second disposable guest: disconnect its network before admission, admit it on the admin phone, then reconnect/foreground the guest page. It must recover the final redeemed state from the database.
7. Enable reduced motion and repeat with another disposable ticket. Check final hinge placement and readability for the 12 editions using the development review/simulation controls; these controls never redeem tickets and are absent from production.

No browser/native surface was connected. Actual visual animation inspection, browser refresh UI, physical iOS/Android cameras, torch and paper motion on physical devices remain **unverified**. Complete these checks before relying on the experience at the door.

## Files

New: `src/lib/admissionRealtime.ts`, `guestTicketController.ts`, `admissionGeometry.ts`; `tests/admission-subscription.test.ts`, `guest-controller.test.ts`, `admission-geometry.test.ts`, `admission-realtime-database.test.ts`, `helpers/realtime.ts`; the Broadcast migration; the two hosted Realtime scripts; this guide.

Changed: `src/App.tsx`, `components/Ticket.tsx`, `hooks/useGuestTicket.ts`, `hooks/useTicketRotation.ts`, `lib/artworkLayout.ts`, `lib/guestTickets.ts`, `styles.css`; existing guest-client/admin-database tests; README. Prior Phase 3 changes remain in the working tree. Original artworks, edition filenames/URLs, issuance logic, admin scanner, atomic redemption and QR credential format were preserved.

Security Advisor still reports intentional anonymous owner access (including the new owner-scoped Realtime policy) and no policies on inaccessible private backend tables. It also reports the existing [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), which was not changed. Anonymous access is necessary here and remains owner constrained; see the [Advisor explanation](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins). No Git commit or GitHub Pages publication was performed.
