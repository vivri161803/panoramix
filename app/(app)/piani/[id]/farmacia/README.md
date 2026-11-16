# Pharmacy list (`/piani/[id]/farmacia`)

## Overview
Proposed order list for the pharmacy, with pack quantities covering roughly
`ORDER_TARGET_DAYS` days beyond stock at home. The user copies or shares the
text; the app does not send it.

## Interface
- `default FarmaciaPage({ params })` (`page.tsx`) - `metadata.title = "Lista per la farmacia"`.
  Builds items with `buildPharmacyItems(b.forecast.items, b.today, b.forecast.nextPrep)` (`lib/pharmacy`)
  and renders `PharmacyList` (`components/PharmacyList`) with `editable = canEdit(b.role)`.

## Invariants
- With no items, shows "Nel piano non ci sono medicine in corso." instead of the list.

## Side Effects
- Page reads only; actions live in `PharmacyList`.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
