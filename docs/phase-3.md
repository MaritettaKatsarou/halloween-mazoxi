# Phase 3: admin scanner and one-time admission

Implemented and deployed only to the verified **halloween-mazoxi** Supabase project, `hefzzwfmpdukwceuwgqr`. The additive migration is `20261027193042_admin_admission.sql`, matching hosted migration history. `admin-ticket` Edge Function version 1 is active. The Phase 2 `guest-ticket` function, issuing transaction, credential format, RLS owner policy, edition assignments and original PNGs were preserved.

## Create your first real administrator

1. Open [this project's Authentication Users page](https://supabase.com/dashboard/project/hefzzwfmpdukwceuwgqr/auth/users). Confirm the project name is **halloween-mazoxi**.
2. Choose **Add user → Create new user**. Enter your own email and a strong unique password directly in Supabase Dashboard. Confirm the email using the Dashboard's confirmation option or the normal email-confirmation flow. This must be a permanent email/password user, not one of the anonymous guests. No registration form exists in the application.
3. Copy the new user's UUID from Authentication → Users. Do not send any password, access token or service key in chat.
4. Open the same project's SQL Editor. Paste `supabase/admin-setup.sql`, replacing `REPLACE_WITH_PERMANENT_USER_UUID` with your copied UUID. Execute only the INSERT statement. It selects only confirmed permanent email users. Confirm it returns exactly one row with `enabled = true`. Zero rows means the UUID/email confirmation/account type needs checking.
5. Run `npm run dev`, then open **http://localhost:5173/halloween-mazoxi/#/admin/login** and sign in with that account. The scanner opens after the server confirms the allowlist entry.
6. Authorize additional hosts in the same way. To revoke one, execute the commented UPDATE from the setup file separately, using that user's UUID. Revocation takes effect on their next protected request without waiting for a JWT refresh. Keep the user record for admission attribution rather than deleting an admin referenced by admitted tickets.

The integration-test admin is **not** your real account. Its allowlist entry is disabled, its Auth account is banned and test sessions were removed after verification. There is no active test password or default admin credential for you to reuse.

Supabase Security Advisor currently reports leaked-password protection disabled. Supabase supports enabling this on Pro plans and above in Auth password-security settings; see [the current password-security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This is an existing project setting, not something the app can enable. The anonymous owner-read warning and informational no-policy notices for private tables are intentional: guests may read their own ticket, while private tables deny all guest access. See [owner-policy notice](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins) and [private-table RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Routes and session separation

Logical routes are `/admin/login`, `/admin/scan` and `/admin/dashboard`. Canonical static-hosting URLs use `/#/admin/...` under the Vite base. `public/404.html` recovers direct GitHub Pages links such as `/halloween-mazoxi/admin/scan` into their hash equivalent. Local Vite also accepts direct admin paths. No server rewrites or new framework are needed.

The guest uses its original `halloween-mazoxi:auth:v1` persisted session. The admin client uses **`halloween-mazoxi:admin:v1` in sessionStorage**, with URL session detection disabled. Closing the admin tab drops that tab's saved admin session; refreshing the same tab restores it. Admin sign-in never calls anonymous Auth; admin sign-out uses local scope and does not sign out the separate guest account. The guest component is not mounted on admin routes. Admin code and the QR decoder are loaded as separate chunks.

UI route checks are convenience only. Every protected server request verifies the actual Auth user using `getUser`, rejects anonymous/unconfirmed/non-email users, then checks the current private database allowlist. User-editable metadata never grants permission. The SQL transaction also rechecks the allowlist and permanent account identity. The function verifies its own bearer tokens, so `verify_jwt = false` supports the current signing-key formats without exposing an unauthenticated privileged endpoint.

## Scanner workflow

- **START CAMERA** requests video only, preferring the rear camera. The preview has a scanning guide, muted inline video and permission/error messages. **LIGHT ON/OFF** appears only when the selected track advertises torch support.
- Recognition is throttled, using the existing jsQR decoder. A latch accepts only the first result per camera session. Detection immediately stops tracks and decoding; no automatic redemption occurs.
- The backend validates the exact original `hm1_` + 43 base64url-character credential. The UI displays VALID, INVALID or ALREADY USED. A valid result selects its original edition and displays the full artwork, ticket number and edition name.
- ADMIT remains disabled with a loading label until that actual image decodes. An unavailable edition or failed artwork load never enables admission. Both guest and admin images share the verified `BASE_URL + encodeURI(path)` helper, retaining commas, spaces and Greek filenames.
- **ADMIT** sends the credential again; the server re-authenticates/re-authorizes and performs atomic redemption. The UI prevents concurrent local requests, while database locking independently guarantees one-time admission across devices.
- Success shows **ADMITTED** plus the authoritative timestamp and **SCAN NEXT**. SCAN NEXT starts a new camera session. ALREADY USED shows the original admission time and has no ADMIT action.
- A lost admission response clears the previous VALID result. **CHECK STATUS AGAIN** performs read-only validation before another decision, because the first request might have committed. It never assumes a failed network response means admission failed.
- Manual credential entry is available if a camera cannot be used. Values are held only in memory, hidden in the input and cleared on submission/SCAN NEXT; never put credentials in URLs or logs.

## Database and Edge Function

New private table: `private.admin_users(user_id, enabled, created_at)`, with RLS and no guest permissions. `service_role` can read and take the narrow authorization row lock; no public endpoint can create or change the allowlist.

`public.tickets` has an additive nullable `redeemed_by` foreign key for permanent admin attribution. Existing ticket fields were not rewritten. Issued rows cannot have a redeeming actor. The nullable column preserves compatibility with any legacy redeemed rows. Recent-admission and edition indexes support the dashboard.

The only new RPC is `public.admin_ticket_action(p_admin, p_action, p_credential)`, SECURITY INVOKER, empty search path, executable only by `service_role`. Guests and authenticated admins cannot invoke it directly. The `admin-ticket` Edge Function calls it with the ID returned by Auth, never an ID from request JSON.

Actions:

| Action | Behavior |
| --- | --- |
| `session` | Verify current allowlist/permanent user; return authorization only |
| `validate` | Hash the exact credential, locate the existing ticket, return VALID/INVALID/ALREADY_USED; no writes |
| `admit` | Lock the matched ticket row, check current status, atomically set redeemed status/time/admin once |
| `dashboard` | Return actual total generated, admitted, remaining, all 12 edition counts and latest 20 admissions |

Admission uses SHA-256 of the complete existing credential and `FOR UPDATE` on its matching ticket. The lock serializes simultaneous requests; only the first can observe issued state. Later requests return ALREADY_USED and the unchanged original timestamp/actor. Validation is read-only. No credential, verifier hash or owner PII is returned in admin ticket DTOs. Responses are `no-store` and errors never echo raw tokens or backend details. No scanner/Realtime changes were made to `guest-ticket`.

## Verification performed

**63 automated tests pass**, including all previous Phase 2/artwork regression tests. New tests cover permanent-vs-anonymous authorization, direct RPC/write denial, fresh allowlisting and revocation, read-only validation, first/second admission, concurrency, dashboard counts, all 12 original edition IDs, separate client storage, password login, local sign-out, route resolution and the repeated-scan latch. Typechecks include frontend, Edge code and tests; lint and production build pass.

Hosted tests used two newly created permanent test accounts (one allowlisted, one unlisted) and two newly generated anonymous test tickets. Passwords were generated locally, never printed or committed; a one-use ignored fixture was immediately consumed and deleted. Hosted results:

- Wrong password rejected; authorized permanent login succeeded; unlisted permanent user denied.
- Admin login preserved the distinct guest session in shared browser storage.
- Anonymous, unauthenticated and metadata-forged requests were denied; direct guest RPC and status writes failed.
- Exact invalid/unknown QR credentials were rejected without ticket information.
- Validation returned the correct real edition and left status/counts unchanged.
- First redemption succeeded with timestamp and actor; both a second validation and a second redemption returned ALREADY_USED with the original timestamp.
- Six concurrent HTTP redemptions of the second ticket produced **one ADMITTED and five ALREADY_USED**.
- Real dashboard totals increased by exactly two admissions; recent activity included both test tickets.
- Phase 2 guest recovery returned the same redeemed ticket and suppressed its active QR.
- A separately authenticated test admin session lost access immediately when its allowlist row was disabled.

The two pre-existing guest tickets were checked using a before/after fingerprint of their original IDs, owners, editions, numbers, statuses and timestamps: **unchanged**. No guest tickets were deleted or overwritten. The newly created test admissions **HM-5 and HM-6 remain in the real dashboard counts** as traceable integration records. Their test admin is disabled/banned; the test sessions are gone. These are distinct from the two pre-existing party invitations.

## Local and physical-device test steps

1. Create/authorize your permanent account using the procedure above, then run `npm run dev`.
2. Sign in at `/#/admin/login`. Keep the guest page in a separate tab; opening admin must not replace its ticket or anonymous session.
3. On a guest device select PRESENT MY QR. Scan it, verify the correct artwork and ticket number, then deliberately tap ADMIT.
4. Confirm ADMITTED and SCAN NEXT. Rescan the same QR: expect ALREADY USED and the original timestamp. It must not offer ADMIT.
5. Open `/#/admin/dashboard`, refresh and confirm total/admitted/remaining and edition activity.
6. Test denied camera permission, start/stop, returning from the background and the torch on a supported phone. Camera access requires HTTPS or localhost; ordinary HTTP on a LAN IP is not a secure camera origin. For a phone, use the HTTPS GitHub Pages deployment after the existing workflow is published, or an appropriate local HTTPS setup.
7. Verify all 12 original artwork URLs still render in the development review selector. Simulate admission remains guest-development-only and never calls the real admission backend.

No browser or native app was connected during implementation. **Actual browser navigation/login interactions, physical iOS/Android camera scanning, camera permissions and torch behavior are not claimed as passed.** Automated SVG decoding and HTTP image checks are not substitutes for these physical tests.

`npm test` requires no hosted credentials. The optional integration harness (`scripts/test-admin-live.mjs`, orchestrated by `scripts/run-admin-live.mjs`) must use disposable confirmed permanent accounts created securely in Dashboard, one allowlisted and one unlisted. Its one-use credential fixture is `.artifacts/phase3-test-auth.json`, ignored by Git and deleted on startup. Never use the real host account for this harness: the final revocation step is specifically intended for the disposable test admin. The terminal orchestrator prints pass labels/record IDs only, then accepts `verify-revoked` after trusted SQL disables that test allowlist entry. It retains its new test tickets and does not reset existing guest data.

## Files and deployment scope

Created: `src/admin/` (login shell, session client, camera scanner, scan-result flow, dashboard, scan latch and scoped CSS); `src/AppRouter.tsx`; `src/routing.ts`; `src/lib/artworkUrl.ts`; `public/404.html`; the new migration; `supabase/admin-setup.sql`; `supabase/functions/admin-ticket/`; `_shared/admin-handler.ts`; four `tests/admin-*.test.ts` files; two admin integration scripts; this guide.

Changed: `src/main.tsx` to select guest/admin routes, `Ticket.tsx` to share its unchanged URL resolution, generated database types, Supabase function configuration, package/lock files (moving the existing jsQR decoder to runtime dependencies), and README. No guest animations, original PNGs, guest credential strategy or previous migrations were changed. No new Git commit or frontend publication was requested or performed.

## Phase 4 readiness

The authoritative admission backend is ready to be the source of Phase 4 owner-private guest notifications. Atomic admission, repeat rejection, authorization and live database behavior have been verified. Realtime was deliberately **not implemented**. Existing guest focus/reload recovery can already restore redeemed state; no live event is sent. Complete the physical camera/torch checks before relying on the scanner at the party. Phase 4 should broadcast only trusted committed database changes, never a client-declared admission.
