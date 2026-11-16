# Welcome / first-access page (`/benvenuto`)

## Overview
Onboarding step that asks a newly signed-in user for first and last name,
used in alert emails.

## Interface
- `default BenvenutoPage()` (`page.tsx`) - server page; `metadata.title = "Benvenuto"`.
  Renders `ProfileForm` (`components/ProfileForm`) with `submitLabel="Continua"` and `next="/piani"`.

## Invariants
- No session (`getSessionUser()` falsy) redirects to `/accesso`.
- If the profile already has non-blank `first_name` and `last_name`, redirects to `/piani`.
- This is the target of `requireProfile` (`lib/data.ts`) when the name is missing.

## Side Effects
- None in the page; saving is done by `ProfileForm`'s server action.

## Verification
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
