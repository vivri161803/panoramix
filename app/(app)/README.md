# (app) route group

## Overview
Route group for the signed-in application. The group name does not appear in
URLs. Its layout requires a complete profile and renders the skip link,
header (logo link to `/piani`, initials link to `/account`), main content area,
toast provider and disclaimer.

## Interface
- `default AppLayout({ children })` (`layout.tsx`) - calls `requireProfile()` and `initials(profile)` (`lib/data`);
  wraps children in `ToastProvider` (`components/Toast`).
- Subdirectories:
  - [account](./account/README.md) - `/account`, profile, theme, sign-out, deletion.
  - [piani](./piani/README.md) - `/piani`, plans list, new plan and per-plan pages.

## Invariants
- Every page in this group is rendered only for a signed-in user with non-blank first and last name (`requireProfile` redirects to `/accesso` or `/benvenuto`).
- Main content has `id="contenuto"`, the target of the skip link.

## Side Effects
- Reads the session and profile through Supabase.

## Verification
- Run: `npm test`
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
