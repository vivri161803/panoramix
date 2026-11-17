# Weekly calendar (`/piani/[id]/calendario`)

## Overview
Seven-day grid of doses per slot (morning / noon / evening) for a plan, with
week navigation and a link to the printable sheet.

## Interface
- `default CalendarioPage({ params, searchParams })` (`page.tsx`) - `metadata.title = "Calendario"`.
  Uses `resolveWeek(searchParams.settimana, b.settings, b.today)` and `weekGrid(b.medications, week.start)` (`lib/week`),
  `SLOTS` / `SLOT_LABEL` / `formatQty` (`lib/forecast`), `PlanHeader` with `tab="calendario"`.
- Links: `?settimana=<week.prev|week.next>`, "Questa settimana" (when `!week.isCurrent`), and `/piani/[id]/stampa?settimana=<week.start>`.

## Invariants
- The week starts on the plan's `prep_weekday` when `prep_reminder` is on, otherwise on Monday (`calendarWeekStart`); the A4 sheet uses the same start.
- `as_needed` medications are not in the grid; they are listed below it.
- Today's column is highlighted when `d.date === b.today`.

## Side Effects
- Reads plan data via `getPlanBundle`; no writes.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
