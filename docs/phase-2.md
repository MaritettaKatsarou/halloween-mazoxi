# Phase 2: real guest tickets

## Verified hosted state

Only Supabase project **halloween-mazoxi**, ref `hefzzwfmpdukwceuwgqr`, was inspected and modified. Its API URL is `https://hefzzwfmpdukwceuwgqr.supabase.co` (the Dashboard URL is not an API endpoint). Anonymous sign-ins were enabled by the project owner and verified through Auth settings. The version-controlled migration `20261027171304_ticket_issuance.sql` was applied through the connected Supabase tool; its filename matches the hosted migration history. `guest-ticket` Edge Function version 1 is deployed and active.

No service-role key was retrieved into this checkout, printed, committed, or included in the browser bundle. The provided publishable key is used only as a public client identifier in ignored `.env.local`. Supabase injects the server-only `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` into Edge Functions. No additional signing or encryption secret needs manual configuration for the chosen opaque credential scheme.

## Authentication and issuance

On initial load, the browser restores its existing Supabase session and asks for its ticket with `action: lookup`. A new visitor does not create an account or ticket until **CLAIM YOUR TICKET**. Claiming establishes an anonymous session when needed, then calls the same Edge Function with `action: claim`.

The client coalesces concurrent clicks and uses a browser Web Lock across tabs where supported. Supabase persists the refresh/access session in localStorage under a dedicated application key. Lost or cleared sessions cannot recover the original account; another browser/device can obtain another ticket. This is one ticket per anonymous account, not one per physical person.

The function calls `Auth.getUser(bearer)` and checks the server-returned `is_anonymous` field. It rejects caller-supplied owners and editions. It invokes the database as `service_role` using the verified owner ID. It never accepts a ticket status from the browser.

`issue_guest_ticket` is a SECURITY INVOKER RPC callable only by `service_role`. Its transaction takes an advisory lock for the owner, returns an existing ticket when present, or creates the ticket and credential together. A UNIQUE owner constraint also guards against duplicate claims. Edition selection is server-side from the enabled private catalog containing exactly the 12 manifest IDs. Failures roll back the whole operation. A lost response is safe to retry.

There is no new scanner, redemption endpoint or Realtime subscription. Returning to the page or reconnecting refreshes the authoritative ticket state. The existing tear is used if the backend already returns `redeemed` in a future phase.

## Schema and access

| Object | Contents | Guest access |
| --- | --- | --- |
| `public.tickets` | Ticket UUID, unique owner UUID, edition, identity display number, issued/redeemed status and timestamps | Authenticated owner SELECT only |
| `private.ticket_editions` | The 12 allowed edition IDs and enabled flags | None |
| `private.ticket_credentials` | 256-bit opaque bearer, SHA-256 verifier, version and creation timestamp | None |
| `public.issue_guest_ticket(uuid, boolean)` | Atomic lookup/issuance for the trusted Edge Function | None |

All three tables have RLS enabled. The only guest policy is `tickets_owner_read`, with `(select auth.uid()) = owner_id`. Guests have no INSERT/UPDATE/DELETE grants, no sequence permissions and no private schema usage. The RPC's default PUBLIC EXECUTE grant is explicitly revoked. There are no SECURITY DEFINER functions or public views. Private table RLS deliberately has no guest policies, and only the service backend receives grants.

