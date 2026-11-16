# Medication stock history (`/piani/[id]/medicinali/[medId]/storico`)

## Overview
Read-only list of stock movements for one medication, with a filter bar and a
stock / coverage summary.

## Interface
- `default StoricoPage({ params, searchParams })` (`page.tsx`) - `metadata.title = "Storico"`.
  Loads `getPlanBundle(id)` and `getStockEvents(med.id)` (`lib/data`).
- `FILTERS` (`tutti`, `arrivi`, `prep`, `conteggi`, `prese`) selected via `?filtro=`.
- `describe(e: StockEventRow)` - maps event `type` (`arrival`, `count`, `prep`, `prep_undo`, `adjust`, `use`) and `meta` to icon, title and note.
- `matches(filter, e)` - filter predicate.

## Invariants
- An unknown `filtro` falls back to `"tutti"`.
- `notFound()` if `medId` is not among the plan's non-archived medications (`b.forecast.items`).
- Author label is "da te" for the current profile, else `da <name>` from `authors`.
- Initial counts (`type === "count"` with `meta.initial`) show the absolute quantity, others a signed delta.

## Side Effects
- Reads `stock_events` (up to 200, newest first, via `getStockEvents`) and plan data; no writes.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
