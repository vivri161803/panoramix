# Plan settings (`/piani/[id]/modifica`)

## Overview
Owner-only settings page for a plan: patient name, notes, stock mode, prep
weekday, alert toggles, recipients, members / invites and a test email.

## Interface
- `default ModificaPianoPage({ params })` (`page.tsx`) - `metadata.title = "Impostazioni del piano"`.
  Renders `PlanForm` (`components/PlanForm`) with `planId`, current meds and settings, and `extra` =
  `MembersPanel` (`components/MembersPanel`) + `TestEmailButton` (`components/TestEmailButton`).

## Invariants
- Non-owners (`!isOwner(b.role)`) are redirected to `/piani/[id]`.
- `recipients` come from `b.recipients` (only loaded for owners in `getPlanBundle`).

## Side Effects
- Page reads only; saves, invites and test emails are server actions in the child components.

## Verification
- Run: `npm test`
- Run: `npm run typecheck`
