# Implementation Plan: Clear User Journey

**Branch**: `1-clarify-user-journey`  
**Spec**: [spec.md](./spec.md)  
**Created**: 2026-02-28  
**Status**: Ready for implementation planning  
**Automation Note**: The repository does not contain `.specify/scripts/powershell/setup-plan.ps1`, `.specify/memory/constitution.md`, or the copied plan template. This file is the manual equivalent of the missing plan output.

## Summary

This feature will reduce route duplication and mixed-language copy by making one governance model drive:

- public support discovery,
- role home routing,
- navigation labels,
- feature retirement and redirect behavior,
- localization readiness for audited journeys.

The implementation should reuse the current role-aware workflow foundation instead of adding more entry pages. The current overlap is concentrated in [client/src/pages/support.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/support.tsx), [client/src/pages/welcome.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/welcome.tsx), [client/src/pages/workflow-hub.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/workflow-hub.tsx), [client/src/components/app-layout.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/components/app-layout.tsx), and the role-home resolver in [client/src/App.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/App.tsx).

## Technical Context

| Area | Current State | Planned Direction |
|------|---------------|-------------------|
| Frontend | React 18 + Vite + Wouter + React Query | Keep stack; consolidate role entry points into one manifest-driven experience |
| Backend | Express 5 routes in `server/routes.ts` | Extend existing role-home and admin governance endpoints |
| Persistence | Supabase Postgres with `server/storage.ts` as the single data layer | Add governance tables for journey paths, feature inventory, redirect rules, and localization audits |
| Shared types | `shared/schema.ts` + Zod schemas | Add explicit domain types for navigation governance and audit payloads |
| Current role routing | `/workflow`, `/welcome`, role dashboards, public `/support` | Preserve roles; reduce each role and stage to one primary destination |
| Current i18n | `client/src/lib/i18n.tsx` supports `ar` and `fr`; many pages still use raw strings or `tr(key, fallback)` | Require translation keys on audited surfaces and track coverage per route |
| Existing useful API | `GET /api/workflow/overview`, `GET /api/therapists`, `GET /api/onboarding` | Keep `workflow/overview` as the authenticated aggregator; add governance endpoints around it |
| Current duplication | Support selection appears in landing, welcome, workflow, nav, and therapist discovery surfaces | Model one canonical path per goal and mark all other entries as secondary or retired |
| Testing | `npm run check`, `npm test`, `npm run build` | Use existing checks plus manual role/language smoke tests |
| Open clarifications | Feature scope could have required storage choice, route authority, and localization enforcement strategy | Resolved in [research.md](./research.md); no unresolved clarifications remain |

## Constitution Check (Pre-Design)

`constitution.md` is not present in this repository. The effective design gates are derived from [CLAUDE.md](/C:/Users/Asus/Documents/GitHub/fisha/CLAUDE.md), the existing architecture, and the approved feature spec.

| Gate | Rule | Result | Notes |
|------|------|--------|-------|
| Single data access layer | New persistence must be added through `server/storage.ts` | PASS | The design adds governance CRUD via storage methods only |
| Shared contract typing | New request/response shapes must live in `shared/schema.ts` | PASS | Contracts and types stay in the shared domain layer |
| Role-safe operations | Admin and moderation actions must use existing auth/role guards | PASS | Governance mutation endpoints stay behind `requireRoles(["admin", "moderator"])` or stricter |
| Minimal surface churn | Prefer consolidating existing routes over introducing more start pages | PASS | The plan reuses `/support`, `/workflow`, and existing dashboards |
| Localization discipline | Audited pages must not rely on raw mixed-language fallback copy | PASS | The design adds explicit localization audit coverage and publish gates |

No gate violations were found before design.

## Phase 0: Research

The following questions were resolved in [research.md](./research.md):

1. What should be the source of truth for primary paths and duplicate feature entries?
2. Should role-home guidance reuse the current workflow overview API or introduce separate route-specific logic?
3. How should retired or merged feature links be preserved?
4. How should mixed-language copy be detected and blocked from release?

Phase 0 result: all clarifications are resolved and the design can proceed without waiting for additional user input.

## Phase 1: Design

### Planned Data Changes

- Add migration `supabase/migrations/034_journey_clarity_governance.sql`
- Add tables:
  - `journey_paths`
  - `feature_inventory_items`
  - `redirect_rules`
  - `localization_audits`

### Planned Shared Types

