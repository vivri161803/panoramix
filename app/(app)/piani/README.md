# Plans list (`/piani`)

## Overview
Home of the signed-in app: pending invites and one card per plan (own or
shared) with status, minimum coverage and stock summary.

## Interface
- `default PianiPage()` (`page.tsx`) - `metadata.title = "I miei piani"`.
  Loads `listPlans()` and `listMyInvites()` (`lib/data`), renders `InvitesList`, `Pill`, `StatusChip`.
- `summary(entry)` (`page.tsx`, local) - counts items by forecast status `out` / `order` / `ordered`.
- `default Loading()` (`loading.tsx`) - skeleton cards with `role="status"`.
- Subdirectories:
  - [nuovo](./nuovo/README.md) - create a plan.
  - [[id]](./[id]/README.md) - plan dashboard and per-plan pages.

## Invariants
- Every plan shows the minimum coverage over active, non-as-needed items.
- Shared plans (`role !== "owner"`) show "Condiviso" with `ROLE_LABEL[role]` and the owner name.
- The "Nuovo piano" button appears only when there is at least one plan; otherwise an empty state links to `/piani/nuovo`.

## Side Effects
- Reads plans, medications and invites through Supabase (RLS-scoped, via `lib/data`); no writes.

## Verification
- Run: `npm test`
- Run: `npm run test:e2e`
