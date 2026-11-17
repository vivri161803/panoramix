# auth

## Overview
Non-page auth routes (outside the `(auth)` route group, which holds the
sign-in pages).

## Subdirectories & Boundaries
- confirm: [./confirm/README.md](./confirm/README.md) - `GET /auth/confirm`, verifies the email magic link (`verifyOtp` / `exchangeCodeForSession`) and redirects to `/piani` or `/accesso?errore=scaduto`.