Supabase Security Advisor reports the expected anonymous owner-read policy warning, plus informational RLS-with-no-policy notices for the private tables. These reflect the intended access model: anonymous users are authenticated guests, while private tables deny them access. See [anonymous access advisor](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins) and [no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## QR credential lifecycle

Postgres `pgcrypto.gen_random_bytes(32)` creates 256 random bits. The QR contains `hm1_` followed by their unpadded base64url encoding (43 characters). It contains neither the sequential display number nor a URL carrying a token. Bearers are unique and unrelated to owner UUIDs.

The recoverable bearer is stored **only in the private backend table**, along with `SHA-256(UTF-8(full credential))`. This deliberately trusts the service backend and database administrators with recovery; it is not a hash-only storage scheme. Ordinary guests cannot fetch the private value through REST, RPC or SQL roles. The Edge Function returns it only after verifying the owner. Browser responses use `Cache-Control: no-store`; application code keeps the bearer in memory, fetches it again after session restoration and never logs it or writes it to application localStorage. The Supabase auth session itself remains browser-persisted. As with any bearer ticket, a screenshot or voluntary copy can be shared.

For Phase 3, the scanner must validate format/version, hash the entire QR, look up the private hash, and redeem with a single conditional transaction matching **both** the hash and `status = 'issued'`. A matching hash alone is never valid proof of admission. Phase 2 suppresses owner recovery of an active QR when the DB status is redeemed; the tests cover this. This phase does not expose a verification/redemption API or claim duplicate admission is already implemented.

Each artwork's placeholder rectangle is fully covered by opaque white, and a square SVG QR is contained inside it with four modules of quiet zone, black modules and medium-or-higher error correction. SVG preserves square modules inside slightly rectangular source areas. **PRESENT MY QR** stops rotation, faces the artwork forward, and also displays an enlarged stationary code for practical phone scanning. All 12 original PNG files are unchanged. Synthetic compositing QA is generated under ignored `.artifacts/`; it is not production artwork.

## Development admission simulation

**Simulate admission** changes only a React state boolean and never calls Supabase, mutates a real ticket, replaces an assignment, changes a credential or stores a fake admission flag. A visible DEV SIMULATION note identifies this state. Reset simulation cannot reset a database-redeemed ticket, because authoritative redeemed state always wins. Review artwork is also temporary and does not change ownership or the persisted assignment. These controls are removed from production bundles.

## Local testing

```sh
npm ci
npm run dev
```

The provided `.env.local` is already configured for the verified project and is ignored by version control. A fresh checkout should copy `.env.example` to `.env.local` and fill in that project's publishable key. Never add service-role or other backend secrets to any `VITE_` variable. Open the Vite URL, claim a ticket, note its display number/artwork, refresh and select **PRESENT MY QR**. Use a separate browser profile/private context to test a second account. Avoid clearing an account you intend to keep.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:live
```

`test:live` is an explicit network integration test restricted to this verified project. It creates two tagged anonymous test accounts, issues test tickets and signs those sessions out. It prints only pass labels and the tagged account IDs for trusted cleanup, never tokens/QR credentials. It does not have an admin key, so it cannot delete its test users. Clean only the exact reported IDs with trusted SQL and the reported `phase2_test_run` metadata predicate. This session's disposable test users and their tickets were removed and absence was verified. Future user runs will need the same narrowly scoped cleanup. Do not run it repeatedly against Auth IP rate limits.

## Dashboard and deployment configuration

- Authentication → Sign In / Providers → Allow anonymous sign-ins: **enabled and verified**.
- Do not expose `private` in Data API schema configuration or grant it to guest roles. Default `public` exposure is sufficient.
- GitHub Actions needs repository variables `VITE_SUPABASE_URL` (API URL above) and `VITE_SUPABASE_PUBLISHABLE_KEY` (this project's public publishable key). These are public build configuration, not backend secrets. The existing Pages workflow runs tests and injects them. The website has not been published by this session.
- No Supabase CLI login is needed to use the deployed function locally. For future redeployment, authenticate the CLI with your own account and use the explicit verified project ref; do not copy a personal access token into chat/source control. Inspect CLI `--help` before deployment or migration commands. Do not reapply the already recorded migration.
- `verify_jwt = false` is intentional because the function performs its own server-side `getUser` verification; this supports current Auth signing-key formats. Missing/forged user JWTs return 401. The publishable key alone cannot issue a ticket. See [Edge auth headers](https://supabase.com/docs/guides/functions/auth-headers).

## Verification limits

Passed: local Postgres migration/constraints/RLS tests; Edge authentication/body-validation tests; browser-client session/duplicate-click unit tests; QR SVG decoding and opaque placeholder compositing for all 12 layouts; hosted two-account issuance, six concurrent requests, session restoration, unique credential format, owner-only reads and unauthorized-write tests; typechecks for frontend, Edge source and tests; lint; production build; original artwork integrity checks.

The composite contact sheet was visually inspected. This is not a live browser test. No browser or native app is connected in this environment, so actual page refresh clicks, mobile drag/rotation/tear smoothness, real-device Safari/Chrome behavior and camera scanning remain manual validation tasks. No admin redemption or Realtime test is applicable in Phase 2.

Official references: [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Edge auth](https://supabase.com/docs/guides/functions/auth), [Postgres pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html).

## File inventory

Created:

- `supabase/migrations/20261027171304_ticket_issuance.sql`, `supabase/config.toml`.
- `supabase/functions/guest-ticket/index.ts`, `guest-ticket/deno.json`, `_shared/guest-handler.ts`.
- `src/lib/supabase.ts`, `src/lib/guestTickets.ts`, `src/hooks/useGuestTicket.ts`, `src/components/TicketQR.tsx`, `src/types/database.ts` (generated from the verified hosted project).
- `tests/database.test.ts`, `tests/edge-handler.test.ts`, `tests/guest-client.test.ts`, `tests/qr-artwork.test.tsx`.
- `scripts/test-live.mjs`, `vitest.config.ts`, `tsconfig.edge.json`, `tsconfig.tests.json`, this guide, and ignored `.env.local`.

Changed:

- `src/App.tsx`, `src/components/Ticket.tsx`, `src/styles.css`, `src/types/ticket.ts`.
- `package.json`, `package-lock.json`, `eslint.config.js`, `.gitignore`, `.env.example`, `.github/workflows/deploy.yml`.
- `README.md`, `public/tickets/README.md`.

Removed: `src/lib/preview.ts`, the old local fake issuance/persistence implementation. None of the 12 artwork PNGs or the rotation hook/ambient gradient component was modified.
