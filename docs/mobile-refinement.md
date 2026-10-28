# Compact mobile guest experience and magic orb

Publication update: the completed frontend refinements are approved for the existing GitHub Pages site. Follow change ? test ? commit ? push ? deploy ? public verification. Earlier local-review notes below record the original implementation checks. No backend changes are included.

The later CTA refinement replaces the separate orb with a liquid-glass capsule and its label inside. See `liquid-pill-cta.md` for the current CTA and screenshots; the layout/size work recorded below is retained.

Completed locally for visual review. No commit, push, deployment, backend operation, migration or Edge Function change was performed for this refinement. The new reference images were not attached to the request, so the implementation follows its detailed written art direction.

## Visual changes

- Mobile issued/Mystery ticket width changes from 72vw to 86vw: approximately 19.4% larger, retaining the existing 40-degree diagonal pose, native artwork proportions, pointer interaction and 45-second rotation. Desktop remains at its existing 550px maximum (600px on the existing very large desktop breakpoint).
- The subtitle is removed. Header contains only the existing wordmark and A PRIVATE GATHERING. THE INVITATION now has the accessible “Η πρόσκληση +/−” toggle on its right instead of the edition counter.
- Event information expands directly below that row, in normal document flow. All existing information remains available. Keyboard Enter/Space activate its native button; Escape closes it and returns focus. No modal focus trap or bottom-of-page search is required.
- The reverse footer is exactly `COME AS YOU ARE. OR AS SOMEONE ELSE.`, on one responsive, non-wrapping line. The index and UUID-derived quote algorithm/order are unchanged.
- The primary guest action is one native button with a dark violet/plum glass sphere, curved reflections, two slowly drifting liquid layers, a meniscus and subtle caustic/highlight movement. The readable label sits beneath the sphere. Entire orb/label is clickable. Hover, press, keyboard focus, loading and disabled semantics are preserved. Admitted tickets have a quiet static disabled KEEP THE NIGHT treatment. Admin controls are untouched.
- Reduced motion removes liquid movement and transition effects; the glass/liquid artwork remains visible. Animation uses small CSS transform/opacity layers without WebGL, image generation or additional dependencies.

## Layout and overflow

Mobile stage height now follows the maximum initial diagonal canvas footprint plus float allowance, while retaining enough space for the existing hanging geometry. It stays constant through admission. During the existing front-facing settling interval, admitted paper eases to the previous safe 72vw width before the full tear swing, preventing an enlarged stub from moving offscreen. Perforations, hinge coordinates, tear angles/keyframes, artwork and QR rectangles are unchanged.

Short landscape uses a viewport-height-aware ticket width, so the complete object can still be inspected while scrolling. The page has no whole-page overflow suppression. Decorative atmosphere remains fixed in its own clipped background layer; its washes/grain were not merged or used as layout spacers.

The normal browser-persistence guidance remains in the nearby info panel and accessible status text; visible loading/error/development feedback still appears when relevant. Tightened hero/footer spacing removes normal mobile scrolling at the two primary review sizes while allowing genuine scrolling for short screens, expanded info, enlarged QR, accessibility text and redeemed souvenirs.

Measured clean production previews, same synthetic ticket and frozen initial pose:

| Viewport | Ticket canvas width before → after | Page height before → after | New full CTA bottom |
| --- | --- | --- | --- |
| 390×844 | 281.0 → 335.8px | 916 → 844px | 783.8px |
| 430×932 | 309.9 → 370.4px | 945 → 932px | 829.0px |

The complete header/title/label/enlarged ticket/orb composition fits these first screens. A 320×568 screen and landscape naturally scroll; content is not cropped to force a first-screen fit.

## Verification

- 108 automated tests in 17 files pass. Typechecks, ESLint and production build pass, including all 12 original artwork checks and the byte-identical transparent Mystery asset gate.
- 50 headless Edge interaction/layout checks pass at 320×568, 375×812, 390×844, 430×932, 667×375, 844×390 and 1280×900. They cover the relocated info toggle, subtitle/counter removal, single-line footer, first-screen fit, unchanged desktop size, no horizontal overflow, keyboard info/CTA handling, scannable QR and back-to-floating behavior, synthetic live admission, disabled souvenir orb, unchanged quote, preserved Mystery claim behavior, exactly one claim action and reduced motion.
- All 12 actual Ticket components were checked through 36 sampled X/Y poses in each of six mobile/landscape sizes: 2,592 horizontal-bound checks. Full admission swing frames were sampled at each size. No horizontal clipping was found.
- All five quote variants across all 12 aspect ratios plus neutral Mystery pass single-line footer/layout checks at 320, 390 and 430px: 183 reverse layouts.
- Browser tests use intercepted synthetic Auth/Edge/WebSocket responses. No real anonymous account or production ticket was created, admitted or modified.
- Original PNGs, Mystery bytes, auth/restoration/controller logic, Ticket animation component, edition metadata, quote hash/order, admin source, Supabase code/configuration and image URL handling were preserved. Changes already pending from earlier refinements remain separate; this task did not alter those protected modules.

## Review artifacts

Run `npm run dev` and open `http://localhost:5173/halloween-mazoxi/`. A fresh profile shows Mystery; an owned session shows its original ticket. The normal app still connects to the configured Supabase backend, so use a disposable session for any manual claim/admission test.

Clean production-preview screenshots (no development controls):

- `.artifacts/mobile-clean-comparison-390.png`
- `.artifacts/mobile-clean-comparison-430.png`
- `.artifacts/mobile-clean-after-390.png` and `mobile-clean-after-430.png`
- `.artifacts/mobile-clean-info-open.png`
- `.artifacts/mobile-orb-detail.png`

Additional test captures include `.artifacts/mobile-mystery-orb-390.png` and `.artifacts/mobile-admitted-390.png`. JSON metrics/test evidence remain ignored in `.artifacts/`.

## Files changed for this request

`src/App.tsx`, `src/styles.css`, `src/components/TicketBack.tsx`, `src/config/ticketStage.ts`, `tests/ticket-back.test.tsx`; added `src/components/MagicOrbButton.tsx`, `src/components/InvitationInfo.tsx`, `tests/magic-orb.test.tsx` and this guide. No dependency change was needed.

## Still manual

Physical iOS Safari/Android testing is not claimed. Check dynamic browser bars and safe areas, larger accessibility text, touch drag versus page scroll, liquid animation smoothness/battery use, focus/press behavior, real camera QR scanning, background/reconnection and the full hanging tear on physical phones. The attached reference images can be used for a further visual comparison if supplied. Public deployment is now explicitly approved after checks pass.
