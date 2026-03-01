# Quickstart: Clear User Journey

**Feature**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Contracts**: [journey-clarity.openapi.yaml](./contracts/journey-clarity.openapi.yaml)

## Goal

Implement a single-source-of-truth journey model that removes duplicate start paths, clarifies role homes, preserves retired links, and enforces language consistency on audited routes.

## Implementation Order

1. Add migration `supabase/migrations/034_journey_clarity_governance.sql`.
2. Extend [shared/schema.ts](/C:/Users/Asus/Documents/GitHub/fisha/shared/schema.ts) with governance domain types.
3. Add governance storage methods in [server/storage.ts](/C:/Users/Asus/Documents/GitHub/fisha/server/storage.ts).
4. Add or extend governance endpoints in [server/routes.ts](/C:/Users/Asus/Documents/GitHub/fisha/server/routes.ts).
5. Seed initial journey paths and feature inventory records for current public and signed-in entry surfaces.
6. Refactor route/home resolution in [client/src/App.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/App.tsx).
7. Refactor navigation in [client/src/components/app-layout.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/components/app-layout.tsx) to use canonical labels and destinations.
8. Simplify [client/src/pages/support.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/support.tsx), [client/src/pages/welcome.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/welcome.tsx), and [client/src/pages/workflow-hub.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/pages/workflow-hub.tsx) around the manifest.
9. Replace raw strings and fallback-driven mixed copy in audited routes by adding missing keys in [client/src/lib/i18n.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/lib/i18n.tsx).
10. Run validation and manual role/language smoke tests.

## Commands

```bash
npm run check
npm test
npm run build
```

## Manual Verification Matrix

### Visitor

- Open `/support`.
- Confirm only one primary choice is promoted per goal.
- Confirm therapist and peer paths explain when to choose them.

### Client

- Sign in with incomplete onboarding and confirm the next step is consistent.
- Finish onboarding and confirm the user reaches the canonical home path.
- Confirm duplicate “find support” entry points are secondary, not competing primaries.

### Therapist

- Sign in and confirm the first destination is the therapist home, not a client flow.
- Confirm top navigation and dashboard labels match the same terminology.

### Listener

- Sign in with and without a completed application.
- Confirm the listener home shows readiness, session, and cooldown actions without duplicate first-step cards.

### Moderator and Admin

- Confirm moderation and admin users each have one primary home destination.
- Confirm feature inventory and localization-audit endpoints are restricted to authorized roles.

### Language Coverage

- Switch to Arabic and review each audited route.
- Switch to French and review each audited route.
- Confirm no audited route shows unintended mixed-language system copy, untranslated labels, or fallback text.

## Done Criteria

- One active canonical path exists for every in-scope role and stage.
- Every audited feature entry is classified in the inventory.
- Retired routes resolve to canonical destinations or clear guidance.
- Audited routes pass Arabic and French localization audits.

## Verification Notes

- `2026-03-01`: `npm run check` passed.
- `2026-03-01`: `npm test` passed after rerunning outside the sandbox because `esbuild` child-process spawn failed with `EPERM` in the restricted environment.
- `2026-03-01`: `npm test` passed again after the route-splitting and bundling cleanup.
- `2026-03-01`: `npm run build` passed after rerunning outside the sandbox for the same `esbuild` spawn restriction.
- `2026-03-01`: The Vite warning about `peer-support.tsx` being both statically and dynamically imported was removed by routing `/listen` through the same lazy-loaded peer support page.
- `2026-03-01`: The large client chunk warning was removed by lazily loading route pages and splitting vendor bundles in `vite.config.ts`.
- `2026-03-01`: The lingering PostCSS warning was removed by cleaning unused Tailwind 4/Vite tooling from the dependency graph and adding a repo-owned compatibility patch in `script/patch-tailwind-postcss.js` for the active Tailwind 3 and Vite CSS pipeline.
- `2026-03-01`: Final validation passed with `npm run check`, `npm test`, and `npm run build` completing without the earlier client-build warnings.
- `2026-03-01`: Browser-level manual smoke testing for visitor, role-home, redirect, and language-switch journeys was not executed in this terminal session and remains the next verification step.
