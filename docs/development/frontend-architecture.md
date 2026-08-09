# HAZA AIOS Frontend Architecture

## Applications

### apps/web

The primary web application built with:

- **React** — UI framework
- **Vite** — Build tool and dev server
- **TypeScript** — Type safety

## Shared UI

### packages/ui (`@haza-aios/ui`)

The shared component library consumed by all applications. Contains reusable UI primitives powered by shadcn/ui.

**Package exports:**

```
@haza-aios/ui/components/*   →  src/components/*.tsx
@haza-aios/ui/lib/*          →  src/lib/*.ts
@haza-aios/ui/hooks/*        →  src/hooks/*.ts
@haza-aios/ui/styles/*       →  src/styles/*
```

## Component Ownership

| Category                | Location                        | Examples                                      |
| ----------------------- | ------------------------------- | --------------------------------------------- |
| **Shared primitives**   | `packages/ui`                   | Button, Input, Card, Dialog, Table, Badge     |
| **Application components** | `apps/web/src/components`    | OrganizationSwitcher, DashboardSidebar, AICommandBar |
| **Pages**               | `apps/web/src/pages`            | LandingPage, LoginPage, DashboardPage         |

### Application Directory Structure

```
apps/web/src/
├── app/              # Application-level configuration (providers, router, config)
├── components/
│   ├── layout/       # Reusable shell (Header, Footer, Sidebar, PageContainer)
│   └── features/     # Domain compositions (organization, auth, dashboard, ai)
├── hooks/            # Application hooks (useOrganization, useAuth, useTheme)
├── lib/              # Application utilities (api, validation, constants)
└── pages/            # Route-level screens
```

## Styling

- **Tailwind CSS v4** — Utility-first CSS framework
- **shadcn/ui** — Component primitives (new-york style, neutral base color)
- **CSS variables** — Theme tokens and design system values

### shadcn/ui Monorepo Configuration

- Shared components are routed to `packages/ui` via the `ui` alias in `components.json`
- Application-specific components remain in `apps/web/src/components`
- Both packages share the `cn()` utility from `@haza-aios/ui/lib/utils`

## Animation

- **Motion for React** — Production-grade animations and transitions
- **AOS** — Animate On Scroll effects

## Icons

- **Font Awesome** — Icon library (solid, regular, brands)

## Rules

> **Every new UI element must first be added to the shared component library before being consumed by a page.**

When adding a new shadcn component, run from the repository root:

```bash
npx shadcn@latest add <component> -c apps/web
```

The CLI will route shared components to `packages/ui` automatically.
