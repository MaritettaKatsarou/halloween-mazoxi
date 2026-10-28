# Persistent Halloween quotes — focused release

This release changes only the shared ticket reverse, its copy/typography, deterministic quote selection, ID prop wiring and tests. The separate local Mystery artwork/restoration work is excluded from this deployment.

`src/config/ticketBack.ts` maps the existing persistent ticket UUID to one of the five requested quotes using unsigned FNV-1a. There is no random value on render, second assignment, database write or migration. Keep the hash algorithm and quote order unchanged to preserve assignments. A fixed compatibility vector is tested.

`src/components/TicketBack.tsx` renders the exact `HALLOWEEN ΜΑΖΩΞΗ 2026 · PRIVATE INVITATION` index, balanced serif/italic quote lines and the two-line `COME AS YOU ARE.` / `OR AS SOMEONE ELSE.` footer. Unclaimed previews without an existing ticket UUID keep their neutral Greek title. `Ticket.tsx` receives the existing ID through App; all front artwork, QR content/geometry and admission motion remain unchanged.

All five quote layouts were visually inspected and measured across the 12 edition aspect ratios at 320, 390 and 430px, including the separate local neutral-Mystery preview: 183 layouts with no clipping or overlap. The exact focused release checkout passes 96 tests in 14 files, lint, all typecheck targets, the production build and the source/history credential audit. Tests cover exact strings, stable module reload, all quote choices, all 12 editions before/after admission and exact index/footer text. Local-only Mystery tests are not part of this release.

Deployment uses the existing manual GitHub Pages Actions workflow and public build variables. No environment files, test fixtures, screenshot artifacts, credentials or real QR tokens are included. Backend/Edge Functions/migrations and database records are not changed. Live acceptance uses read-only HTTP checks and isolated synthetic browser responses; it does not claim physical Safari or camera testing.

Files: `src/App.tsx`, `src/components/Ticket.tsx`, `src/components/TicketBack.tsx`, `src/config/ticketBack.ts`, `src/styles.css`, `tests/ticket-back.test.tsx`, this guide.
