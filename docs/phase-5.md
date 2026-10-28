# Phase 5 — test deployment and physical acceptance

Status: publicly deployed and HTTP/browser smoke checks passed on 28 October 2026 (Europe/Athens). Physical two-phone acceptance remains required.

- Repository: https://github.com/MaritettaKatsarou/halloween-mazoxi
- GUEST_URL: https://maritettakatsarou.github.io/halloween-mazoxi/
- ADMIN_URL: https://maritettakatsarou.github.io/halloween-mazoxi/#/admin/login
- First successful deployment: [Actions run 40619468839](https://github.com/MaritettaKatsarou/halloween-mazoxi/actions/runs/40619468839), source commit `6b066369168b681448c7ce0f454b48f1e00e01a5`.

## Publication boundary

The user explicitly approved public source/artwork publication. The empty repository was created under the verified `MaritettaKatsarou` account, `origin` configured, remote refs checked, and the original `main` history pushed without force. Source history and all 12 original artworks are publicly downloadable.

This is a **limited public test**, not the final invitation launch. The Pages guest link is public and anonymous visitors can issue tickets. Another browser/device/cleared session can obtain another ticket. Repository privacy and obscurity of the URL do not restrict guest issuance. Do not distribute the link as the final invitation until physical acceptance is complete.

## Release preparation

The existing `main` history is preserved. Phases 3–4 are committed together with release preparation, without changing original artwork or guest/admin behavior. The credential audit scans non-ignored working files and every reachable historical Git blob for sensitive paths, backend keys, GitHub tokens, private keys, database passwords and real opaque QR credentials. `.env.local` and `.artifacts/` are ignored. Audit output reports paths/check names only, not matched values. The audit is a targeted check, not a guarantee against every possible secret format.

The single existing `.github/workflows/deploy.yml` remains manually dispatched for this limited test. It installs using `npm ci`, runs typecheck, ESLint, all tests, verifies the dedicated project/public-key configuration, builds with the repository base path, configures Pages, uploads `dist` and deploys with official GitHub actions. Build has contents-read permission; only deployment has pages-write and id-token-write.

Configured repository **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL`: `https://hefzzwfmpdukwceuwgqr.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the existing project's `sb_publishable_…` value, copied locally; this is public frontend configuration.

**Settings → Pages → Build and deployment → Source** is configured to **GitHub Actions** and HTTPS is enforced. Both build/deploy jobs and every check in the first deployment passed. For subsequent releases use **Actions → Deploy Halloween μαζωξη → Run workflow → main**, then verify its success. The actual returned Pages URL was checked over HTTPS before recording the links above. Both public build variables are configured; no private backend credential was added.

Never configure a service-role key, Supabase secret key, database password or admin password as a Vite value. Development simulation/review controls are removed by the production build. Keep Realtime public access disabled in the dedicated project.

## Supabase production origin

Anonymous sign-in and permanent admin email/password login return sessions directly; they do not use redirect-based Auth flows, so publishing this implementation does not require changing the Auth redirect allowlist. Guest localStorage and admin sessionStorage remain separate, keyed independently. A localhost guest session is not automatically shared with the different Pages origin: use a new disposable production guest.

If configuring email confirmations/password recovery later, set **Authentication → URL Configuration → Site URL** to the verified `GUEST_URL` and add only actual implemented redirect callback URLs. Do not add a broad wildcard or change other project settings for the current login flow. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Both existing Edge Functions answer OPTIONS with POST and `authorization, apikey, content-type, x-client-info` allowed. Wildcard CORS does not authorize a caller: each request still requires the existing server-side Auth/ownership/admin checks. `node scripts/check-deployment.mjs GUEST_URL` verifies the real production HTTP assets, original bytes/native PNG decoding, hash-route document access, 404 recovery and Pages-origin CORS preflights. It is not a browser test.

## Two physical phones — exact acceptance procedure

Record date, browser/OS versions, GUEST_URL, deployed commit, display number and expected edition for each test. Never record passwords, session tokens or QR credentials in this repository, screenshots shared publicly, or chat.

1. Verify the deployment is green. PHONE A (guest): in a fresh private browser session open the verified HTTPS `GUEST_URL`, claim exactly one new **disposable test ticket**, and record its display number/edition in your private acceptance notes. Keep that private browsing session open throughout testing. Refresh once before admission: the same number, edition and QR must return. Select PRESENT MY QR and save the original QR privately for the repeat-rejection check.
2. PHONE B (admin): open the verified HTTPS `ADMIN_URL`. Sign in with your authorized permanent account using your own password; setup is in `phase-3.md`. Open the scanner, allow camera access and prefer the rear camera. Deny permission once to check the explanation/retry flow, then grant permission through browser settings. Test torch only if supported.
3. Scan PHONE A. Scanning must pause after detection. Verify the actual supplied artwork, correct edition and number, and VALID state. No redemption should happen until you deliberately tap ADMIT.
4. Tap ADMIT once. PHONE B must show success and SCAN NEXT. PHONE A, still open, must receive the update automatically: rotation settles front-facing, the configured tear progresses, the stub stays physically connected at the bottom-left hinge, swings below without clipping/disappearing, and the integrated ADMITTED mark appears. Check no horizontal scrolling, no major layout jump and readable original artwork.
5. Refresh PHONE A: its final hanging souvenir must appear immediately, without replay or spinning. On PHONE B tap SCAN NEXT and scan the privately saved original QR: ALREADY USED with the original admission timestamp; no second ADMIT option. Do not use an unrelated guest ticket for this test. Check dashboard admitted/remaining counts changed once, not twice.
6. Repeat with a second new disposable guest ticket. Put PHONE A offline before PHONE B admits. While offline it must not pretend to have confirmed admission. Restore connectivity and foreground the guest page: it must recover redeemed status, hide the active QR, and retain the hanging state after refresh. If the page was closed during admission, reopen in the same guest session: final state should load directly.
7. Test a third disposable ticket with reduced motion enabled at OS level: admission should use the final hanging state without the full swing. Repeat visual inspection on iOS Safari and Android Chrome. Review all 12 editions for QR alignment/hinge placement; automated geometry/PNG checks do not replace physical visual checks.
8. Test the admin losing network during ADMIT. Reconnect and validate the same QR again before admitting anyone: the server may already have committed redemption even if the first response was lost. ALREADY USED means it succeeded; never assume a network error means an unused ticket.

Production simulation is unavailable by design. Never reset admission state through browser tools. Physical camera permission/torch/scanning, iOS/Android motion quality, the live tear on a physical phone and physical viewport acceptance remain **unverified**. Headless Edge checks below verify actual browser rendering and QR decoding, but do not replace those tests.

## Test record ledger and cleanup

One new disposable guest was created by the production browser test and tagged privately with `phase5_test_run`. Exact ticket/owner UUIDs and the run identifier remain in the ignored local `.artifacts/phase5-browser-report.json` ledger; they are omitted from the public report.

| Disposable ticket | Edition | Final status |
| --- | --- | --- |
| HM-13 | cat-pumpkin-stack | issued; not redeemed |

The before/after fingerprint of the 10 pre-existing ticket rows is identical. No existing ticket was overwritten, redeemed or deleted. Prior disposable records remain documented in `phase-3.md` (HM-5/6) and `phase-4.md` (HM-7–12). Test records affect dashboard counts.

Creating a new disposable permanent admin/allowlist entry was rejected by automatic approval review because this exact privileged change requires explicit approval. No such admin account was created and the unused ignored login fixture was deleted. The user can perform authenticated production acceptance with their own authorized account, or explicitly authorize a disposable test admin. Browser password login, authenticated dashboard/scanner and production admission remain unverified until then; earlier Phase 3/4 hosted checks are still recorded separately.

For each manual production test append the exact ticket UUID/display number, anonymous owner UUID if available through trusted admin tools, test purpose, edition, time and final status to private acceptance notes. Stop if the ticket cannot be positively identified as disposable. Do not label a real invitation as a test merely because it was created recently.

No destructive cleanup is performed automatically. Prefer retaining the audit trail. If cleanup is later needed, obtain separate approval for an exact allowlist of disposable ticket/owner UUIDs, verify it in a read-only query, revoke those sessions, and review foreign-key effects before a transaction. Never truncate tables, delete by date range, bulk-delete anonymous users or reset ticket sequences. Backend ticket deletion and frontend session invalidation are different operations; old JWTs may remain valid until expiry.

## Verification ledger

- Automated tests: 91 pass across 13 files, including guest issuance/RLS, admin authorization/atomic admission, Realtime policies/state recovery and all 12 hinge geometries.
- Typechecks and production build pass; all 12 original artwork hashes/dimensions verified. No original PNG modifications.
- Credential/history audit passes; only `.env.example` is tracked among environment files.
- Hosted baseline: 10 existing tickets, 5 issued/5 redeemed, unique owners and consistent redemption timestamps/actors. After the one new issued fixture, the original 10 rows retain their exact baseline fingerprint.
- ESLint passes. GitHub Actions build/deploy succeeded, including clean Linux dependency installation, all 91 tests, typechecks, lint and production build.
- Production HTTP checks pass: HTTPS HTML and JS/CSS under the correct base, all 12 byte-identical original PNGs with actual decoding at native dimensions, hash-route document access, direct-path recovery document and both Edge Function CORS preflights.
- 21 actual headless Microsoft Edge checks pass, with zero uncaught page errors: landing/layers, original artwork decoding, advancing rotation, real claim, correct assigned artwork fragments, nested QR overlay, decoding the rendered QR to the actual credential, refresh persistence, successful private Realtime join, no document overflow at 320/390/430px, protected dashboard/login routing, direct-path recovery, guest/admin session isolation and absence of development admission controls. Sanitized evidence is in `phase-5-browser-checks.json`. This is an isolated browser context, not a physical mobile device.
- Authenticated production admin interaction, camera permissions, live production redemption/tear and physical two-phone acceptance remain pending. No physical camera, torch or iOS/Android result is claimed.

Deployment approach follows [official GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The full Phase 4 hosted security evidence remains in `phase-4.md`; it is not presented as new production-browser testing.
