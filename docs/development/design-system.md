# HAZA AIOS Design System

## Overview

The HAZA AIOS Design System is the shared visual foundation for all product experiences built on the monorepo. It lives in the `packages/ui` package and is intentionally reusable, composable, and independent from page-level business logic.

The system is aligned to the existing Epic 0 React + Vite + Tailwind CSS + shadcn/ui stack and preserves the project’s architecture constraints.

## Design Principles

- Reuse shared primitives before application-specific UI
- Keep design tokens centralized and semantic
- Preserve the HAZA AIOS visual direction defined by the approved design reference
- Favor accessibility, readable contrast, and strong product usability
- Keep motion subtle and intentional

## Foundations

### Typography

The system uses a modern SaaS typography stack with a display-first hierarchy and a clean sans-serif body stack.

- Display font: `Sora`, `Inter`, `Segoe UI`, sans-serif
- Sans font: `Inter`, `Segoe UI`, sans-serif
- Mono font: `JetBrains Mono`, `SFMono-Regular`, monospace

Utility classes include:

- `text-h1`
- `text-h2`
- `text-h3`
- `text-body`
- `text-label`
- `text-caption`
- `text-nav`

### Color System

The design tokens are centralized in the shared UI package under `packages/ui/src/styles/globals.css` and exported via `packages/ui/src/lib/design-tokens.ts`.

Core semantic values include:

- background / foreground
- muted / muted-foreground
- card / panel
- border / input / ring
- primary / secondary / accent
- destructive / success / warning / info

### Gradients

Reusable gradient tokens are defined as CSS variables and exposed as utilities:

- `--gradient-primary`
- `--gradient-glow`
- `--gradient-panel`
- `--gradient-ambient`

Utilities:

- `bg-haza-primary`
- `text-gradient`
- `bg-haza-ambient`

### Spacing and Layout

The system uses consistent spacing cadence and layout constraints:

- container width tokens: `--container-md`, `--container-lg`, `--container-xl`
- responsive page gutters via `.container-haza`
- base radius and shadow tokens for cards, panels, and controls

## Shared Components

### Buttons

Buttons are extended from the shared shadcn/ui pattern and include HAZA variants such as:

- `default`
- `primary`
- `secondary`
- `outline`
- `ghost`
- `destructive`
- `gradient`

### Form Controls

Reusable form primitives include:

- `Input`
- `Textarea`
- `Select`
- `Checkbox`
- `Switch`

### Layout and Surfaces

Reusable surface patterns include:

- `Card`
- `FeatureCard`
- `GlassCard`
- `Navbar`
- `NavItem`
- `Badge`

## Accessibility

The system follows shadcn/ui accessibility conventions with:

- visible focus states
- semantic labels and structure
- sufficient contrast for text and controls
- keyboard-friendly interactive elements
- reduced-motion-friendly motion policy

## Motion

Motion is intentionally conservative and centered around standard durations and easing values.

- fast: 150ms
- normal: 220ms
- slow: 350ms

The system keeps transitions smooth but not overly animated to preserve SaaS readability and product polish.

## Usage Rules

1. Add reusable UI primitives to `packages/ui` first.
2. Consume shared components from the UI package in app code.
3. Avoid page-specific UI logic in shared components.
4. Keep colors, radius, spacing, and gradients token-based rather than hard-coded.
