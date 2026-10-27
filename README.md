# Halloween μαζωξη

The existing React/Vite/TypeScript experience, connected to the dedicated Supabase project for real guest ticket issuance and secure admin admission. All 12 original artworks, gradients, rotation, drag, reveal, lower-left hanging tear and ADMITTED treatment are retained. Phase 3 adds permanent admin login, QR scanning, atomic redemption and a restricted dashboard. Phase 4 adds owner-private Realtime admission notifications, authoritative recovery and the live hanging tear. See [Phase 4 verification and two-device testing](docs/phase-4.md).

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:5173/halloween-mazoxi/. This workspace already has an ignored `.env.local` with the verified project's API URL and the supplied publishable key. On a fresh checkout, copy `.env.example` to `.env.local` and supply that public key. Backend secrets never belong in Vite variables.

Select **CLAIM YOUR TICKET**. An anonymous Supabase session is created only when needed; your actual assigned artwork, ticket number and QR restore on reload. **PRESENT MY QR** stops rotation and displays an enlarged stationary code as well as the code on the ticket. Another browser/device or cleared session can create another anonymous account; this is not one-ticket-per-person enforcement.

Admin entry: **http://localhost:5173/halloween-mazoxi/#/admin/login**. Create and authorize your permanent account using [the Phase 3 setup guide](docs/phase-3.md); no password or secret key needs to be sent in chat. Admin/guest sessions use separate storage keys. The guide records hosted admission test results, the retained HM-5/HM-6 test admissions and outstanding physical-camera checks.

## Checks

```sh
npm run artwork:check
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`npm run test:live` separately tests the hosted backend using two tagged disposable anonymous accounts. It prints their IDs for trusted cleanup; see [Phase 2 operations and verification](docs/phase-2.md) before running it. No backend key is needed by that test. Restricted Windows execution environments may require running Vite/native tools in a normal local terminal rather than a process sandbox.

In development, **Review artwork** previews the collection without changing the assignment. **Simulate admission** changes only temporary React state, never the real database ticket. Reset simulation cannot restore a database-redeemed ticket. Development controls are excluded from production.

## Project layout

- `src/config/ticket-collection.json`: verified originals, native dimensions, perforations, lower hinges and QR rectangles.
- `src/components/Ticket.tsx`, `TicketQR.tsx`, `Atmosphere.tsx`: existing collectible experience and real QR rendering.
- `src/hooks/useTicketRotation.ts`: original pointer/rotation physics.
- `src/hooks/useGuestTicket.ts`: loading, recovery, errors and claim state.
- `src/lib/supabase.ts`, `guestTickets.ts`: browser session and Edge Function client.
- `src/admin/`: separate permanent-session client, scanner and dashboard.
- `src/AppRouter.tsx`, `src/routing.ts`, `public/404.html`: GitHub Pages-compatible admin routes.
- `supabase/migrations/`: versioned schema, access policies and atomic issuance RPC.
- `supabase/functions/guest-ticket/`, `_shared/`: authenticated guest lookup/issuance.
- `tests/`: Postgres permissions, function authorization, client concurrency and QR/artwork checks.

The complete filename inventory is in [public/tickets/README.md](public/tickets/README.md). No originals were cropped, resized or replaced. The configured real QR covers each supplied placement reference. QR decoding and compositing pass for all 12 layouts; live mobile/camera alignment remains unverified.

## Supabase and deployment

Project verified: `halloween-mazoxi` / `hefzzwfmpdukwceuwgqr`. Issuance, admin-admission and private-admission-Broadcast migrations are applied; `guest-ticket` and `admin-ticket` Edge Functions remain deployed unchanged for Phase 4. Anonymous Auth is enabled, admin authorization is private/server-controlled, and Realtime public access is disabled. No CLI login or custom signing secret is required to use the deployed system locally. Configure your own permanent admin through the setup guide.

See [Phase 2 documentation](docs/phase-2.md) for tables, policies, credential recovery, expected Advisor notices, hosted test results and manual test limits. See [official Supabase Anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) for the underlying access model.

The GitHub Pages workflow remains manual. Set repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` before publishing. Vite defaults to `/halloween-mazoxi/`, and the workflow uses the repository name. The frontend has not been published by this coding session. Confirm event date/time/location in `src/config/event.ts` before distribution; the printed artwork is preserved.

Phase 5 release preparation, publication status, exact two-phone acceptance steps and safe test-record handling are recorded in [the deployment guide](docs/phase-5.md). Before publishing, run `node scripts/audit-publication.mjs`. After a verified deployment, run `node scripts/check-deployment.mjs <verified-guest-url>` for HTTP and original PNG decoding checks; this does not replace physical browser/camera testing.
