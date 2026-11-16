# Sign-in page (`/accesso`)

## Overview
Passwordless sign-in: the user enters an email and receives a magic link.
Also shows the "link expired" and "account deleted" notices.

## Interface
- `default AccessoPage({ searchParams })` (`page.tsx`) - server page; `metadata.title = "Accedi"`.
  - Redirects to `/piani` if `getSessionUser()` returns a user.
  - Passes `expired = searchParams.errore === "scaduto"` and `deleted = searchParams.eliminato === "1"` to `AccessForm`.
- `AccessForm({ expired, deleted })` (`AccessForm.tsx`, client component) - form bound to
  the `sendMagicLink` server action (`lib/actions/auth`) via `useActionState`.
  - Field: `email`. After success shows the "Ti abbiamo inviato un link" state with
    "Usa un'altra email" (resets locally) and "Invia di nuovo" (resubmits the same `email`).

## Invariants
- `/accesso` is in `PUBLIC_PATHS` in `proxy.ts`; signed-in users are bounced to `/piani`.
- The sent state is shown only when `state.ok` and the state has not been dismissed (`dismissed` holds the dismissed action state).
- Errors from the action (`state.error`) are rendered with `role="alert"` and linked via `aria-describedby`.

## Side Effects
- Submitting calls `sendMagicLink`, which sends the sign-in email (implemented in `lib/actions/auth`).

## Verification
- Run: `npm test` (see `tests/actions.test.ts`)
- Run: `npm run test:e2e`
