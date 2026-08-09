# HAZA AIOS Frontend Development

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Motion
- AOS
- Font Awesome

## Application

Location:

`apps/web`

## Shared UI

Location:

`packages/ui`

## Development

Run the frontend:

```bash
npm run dev:web
```

Build:

```bash
npm run build:web
```

Type Checking:

```bash
npm run typecheck:web
```

Linting:

```bash
npm run lint:web
```

Formatting:

```bash
npm run format
```

Formatting Check:

```bash
npm run format:check
```

Full Quality Check:

```bash
npm run check:web
```

## Component Rule

Every new reusable UI element must first be added to:

`packages/ui`

before it is used by an application page.

## Design Reference

The HAZA AIOS uploaded landing-page design is the authoritative visual reference for frontend development.

No alternative visual direction should be introduced without explicit design approval.

## Accessibility

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- Every meaningful image requires `alt` text; decorative images use `alt=""`
- Every form input requires an associated `<label>`
- Interactive components must be keyboard accessible
- Do not remove browser focus indicators without providing an accessible replacement
- The final HAZA theme will be checked for readable contrast

## Motion Accessibility

The application uses Motion for React and AOS for animations.

All motion must respect `prefers-reduced-motion`. The design system will provide a centralized motion policy:

- Normal Motion
- Reduced Motion
- No Motion

Do not individually disable animations in random components.

## Environment Variables

Frontend environment variables must be prefixed with `VITE_` to be exposed to browser-side code.

**Never put secrets in frontend environment variables:**

- ❌ `VITE_DATABASE_PASSWORD`
- ❌ `VITE_OPENAI_SECRET`
- ❌ `VITE_JWT_SECRET`

Those belong on the backend.

See `apps/web/.env.example` for the current variable template.