- Extend [shared/schema.ts](/C:/Users/Asus/Documents/GitHub/fisha/shared/schema.ts) with:
  - `JourneyPath`
  - `FeatureInventoryItem`
  - `RedirectRule`
  - `LocalizationAudit`
  - response types for navigation manifest, role-home overview, and governance endpoints

### Planned Server Changes

- [server/storage.ts](/C:/Users/Asus/Documents/GitHub/fisha/server/storage.ts)
  - add CRUD and query methods for the governance entities
  - add helpers that enforce one primary item per role/stage and per goal/surface
- [server/routes.ts](/C:/Users/Asus/Documents/GitHub/fisha/server/routes.ts)
  - add `GET /api/navigation/manifest`
  - extend `GET /api/workflow/overview`
  - add admin feature-inventory review endpoints
  - add localization audit endpoints
  - add redirect resolution support for retired or merged surfaces

### Planned Client Changes

- [client/src/App.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/App.tsx)
  - centralize role-home resolution around canonical destinations
- [client/src/components/app-layout.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/components/app-layout.tsx)
  - consume manifest-driven primary navigation labels and destinations
- [client/src/pages/support.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/support.tsx)
  - remain the single public decision surface for choosing support
- [client/src/pages/welcome.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/welcome.tsx)
  - demote to a short continuation state for new client onboarding only, or retire if the workflow hub fully replaces it
- [client/src/pages/workflow-hub.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/workflow-hub.tsx)
  - become the authenticated role-home hub backed by canonical primary and secondary actions
- [client/src/lib/i18n.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/lib/i18n.tsx)
  - add missing keys required by the audited routes
  - remove dependence on raw English fallback text for audited pages

### Design Artifacts

- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/journey-clarity.openapi.yaml](./contracts/journey-clarity.openapi.yaml)
- [quickstart.md](./quickstart.md)

### Agent Context

The repository has [CLAUDE.md](/C:/Users/Asus/Documents/GitHub/fisha/CLAUDE.md) but no `.specify` agent-context update script. No agent file was changed because this plan introduces no new technology beyond the existing React, Express, Supabase, and shared-schema stack.

## Phase 2: Implementation Plan

### Workstream 1: Governance Foundation

- Create the governance migration `034_journey_clarity_governance.sql`
- Add shared types and storage methods
- Seed the initial journey path catalog and feature inventory for existing public and authenticated entry points

### Workstream 2: Public Journey Consolidation

- Keep `/support` as the canonical public decision surface
- Remove duplicate top-level calls to action that compete with `/support` for the same goal
- Ensure landing, therapist discovery, peer support discovery, and self-care surfaces reference the same route definitions and labels

### Workstream 3: Authenticated Role-Home Consolidation

- Use one canonical home destination per role and stage
- Update `homeRouteForRole` and related redirects so client, therapist, listener, moderator, and admin users always land in the same primary place
- Back role-home cards and navigation with the same manifest used by governance reviews

### Workstream 4: Feature Retirement and Redirect Safety

- Classify every audited feature as primary, secondary, experimental, or retired
- Add redirect rules for retired or merged entry points
- Surface replacement guidance rather than dead-end navigation

### Workstream 5: Localization Coverage

- Audit the core release-scope routes:
  - `/`
  - `/support`
  - `/workflow`
  - `/welcome`
  - `/therapists`
  - `/peer-support`
  - `/self-care`
  - role-home pages and primary nav labels
- Replace raw strings and fallback copy in audited routes
- Block publish approval while mixed-language system text remains on audited surfaces

### Workstream 6: Verification

- Run:
  - `npm run check`
  - `npm test`
  - `npm run build`
- Manually verify:
  - visitor chooses a path from `/support`
  - client onboarding lands on the correct next step
  - therapist, listener, moderator, and admin users reach their canonical home immediately after sign-in
  - Arabic and French sessions render audited routes without mixed-language system copy
  - retired links resolve to active replacements

## Constitution Check (Post-Design)

| Gate | Result | Notes |
|------|--------|-------|
| Single data access layer | PASS | All persisted governance artifacts are modeled through `server/storage.ts` |
| Shared contract typing | PASS | Data model and OpenAPI contract map to shared types |
| Role-safe operations | PASS | Admin-only governance changes remain protected |
| Minimal surface churn | PASS | The design consolidates current routes instead of adding new ones |
| Localization discipline | PASS | Publish flow includes explicit coverage tracking and zero mixed-language tolerance on audited surfaces |

No post-design violations were found. The feature is ready for implementation work.
