# (print) route group

## Overview
Route group for print-oriented pages. The group name does not appear in URLs.
Its layout forces the light theme and a grey screen background (white when
printing), with no app header.

## Interface
- `default PrintLayout({ children })` (`layout.tsx`) - `<div data-theme="light">` wrapper.
- Subdirectories:
  - [piani](./piani/README.md) - `/piani/[id]/stampa` and `/piani/[id]/terapia`.

## Invariants
- Pages here are always light-themed regardless of the user's theme cookie.
- The layout does not check auth; pages use `getPlanBundle`, which calls `requireProfile`.

## Side Effects
- None in `layout.tsx`.

## Verification
- Run: `npm run test:e2e`
