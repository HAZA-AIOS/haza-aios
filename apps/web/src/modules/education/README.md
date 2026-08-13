# HAZA AIOS Education Module

This directory contains the foundation for the HAZA AIOS Education module (Epic 9).

## Architecture

This module follows the Industry Modules Framework established in Epic 8. It registers itself via the `ModuleRegistry` in the core platform and is activated per-tenant.

## Restrictions

- **No Core Contamination**: Education-specific models or data should not leak into the core platform (`apps/web/src/core`).
- **Design System**: All reusable UI components must be added to `packages/ui` first.
- **Tenant Scoped**: All education data must be scoped to an organization/tenant.
