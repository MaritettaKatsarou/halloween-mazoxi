# Shared ticket reverse and persistent quotes

Local-only frontend copy/typography change, ready for visual review. No deployment, database migration, ticket issuance, admission, QR, artwork or security change was made.

## Behavior

The Mystery Ticket now uses exactly the shared mauve reverse, frame and typography. It keeps the neutral “Η νύχτα / μάς ανήκει.” title and never receives a claimed-ticket quote, even if an ID is inadvertently supplied to its component.

For an owned ticket, App passes the existing persistent ticket UUID into the shared Ticket/Back component. A stable unsigned 32-bit FNV-1a hash selects one of the five exact strings in `src/config/ticketBack.ts`:

- Witch better have my candy
- No tricks, just treats
- 100% that Witch
- Witch please ...
- Mali-BOO Barbie (or a Ken)

There is no `Math.random`, second assignment or storage operation. Existing tickets automatically derive their quote from their existing UUID. Refresh, reopening, edition previews, interactions and admission retain the same selection. Keep the hash algorithm and collection order unchanged; the compatibility test protects a fixed mapping.

All reverse faces use the exact index `HALLOWEEN ΜΑΖΩΞΗ 2026 · PRIVATE INVITATION`. The subsequent mobile refinement makes the footer one line: `COME AS YOU ARE. OR AS SOMEONE ELSE.` (see `mobile-refinement.md`). The existing serif title uses balanced explicit line breaks, italic emphasis on the second line and font sizing relative to the reverse's content width. The longer Mali-BOO text uses a slightly smaller size. No screen-specific offsets or front/QR geometry changes were introduced.

## Verification

- 106 automated tests pass, including exact quote strings, all five reachable selections, repeatable module reload, a fixed hash compatibility vector, the same selection across all 12 editions and issued/redeemed rendering, Mystery neutrality and exact index/footer markup.
- Typecheck, ESLint and production build pass. Both original artwork inventory and byte-identical Mystery asset checks pass.
- Headless Edge checked all five quote variations in each of the 12 edition aspect ratios plus neutral Mystery at 320, 390 and 430px: **183 layouts**, with no clipping or title/index/footer overlap. Exact visible copy was checked in each layout.
- Contact sheets at all three widths were saved locally. The 390px screenshot was visually inspected; all five quote treatments and the shared neutral Mystery reverse are balanced and legible within their existing frame.
- Actual guest-App checks use synthetic Auth/Edge/WebSocket responses to verify ID propagation and quote persistence through interaction, refresh, admission and reopening. No production ticket is issued or redeemed by these tests.
- Physical iOS Safari/Android testing remains unverified. No physical camera test is claimed.

## Review

Run `npm run dev` and open `http://localhost:5173/halloween-mazoxi/`. A fresh guest sees Mystery; an existing claimed session shows its ID-derived quote when the ticket rotates to the back. The application uses the existing real Supabase configuration, so use disposable sessions for manual claims.

Local contact sheets: `.artifacts/ticket-backs-320.png`, `ticket-backs-390.png`, `ticket-backs-430.png`. These are development review artifacts and are not deployed. `.artifacts/back-preview.html` provides the same local-only review grid through Vite.

Changed for this request: `src/App.tsx` (pass the persistent ID), `src/components/Ticket.tsx` (reuse the common reverse), `src/styles.css` (responsive quote type and removal of the Mystery-only reverse override), the existing Mystery test, this guide and the prior refinement notes. Added: `src/components/TicketBack.tsx`, `src/config/ticketBack.ts`, `tests/ticket-back.test.tsx`.
