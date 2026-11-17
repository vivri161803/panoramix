# Weekly print sheet (`/piani/[id]/stampa`)

## Overview
A4 printable weekly dose sheet with check boxes, plus the shared print button
and print stylesheet reused by the therapy sheet.

## Interface
- `default StampaPage({ params, searchParams })` (`page.tsx`) - `metadata.title = "Stampa"`.
  Loads `getPlanBundle(id)`, resolves the week from `searchParams.settimana` via
  `resolveWeek`, builds the grid with `weekGrid` (`lib/week`). Back link to
  `/piani/[id]/calendario?settimana=<week.start>`.
- `PrintButton({ fileName })` (`PrintButton.tsx`, client) - exported; also used by `../terapia/page.tsx`.
  - On mount: waits for `document.fonts.ready`, runs `fitSheet` on `#px-sheet`.
  - In an iOS home-screen app (`isIosHomeScreenApp`), pre-renders a PDF (`sheetToPdf`,
    via `modern-screenshot` `domToCanvas` and `jpegToA4Pdf` from `lib/pdf`) and on click
    shares it with `navigator.share` or downloads it; elsewhere calls `window.print()`.
- `print.css` - `@page A4 portrait`, `.px-sheet` (210mm x 297mm), `.px-no-print`, `.px-sheet-wrap` zoom under 840px.

## Invariants
- The sheet element must have `id="px-sheet"` (`SHEET_ID`) and the shrinkable area must carry `data-fit`.
- `fitSheet` reduces CSS `zoom` in 0.02 steps until no overflow, never below 0.5.
- Legend and cells show the `Presidio` icon of each category; the legend adds the category name (`categoryLabel`), cells the dose with its word (`doseWord`, «5 ml», «1 goccia»).
- Font scale per cell follows `maxPerCell`: 1 for up to 2 doses, 0.86 for 3, 0.74 for 4, 0.64 above; legend scales to 0.8 above 8 entries.
- Rendered PDF is A4 at 794x1123 CSS px, scale 2, JPEG quality 0.92.

## Side Effects
- Browser only: print dialog, Web Share, temporary off-screen DOM clone, object URL download (revoked after 60 s).
- Server: reads plan data through `getPlanBundle` (Supabase, RLS-scoped).

## Verification
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
