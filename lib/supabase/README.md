# lib/supabase

## Overview
Factories for server-side Supabase clients. Both modules import `server-only`, so they cannot be bundled into client components. One client acts as the signed-in user (RLS applies); the other uses the service role and bypasses RLS.

## Interface
- `createClient()` (`server.ts`): async. Returns a `@supabase/ssr` `createServerClient` bound to the request cookie store from `next/headers` `cookies()`, using `env.supabaseUrl()` and `env.supabaseAnonKey()`. Queries run as the session user, so RLS policies apply.
- `createAdminClient()` (`admin.ts`): returns a `@supabase/supabase-js` client authenticated with `env.supabaseServiceRoleKey()`, with `persistSession: false` and `autoRefreshToken: false`. Ignores RLS.

## Invariants
- Both files start with `import "server-only"`. Never import them from client components.
- `createAdminClient` is meant only for the automated jobs (its doc comment names `/api/cron/alerts`). Use `createClient` for user-facing reads and writes so that RLS keeps enforcing plan access.
- `server.ts` `setAll` swallows cookie-write errors: Server Components cannot set cookies, so session refresh is left to `proxy.ts` (see the comment in `server.ts`).

## Side Effects
- `createClient` reads request cookies and, outside Server Components, writes refreshed auth cookies through `cookieStore.set`.
- Both factories read environment variables through `lib/env.ts` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and throw if a variable is missing.
- Creating a client does not open a network connection. Calls happen only when queries are made on the returned client.

## Verification
- Run: `npm run typecheck`
- Run: `npm run test:db` (database-level checks, including RLS behavior)
