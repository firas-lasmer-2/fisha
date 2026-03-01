# Research: Clear User Journey

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-02-28

## Decision 1: Persist journey governance in Supabase tables

**Decision**: Store canonical journey paths, feature inventory records, redirect rules, and localization audit results in Supabase-backed tables rather than only in code or external documentation.

**Rationale**:

- The feature spec requires product owners to review, classify, retire, and preserve user-facing features over time.
- This repository already uses Supabase for operational content and admin workflows.
- Review status, replacement routes, and language readiness need to survive deployments and be queryable from admin tools.

**Alternatives considered**:

- Hard-coded TypeScript config only: fast to start, but weak for review history and non-developer governance.
- Spreadsheet or Notion process: easy for humans, but disconnected from runtime routing and release checks.

## Decision 2: Keep `GET /api/workflow/overview` as the authenticated role-home aggregator

**Decision**: Extend the existing `GET /api/workflow/overview` endpoint instead of introducing separate role-home APIs for each dashboard or route.

**Rationale**:

- The endpoint already aggregates unread messages, appointment counts, peer-session activity, and role-aware recommendations.
- Reusing it avoids pushing route-selection logic back into the client.
- It creates one authoritative place for primary actions, secondary actions, and role-home metadata.

**Alternatives considered**:

- Separate workflow endpoints per role: more code, more drift risk, and harder to keep consistent.
- Client-only home resolution: would duplicate business rules across `App.tsx`, `welcome.tsx`, `workflow-hub.tsx`, and `app-layout.tsx`.

## Decision 3: Keep `/support` as the single public support-decision surface

**Decision**: Make `/support` the canonical public route for choosing between peer support, therapist care, and self-care, while reducing or retiring competing first-step surfaces.

**Rationale**:

- [client/src/pages/support.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/support.tsx) already contains the strongest decision structure in the current app.
- [client/src/pages/welcome.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/welcome.tsx) and [client/src/pages/workflow-hub.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/workflow-hub.tsx) overlap with the same support-selection goal.
- Promoting one canonical public decision page is the fastest way to reduce duplication without removing useful downstream features.

**Alternatives considered**:

- Keep both `/support` and `/welcome` as equal first steps: preserves current confusion.
- Move all path selection into the landing page: increases landing complexity and duplicates logic again.

## Decision 4: Treat raw fallback copy as release debt on audited surfaces

**Decision**: For audited routes, require approved translation keys for all system copy and track fallback usage through localization audits.

**Rationale**:

- The current `tr(key, fallback)` pattern and raw strings make untranslated content look temporarily acceptable in development while shipping mixed-language UI.
- The user problem is not only missing translation files; it is inconsistent runtime copy across shared navigation and primary journeys.
- A route-level audit lets the team measure mixed-copy debt and block release of high-traffic surfaces until it is resolved.

**Alternatives considered**:

- Keep English fallback everywhere: fast, but directly conflicts with the feature requirement for one language per session.
- Rely on manual QA only: insufficient for a broad set of shared surfaces and regressions.

## Decision 5: Use explicit redirect rules for retired or merged feature entry points

**Decision**: Model legacy route handling with redirect rules instead of scattered conditionals in page components.

**Rationale**:

- The feature spec requires preserved access when features are merged or retired.
- Central redirect rules make it possible to explain why a route changed and where the user should go now.
- This avoids hidden routing behavior spread across `App.tsx`, page components, and future admin tools.

**Alternatives considered**:

- Ad hoc client redirects in each component: hard to audit and easy to forget.
- Let old routes 404 with static guidance: technically simple, but poor user experience and weaker continuity.

## Decision 6: Canonical role homes should be stage-aware, not page-count-driven

**Decision**: Define one canonical home per role and stage, but allow different roles to keep specialized downstream pages as secondary actions.

**Rationale**:

- Users do not need fewer capabilities; they need fewer competing starting points.
- Therapists, listeners, moderators, and admins already have distinct dashboards that should remain intact.
- The cleanup should decide what is primary, not flatten everything into one generic dashboard.

**Alternatives considered**:

- One universal dashboard for every role: reduces clarity for specialized roles.
- Leave every role with several equally promoted homes: preserves the current duplication problem.

## Result

All planning clarifications are resolved. No `NEEDS CLARIFICATION` markers remain for Phase 1 design or Phase 2 implementation planning.
