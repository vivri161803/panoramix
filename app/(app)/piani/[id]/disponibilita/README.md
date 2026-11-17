# Availability (`/piani/[id]/disponibilita`)

## Overview
For each medication in the plan, shows whether it is on the AIFA shortage list
and which equivalent packs exist (AIFA transparency list) with prices.

## Interface
- `default DisponibilitaPage({ params })` (`page.tsx`) - `metadata.title = "Disponibilità"`.
  Calls `loadAvailability(supabase, b.medications)` (`lib/availability`), which returns `{ items, status, error }`.
- Local components: `Shortages({ a: MedAvailability })`, `Equivalents({ a: MedAvailability })`, helpers `chip`, `price` (EUR, `it-IT`), `day`, `dataDate(status: AifaStatusRow[])`.

## Invariants
- Medications without an AIC (`a.noAic`) show a prompt instead; the "Aggiungi il codice" link to `/piani/[id]/medicinali/[medId]` appears only when `canEdit(b.role)`.
- `dataDate` reports the `source_date` of the `carenze` and `trasparenza` sources, or "Dati AIFA non ancora importati.".
- An `error` from `loadAvailability` is shown with `role="alert"` and does not abort the page.

## Side Effects
- Reads AIFA tables and plan data through the server Supabase client; no writes.

## Verification
- Run: `npm test` (see `tests/availability.test.ts`)
- Run: `npm run typecheck`
