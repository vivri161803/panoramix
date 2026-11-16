# Magic-link confirmation (`/auth/confirm`)

## Overview
Route handler opened from the sign-in link sent by email. It turns the link
parameters into a Supabase session and redirects.

## Interface
- `GET(request: NextRequest)` (`route.ts:GET`) - reads search params
  `token_hash`, `type` (default `"email"`, cast to `EmailOtpType`) and `code`.
  - With `token_hash`: `supabase.auth.verifyOtp({ type, token_hash })`.
  - Else with `code`: `supabase.auth.exchangeCodeForSession(code)`.
  - Redirects to `/piani` on success, otherwise to `/accesso?errore=scaduto`.

## Invariants
- `token_hash` takes precedence over `code`; with neither, the result is a failure redirect.
- Redirect URLs are built against `request.nextUrl.origin` (no open redirect parameter).
- `/auth/confirm` is in `PUBLIC_PATHS` in `proxy.ts`, so it is reachable without a session.

## Side Effects
- Sets Supabase auth session cookies through `createClient` (`lib/supabase/server`).
- Logs `console.warn` on an invalid link or code.

## Verification
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
