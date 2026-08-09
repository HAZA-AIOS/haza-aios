## [0.2.0-alpha.1] - 2026-08-09

### Added

- HAZA AIOS design tokens and shared styling foundation
- Typography and responsive type utilities
- Semantic color palette and gradient system
- Shared form controls, cards, navigation patterns, and badge primitives
- Extended Button variants for HAZA AIOS product styling
- Shared design system preview for component validation
- Design system documentation and development guidance

### Changed

- Centralized visual tokens in the `@haza-aios/ui` package
- Updated the web app to consume shared design system styles and primitives
- Standardized spacing, radius, shadow, and surface treatments

### Architecture

- Preserved monorepo structure and app/package separation
- Kept reusable UI in `packages/ui` and page logic in `apps/web`
- Maintained shadcn/ui patterns and Tailwind + Vite workflow

### Infrastructure

- Confirmed the front-end toolchain passes typecheck, lint, formatting, and production build validation
- Docker remains documented as blocked by host virtualization limits

## [0.1.0-alpha.1] - 2026-08-09

### Added

- HAZA AIOS monorepo foundation
- React/Vite frontend foundation
- Tailwind CSS integration
- shadcn/ui shared component architecture
- Shared `@haza-aios/ui` package
- Frontend application architecture
- TypeScript strict configuration
- ESLint and Prettier tooling
- Frontend environment configuration
- React error boundary
- Frontend testing foundation
- Developer documentation

### Architecture

- Established `apps/web` application workspace
- Established reusable `packages/ui` component library
- Established application/shared-component separation
- Established frontend development quality gates

### Infrastructure

- Docker milestone documented as blocked because host virtualization is unavailable
- Local React/Vite development remains operational
