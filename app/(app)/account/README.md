# Account (`/account`)

## Overview
Profile name, theme preference, sign-out and account deletion.

## Interface
- `default AccountPage()` (`page.tsx`) - `metadata.title = "Account"`. Renders `ProfileForm`
  (`next="/account"`), `ThemePicker` (initial from `THEME_COOKIE` via `parseTheme`, `lib/theme`),
  a form bound to `signOut` (`lib/actions/auth`) and `DeleteAccount`.
- `DeleteAccount()` (`DeleteAccount.tsx`, client) - two-step confirmation bound to `deleteAccount`
  (`lib/actions/auth`) via `useActionState`; field `confirm`.

## Invariants
- Requires a complete profile (`requireProfile`).
- Deletion requires typing `ELIMINA` (UI label); the error shown is `state.fieldErrors.confirm ?? state.error`.
- The theme choice is per device (cookie), not per account.

## Side Effects
- `signOut` ends the session; `deleteAccount` removes the account and its data (implemented in `lib/actions/auth`).

## Verification
- Run: `npm test` (see `tests/actions.test.ts`)
- Run: `npm run test:e2e`
