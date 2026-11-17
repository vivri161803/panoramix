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
| `Pill.tsx` | `Pill({ color, shape, size = 28, rotate = 0 })` | Draws only pills (`tonda`, `ovale`, `capsula`) with `pillStyle` / `PILL_RATIO` from `@/lib/pills`. Unknown shapes fall back to `PILL_RATIO.tonda`. Any medication of any category is drawn with `Presidio`. |
| `Presidio.tsx` | `PRESIDIO_GEO` (per `Category`), `PresidioSvg({ category, color, scale, style? })`, `Presidio({ category, pillShape?, color, size?, rotate?, view = "icon", level?, days?, scaleMax = 60, status?, asNeeded?, hasStock? })`, `CategoryGlyph({ category, size = 24 })` | Client component (`"use client"`). Port of `design/Presidio.dc.html`: the 10 category icons (neutral body, 2-unit outline, one zone in the med colour; `pillola` delegates to `Pill` with `pillShape`). `view="icon"` draws the tilted icon (`size` number); `view="tube"` draws the Dispenser tube on the 0–`scaleMax` scale (`size` `"s"`/`"l"`): stacked icons up to `days`, or a full band when `level` (default `defaultMode(category) === "livello"`), «60+» beyond the scale, ticks at 7 and 14 coloured by `status`. `CategoryGlyph` draws the 10 line glyphs of `design/Presidi.dc.html` section 10 (viewBox 24, stroke 1,8, `currentColor`). |
| `StatusChip.tsx` | `StatusChip({ status: MedStatus })`, `STATUS_LABEL` | Chip for the `MedStatus` values `ok`, `order`, `ordered`, `out` (type from `@/lib/forecast`). |
| `Switch.tsx` | `Switch({ checked, onChange, label, sub? })` | Client component (`"use client"`). A `role="switch"` button. |
| `icons.tsx` | `IconPlus`, `IconBack`, `IconNext`, `IconCheck`, `IconCheckCircle`, `IconAlertCircle`, `IconXCircle`, `IconClose`, `IconChevronDown`, `IconPrint`, `IconMail` | Decorative (`aria-hidden`) SVG icons that draw in `currentColor`. |

## Invariants

- `AppIcon` uses fixed gradient ids (`pxi-bg`, `pxi-red`, `pxi-wht`, `pxi-teal`,
  `pxi-grn`). Several icons on one page share identical definitions, so these
  ids must stay the same across instances (`AppIcon.tsx` header comment).
  Keep the drawing in sync with `app/icon.svg` and `public/email-logo.png`.
- `PresidioSvg` makes per-instance gradient ids from `useId()` (prefix `pxp`).
  `Presidio` and `PresidioSvg` fall back to `PRESIDIO_GEO.altro` for unknown
  categories.
- Changing a `PRESIDIO_GEO` entry also changes how pieces stack in the
  `Dispenser` tube (`Presidio view="tube"`).
- `StatusChip` and `STATUS_LABEL` must cover every `MedStatus` key.
- Only `Switch.tsx` and `Presidio.tsx` are marked `"use client"` (the tube
  animates its pieces with state). The other files have no directive and
  inherit the client or server environment of whatever imports them.
  `PresidioSvg` calls the `useId` hook, so it must render as a React
  component.

## Side Effects

- None. These components only render markup. `Switch` reports changes through
  its `onChange` callback.

## Verification

- Run: `npm test` (vitest). Also run `npm run typecheck`
  (`next typegen && tsc --noEmit`).
