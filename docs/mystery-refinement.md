# Mystery Ticket and restoration refinement

Publication update: the completed frontend refinements are approved for the existing GitHub Pages site. Follow change ? test ? commit ? push ? deploy ? public verification. Earlier local-review notes below record the original implementation checks. No backend changes are included.

Completed locally for review. No deployment or backend/database changes were made. The user placed the supplied original in `public/tickets/` with a doubled `.png` extension; this was corrected to `mystery-source.png`. The dedicated `mystery-ticket.png` was then prepared and verified byte-for-byte against that source.

## Artwork and local review

The verified source and prepared asset are present. To re-verify and review:

```sh
npm run mystery:prepare
npm run mystery:check
npm run dev
```

Open `http://localhost:5173/halloween-mazoxi/` in a fresh browser profile to see Mystery. Before claiming, no anonymous account or QR is created. The normal development app uses the configured real Supabase backend, so use a disposable browser session if manually claiming. Use an existing owned session to review refresh recovery. Automated browser checks described below used synthetic responses instead of real issuance.

The actual supplied file is 1942×809 and already has a transparent exterior and transparent corners. Its outer canvas border has alpha zero except 14 black pixels at alpha 1/255; that nearly invisible source detail is retained. No white-pixel thresholding was needed. The preparation script validated that exterior and copied the source byte-for-byte to `public/tickets/mystery-ticket.png`, preserving every texture, notch, ornament and internal white detail. Both files have SHA-256 `3204d023084fca336b77f2ac645bdce67f42a226828693de96198bdaecec85f7`.

Mystery is a separate presentation configuration, never part of the 12 assignable editions. The artwork inventory allows only the two explicitly named presentation assets in addition to the original 12 PNGs. The build now requires the Mystery asset check before bundling, preventing publication without the verified source.

## Cause and fix

Previously App selected `editions[0]` when `ticket` was null, including the asynchronous restoration interval. The controller now explicitly distinguishes restoring, confirmed unclaimed, owned and recovery-error states. It never exposes the assigned ticket to React until its exact image URL has loaded and decoded successfully. Initial errors stay errors and cannot enable another claim.

Before ownership is resolved, the ticket area is neutral and CLAIM is disabled. The Mystery image loads only for confirmed-unclaimed guests. During a claim, that confirmed presentation remains until issuance and assigned-image decoding finish. A keyed, reduced-motion-aware opacity/scale transition reveals the actual ticket. All phases reserve the same stage space.

Existing issued/redeemed state, credentials, owner validation, realtime refetch/recovery and hanging-tear mechanics are retained. The Mystery front uses the full original image without cropping, splitting or QR overlays. At the user's subsequent request, its reverse now shares the same mauve background, frame, index/footer styling and neutral Greek title as the other tickets. Claimed-ticket quotes are documented in `ticket-back.md`. Existing rotation and drag logic are reused. A known owned ticket stays visible during later connection failures. A failed initial restore or image decode presents recovery and retries lookup, never issuance.

## Verification

- Typechecks and ESLint pass.
- 101 tests in 15 files pass, including the existing guest/admin/database/realtime tests and new restoration, decode, retry, account-switch and Mystery-exclusion tests.
- All 12 original PNG inventory/dimension/hash checks pass; no original file or edition geometry was changed.
- 14 isolated headless Edge checks pass with synthetic Auth/Edge/WebSocket responses: delayed restoration, no wrong/Mystery image in recorded restoration frames, refresh, network/image errors, recovery without claim, nested QR, original hanging-tear completion, final redeemed restore, no horizontal overflow at 320/390/430px and no uncaught browser errors. No real ticket was created or redeemed by these checks.
- `npm run build` now passes, including all original artwork checks, the Mystery source/transparent-asset gate, all TypeScript targets and the production Vite bundle.
- The initial Mystery/claim implementation passed 37 further headless Edge checks across actual Vite development and production-preview servers: fresh Mystery rendering/transparent corners/native dimensions, no pre-claim QR or account, diagonal orientation/rotation/drag, reduced motion, mobile widths, Mystery retention during delayed issuance and image decoding, authoritative assigned artwork, stable stage height, exactly one sign-in/claim, QR decoding and stub nesting, refresh without a Mystery/wrong-edition frame, reopening a tab without another claim and zero uncaught page errors. The later shared reverse/quote changes have their own verification in `ticket-back.md`.
- Reviewed the original PNG and a 390px production-preview screenshot. The complete original silhouette and internal white details remain intact. Local screenshots and browser reports are in ignored `.artifacts/` files.
- No Safari/iOS reopen, physical camera or physical-device result is claimed. Reopening was tested in isolated headless Edge contexts with synthetic responses, not a physical Safari browser.

In development, use the existing edition selector for all 12 layouts and the simulation only on actual edition previews. Mystery is not redeemable and its simulation button is disabled. These focused refinements are ready for local visual review and remain undeployed.

## Files

Changed: `src/App.tsx`, `src/components/Ticket.tsx`, `src/hooks/useGuestTicket.ts`, `src/lib/guestTicketController.ts`, `src/styles.css`, `scripts/check-artwork.mjs`, `package.json`, `tests/guest-controller.test.ts`.

Added: `public/tickets/mystery-source.png`, `public/tickets/mystery-ticket.png`, `src/config/mystery.ts`, `src/config/ticketStage.ts`, `src/hooks/useArtwork.ts`, `src/lib/preloadArtwork.ts`, `scripts/prepare-mystery.mjs`, `scripts/check-mystery.mjs`, `tests/mystery-ticket.test.tsx`, `tests/preload-artwork.test.ts`, this guide.

The backend, Supabase configuration, migrations, security policies and all original artworks remain unchanged. No Git commit, push or deployment was performed for this refinement.
