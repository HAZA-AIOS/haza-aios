# HAZA AIOS Marketing Website Plan

## Objective

Build the HAZA AIOS public marketing website using the design system created in Epic 1, closely matching the supplied landing-page reference while keeping all reusable UI in the shared package and the page structure in the app.

## Constraints

- Use the uploaded HAZA AIOS landing-page design as the primary visual reference.
- Preserve the dark premium AI/SaaS direction, typography, spacing, glow, gradients, card styling, and responsive behavior.
- Do not invent a completely different design.
- Reusable UI primitives must live in packages/ui before being used by the landing page.
- No fake customer names, logos, fabricated claim statistics, or backend/auth functionality.
- Use placeholder values where needed.

## Technology

- React
- Vite
- Tailwind CSS
- shadcn/ui patterns
- Framer Motion
- AOS
- Font Awesome
- Existing HAZA AIOS UI library

## Required Component Architecture

### packages/ui reusable primitives

- Button
- Card
- Badge
- Input
- Select
- Navigation primitives
- Section heading
- CTA primitives
- Container
- Icon wrapper

### apps/web page sections

- Header
- HeroSection
- IndustriesPanel
- IntelligenceSection
- AdvantageSection
- IndustryShowcase
- CapabilitiesSection
- TrustSection
- GlobalFutureSection
- DemoRequestSection
- FinalCTA
- Footer

## Landing Page Structure

1. Header / navigation
   - HAZA AIOS logo
   - Products, Solutions, Industries, Resources, Pricing, Company
   - Sign In
   - Request Demo
   - Mobile responsive navigation

2. Hero section
   - Main headline and supporting copy
   - Primary + secondary CTA
   - AI automation/security/scalability highlights
   - Right-side industries panel
   - Background image / visual treatment consistent with reference

3. “A Smarter Way to Run Everything”
   - AI-Driven Intelligence
   - Unified Operations
   - Automation at Scale
   - Better Experiences

4. “The HAZA AIOS Advantage”
   - All-in-One Platform
   - Built for Any Industry
   - AI at the Core
   - Secure & Compliant

5. “Where Organizations Thrive”
   - Education
   - Healthcare
   - Corporate
   - Government/Public Sector
   - Additional relevant cards

6. “Powerful Capabilities”
   - AI Assistants
   - Workflow Automation
   - Data & Analytics
   - Communication Hub
   - Document Management
   - Integration & APIs

7. “Trusted by Innovators Worldwide”
   - Placeholder brand/trust section
   - No fabricated customer claims

8. Global future section
   - Global/multilingual positioning
   - World/global visual treatment
   - Security/compliance points

9. Demo request section
   - Full Name
   - Organization / Institution
   - Email
   - Industry selector
   - Request Demo CTA
   - Frontend-only validation

10. Final CTA

- “Ready to Transform Your Organization?”
- Primary and secondary CTA
- Placeholder statistics

11. Footer

- Branding
- Platform, Solutions, Resources, Company links
- Social icons
- Legal links

## Motion and Responsiveness

- Use Framer Motion and AOS selectively for hero entrance, section reveal, hover states, subtle motion, and CTA interactions.
- Avoid excessive animation.
- Ensure the website works across desktop, laptop, tablet, and mobile.
- Recompose sections for mobile instead of only shrinking desktop layouts.

## Accessibility and SEO

- Semantic HTML and structured headings
- Keyboard-friendly navigation and visible focus states
- Sufficient contrast and accessible controls
- Meaningful alt text
- update page title, meta description, Open Graph basics, favicon, and robots metadata

## Validation Requirements

Run the following before completion:

- TypeScript
- ESLint
- Prettier
- production build

## GitHub Workflow

1. Confirm current branch is develop.
2. Create branch: feature/marketing-website
3. Commit logical milestones with conventional commits.
4. Update CHANGELOG.md for Epic 2.
5. Run all quality checks.
6. Commit final changes.
7. Push branch to origin.
8. Create PR to develop.
9. Review and merge into develop.
10. Update local develop.
11. Create Epic 2 release tag using the next project pre-release version.
12. Create the corresponding GitHub release.

## Stop Condition

Stop after Epic 2 has been implemented, validated, documented, merged, and released. Do not start the next Epic.
