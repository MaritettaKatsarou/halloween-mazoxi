# Guest liquid-glass capsule CTA

Publication update: the completed frontend refinements are approved for the existing GitHub Pages site. Follow change ? test ? commit ? push ? deploy ? public verification. Earlier local-review notes below record the original implementation checks. No backend changes are included.

Completed locally for visual review. Replaces the separate orb/label layout with one horizontal capsule and a centered internal label. No commit, push or deployment was performed.

## Material and interaction

The dark plum/midnight glossy shell retains the earlier material palette. Decorative layers fill the button's own bounds, rather than a separate sphere above it. The lower portion contains nonuniform violet liquid; the upper chamber remains visibly dark. An asymmetric cubic SVG contour defines a slightly uneven horizon, with two independently drifting liquid layers, a low-opacity slow shimmer, caustic glow, a curved reflection and a restrained outer halo.

A separate settling wrapper responds to a press with a 2px downward movement, 0.7-degree tilt and small vertical compression. On release it eases back over 0.65 seconds without resetting the continuous liquid animations. The button itself has a slight tactile press response. All liquid/shimmer/settling and hover/press transforms stop under reduced motion, retaining the static material appearance.

The existing `MagicOrbButton` component name and props are retained to avoid changing App handlers or guest state logic. It remains one native button; all visual layers are aria-hidden and ignore pointer input. CLAIM YOUR TICKET, PRESENT MY QR and BACK TO FLOATING use the same handlers, loading/disabled conditions and native keyboard activation. Admitted tickets retain the disabled, quiet KEEP THE NIGHT state. Admin controls are untouched.

## Verification

- 108 automated tests pass. Typecheck, ESLint and production build pass. All 12 original artwork checks and the byte-identical Mystery asset check pass.
- 62 headless Edge layout/interaction checks pass across 320, 375, 390 and 430px portrait widths, 667×375 and 844×390 landscape, plus desktop. They verify the horizontal capsule, a minimum 44px touch target, internal centered readable label, no overflow, hover, nonuniform horizon, shimmer, press displacement/release settling, reduced motion and preserved guest actions.
- Synthetic guest-flow tests verify exactly one claim, QR decoding, return to floating, original hanging admission, unchanged quote and disabled admitted state. No production data or real tickets were created/modified.
- Clean production-preview captures cover all six visual states at 390px: claim, loading, present, pressed detail, back-to-floating/QR and admitted. The main 390px page and detail screenshot were visually inspected. The mobile capsule is 60px tall, saving roughly 48px versus the prior orb-with-label block.
- Physical Safari/iOS/Android touch behavior, animation smoothness and real camera scanning remain manual; no physical-device test is claimed.

## Review

Run `npm run dev` and open `http://localhost:5173/halloween-mazoxi/`. The normal local app still uses the existing real Supabase configuration; use a disposable session if manually claiming. The automated checks use synthetic responses instead.

Local screenshots:

- `.artifacts/pill-present-390.png` — clean full homepage with internal-label capsule
- `.artifacts/pill-detail.png` — material/horizon detail
- `.artifacts/pill-pressed-detail.png` — subtle liquid press response
- `.artifacts/pill-claim-390.png`
- `.artifacts/pill-loading-390.png`
- `.artifacts/pill-qr-390.png`
- `.artifacts/pill-keepsake-390.png`

Changes for this request: `src/components/MagicOrbButton.tsx`, its scoped CSS in `src/styles.css`, the existing `tests/magic-orb.test.tsx`, this guide and a superseding note in the prior mobile guide. No dependencies, App action handlers, ticket art, geometry, auth, QR credentials, admin, Realtime, database migrations or Edge Functions changed.
