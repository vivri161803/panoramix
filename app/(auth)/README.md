# (auth) route group

## Overview
Route group for the unauthenticated / onboarding pages. The group name does
not appear in URLs. Its layout renders a centred card with the Appoteca logo
and the shared disclaimer, without the app header.

## Interface
- `default AuthLayout({ children })` (`layout.tsx`) - wraps pages with `AppIcon`
  and `Disclaimer` (`components/ui`).
- Subdirectories:
  - [accesso](./accesso/README.md) - `/accesso`, magic-link sign-in form.
  - [benvenuto](./benvenuto/README.md) - `/benvenuto`, first-access name form.

## Invariants
- The layout does not check the session; each page performs its own redirects.

## Side Effects
- None in `layout.tsx`.

## Verification
- Run: `npm run test:e2e`
