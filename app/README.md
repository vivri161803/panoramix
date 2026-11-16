# app (Next.js App Router)

## Overview
All routes of Appoteca (Next.js 16 App Router, see `AGENTS.md`). Pages are
grouped by layout: `(app)` for the signed-in app, `(auth)` for sign-in and
onboarding, `(print)` for A4 sheets. Route handlers live under `api` and `auth`.
Session gating for every path except `PUBLIC_PATHS` (`/accesso`,
`/auth/confirm`, `/api/cron`) happens in `proxy.ts` at the repository root.

## Interface
- `default RootLayout({ children })` (`layout.tsx`) - `<html lang="it">`, Geist fonts, `data-theme` from the theme cookie (unset for `"system"`).
- `generateViewport()` (`layout.tsx`) - `themeColor` from `THEME_COLOR` (`lib/theme`); light/dark media pair for `"system"`.
- `metadata` (`layout.tsx`) - title template `%s · Appoteca`, `robots: { index: false, follow: false }`.
- `default Home()` (`page.tsx`) - `redirect("/piani")`.
- Assets: `globals.css`, `icon.svg`, `apple-icon.png`.
- Subdirectories:
  - [(app)](./(app)/README.md) - signed-in pages (`/piani`, `/account`).
  - [(auth)](./(auth)/README.md) - `/accesso`, `/benvenuto`.
  - [(print)](./(print)/README.md) - `/piani/[id]/stampa`, `/piani/[id]/terapia`.
  - [api](./api/README.md) - `/api/cron/alerts`, `/api/cron/reminders`.
  - [auth](./auth/README.md) - `/auth/confirm`.

## Invariants
- The site is not indexed (`robots` noindex / nofollow).
- Theme is read from `THEME_COOKIE` and parsed with `parseTheme` on every request.
- `/` always redirects to `/piani`.

## Side Effects
- `layout.tsx` reads request cookies, which makes the tree dynamic.

## Verification
- Run: `npm test`
- Run: `npm run test:db`
- Run: `npm run test:e2e`
- Run: `npm run typecheck`
