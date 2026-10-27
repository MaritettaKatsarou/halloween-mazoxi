# Claimed artwork loading fix

## Confirmed cause

`Ticket.tsx` encoded each filename segment with `encodeURIComponent`, turning commas into `%2C`. Vite's static/public asset routing does not resolve these percent-encoded reserved commas to the literal commas in the on-disk filenames. The image request falls through to the SPA HTML page, which returns **200 text/html**, not PNG data. The browser cannot decode that response as an image. The QR continues rendering in its existing stub, giving the appearance that it floats without its artwork.

The affected edition IDs are `seated-cat`, `moon-castle` and `cat-eyes`, corresponding to these original files:

- `Εικόνα ChatGPT 27 Οκτ 2026, 08_01_00 π.μ-1.png`
- `Εικόνα ChatGPT 27 Οκτ 2026, 08_01_01 π.μ-2.png`
- `Εικόνα ChatGPT 27 Οκτ 2026, 08_18_05 π.μ.png`

Exact failing request for `seated-cat`:

```text
/halloween-mazoxi/tickets/%CE%95%CE%B9%CE%BA%CF%8C%CE%BD%CE%B1%20ChatGPT%2027%20%CE%9F%CE%BA%CF%84%202026%2C%2008_01_00%20%CF%80.%CE%BC-1.png
```

Corrected request:

```text
/halloween-mazoxi/tickets/%CE%95%CE%B9%CE%BA%CF%8C%CE%BD%CE%B1%20ChatGPT%2027%20%CE%9F%CE%BA%CF%84%202026,%2008_01_00%20%CF%80.%CE%BC-1.png
```

Both behaviors were reproduced over HTTP in real Vite development and production-preview servers. The filenames and edition mapping were correct on disk; the bug was URL encoding. `reference.png` did not contain a comma, so the initial preview hid the issue until one of the affected editions was assigned.

## Minimal change

The image source now uses `import.meta.env.BASE_URL + encodeURI(edition.file)`. The configured file is a path, not an individual URL parameter. This retains literal commas and encodes spaces/Unicode once. Both main artwork and stub images use that same source. Original filenames, PNG bytes, QR rectangles, aspect ratios, perforations, motion and hinge treatment are unchanged. No Supabase/Auth/database/credential code changed.

Files changed: `src/components/Ticket.tsx`, `tests/artwork-urls.test.tsx`, and this report. Temporary test builds live under the already ignored `node_modules/.cache/` directory.

## Automated verification

The regression test builds the real frontend into an isolated ignored directory, starts actual Vite development and production-preview servers, and checks all 12 editions. It renders the actual `Ticket` component for preview, issued, JSON-restored and admitted states using synthetic ticket records/QR credentials. Every source must resolve under `/halloween-mazoxi/`, both ticket fragments must use the same URL, and the QR must remain nested in the animated stub. Every HTTP response must have status 200, `image/png` content type, bytes identical to the original, and a successful full PNG decode at its original nonzero dimensions.

These are server-rendering and HTTP/image-decoding tests, not live browser tests or new real Supabase claims. The existing client, database, QR decoding/compositing and Edge tests also run as part of `npm test`.

## Manual browser verification still required

No browser/native app is connected to this environment. Do not interpret automated PNG decoding as browser `naturalWidth` verification or an animation test.

1. Run `npm run dev` and open the Vite URL under `/halloween-mazoxi/`. Hard-refresh once to load the fixed component. Keep an existing guest session intact; no ticket reset is needed.
2. Open DevTools → Network and filter `png`. Confirm the claimed artwork request returns `image/png`, rather than trusting status 200 alone. Comma-bearing paths must contain a literal comma, not `%2C`.
3. In development, use **Review artwork** to inspect all 12 designs, especially the seated cat, castle and cat eyes. This must not change the real saved assignment. Use **Return to assigned artwork** afterward.
4. Use a fresh browser profile/private window to make a real **CLAIM YOUR TICKET** request. Confirm artwork and its QR appear together; note the display number and artwork, refresh and confirm both remain unchanged. Reopen the original existing-session window and confirm its ticket still loads.
5. In the browser console, inspect only image state (no QR/auth credentials):

   ```js
   [...document.querySelectorAll('.ticket-front img')].map(image => ({
     src: image.currentSrc,
     complete: image.complete,
     width: image.naturalWidth,
     height: image.naturalHeight,
   }))
   ```

   Both entries must be complete with matching, nonzero native dimensions.
6. Drag and let the ticket rotate. Select **PRESENT MY QR** and confirm the in-ticket code stays on the artwork and the intentionally enlarged scanning code appears below it. Run **Simulate admission** and confirm the QR stub still hangs from the lower-left hinge. Reset simulation afterward; it must not change the real ticket.
7. Run `npm run build`, then `npm run preview`. Repeat claimed-ticket image/refresh/rotation checks under the production-preview URL. Development review/simulation controls must be absent there.

Phase 3 is not started.
