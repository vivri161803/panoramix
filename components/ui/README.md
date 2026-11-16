# components/ui

## Overview

Presentational primitives shared by the feature components in
[`components/`](../README.md) and by the App Router pages. They are pure
rendering helpers (SVG icons, chips, switches, error text, the disclaimer
footer) with no data fetching and no server actions. Visual tokens come from
CSS custom properties (`--px-*`) and the `px-*` utility classes defined in the
global stylesheet. User-facing text is in Italian.

## Interface

| File | Exports | Notes |
| --- | --- | --- |
| `AppIcon.tsx` | `AppIcon({ size = 32, label = "Appoteca" })` | App logo SVG. A `null` label makes it decorative (`aria-hidden`). |
| `Disclaimer.tsx` | `DISCLAIMER` (string), `Disclaimer()` | Footer carrying the medical disclaimer text. Hidden when printing (`print:hidden`). |
| `FieldError.tsx` | `FieldError({ id?, message? })` | `role="alert"` error line with `IconAlertCircle`. Renders `null` when `message` is empty. |
| `Pill.tsx` | `Pill({ color, shape, size = 28, rotate = 0 })` | Tablet swatch built with `pillStyle` / `PILL_RATIO` from `@/lib/pills`. Delegates to `Presidio` when `isPresidio(shape)` (from `@/lib/presidi`). Unknown shapes fall back to `PILL_RATIO.tonda`. |
| `Presidio.tsx` | `PRESIDIO_GEO`, `PresidioSvg({ shape, color, scale, style? })`, `Presidio({ shape, color, size = 48, rotate? })`, `FormGlyph({ form: MedForm, size = 24 })` | SVG drawings for non-tablet forms: `siringa`, `penna`, `fiala`, `cerotto`, `cerotto-tondo`, `bustina`, `flacone`, `monodose`, `goccia`. `PRESIDIO_GEO` holds the drawing size, tilt, and tube footprint (`len`, `step`) that `Dispenser` also uses. `FormGlyph` draws line glyphs for `compressa`, `iniezione`, `cerotto`, and `collirio`. |
| `StatusChip.tsx` | `StatusChip({ status: MedStatus })`, `STATUS_LABEL` | Chip for the `MedStatus` values `ok`, `order`, `ordered`, `out` (type from `@/lib/forecast`). |
| `Switch.tsx` | `Switch({ checked, onChange, label, sub? })` | Client component (`"use client"`). A `role="switch"` button. |
| `icons.tsx` | `IconPlus`, `IconBack`, `IconNext`, `IconCheck`, `IconCheckCircle`, `IconAlertCircle`, `IconXCircle`, `IconClose`, `IconChevronDown`, `IconPrint`, `IconMail` | Decorative (`aria-hidden`) SVG icons that draw in `currentColor`. |

## Invariants

- `AppIcon` uses fixed gradient ids (`pxi-bg`, `pxi-red`, `pxi-wht`, `pxi-teal`,
  `pxi-grn`). Several icons on one page share identical definitions, so these
  ids must stay the same across instances (`AppIcon.tsx` header comment).
  Keep the drawing in sync with `app/icon.svg` and `public/email-logo.png`.
- `PresidioSvg` makes per-instance gradient ids from `useId()` (prefix `pxp`).
  `Presidio` and `PresidioSvg` fall back to `PRESIDIO_GEO.goccia` for unknown
  shapes.
- Changing a `PRESIDIO_GEO` entry also changes how pieces stack in the
  `Dispenser` tube (`components/Dispenser.tsx:geo`).
- `StatusChip` and `STATUS_LABEL` must cover every `MedStatus` key.
- Only `Switch.tsx` is marked `"use client"`. The other files have no
  directive and inherit the client or server environment of whatever imports
  them. `PresidioSvg` calls the `useId` hook, so it must render as a React
  component.

## Side Effects

- None. These components only render markup. `Switch` reports changes through
  its `onChange` callback.

## Verification

- Run: `npm test` (vitest). Also run `npm run typecheck`
  (`next typegen && tsc --noEmit`).
