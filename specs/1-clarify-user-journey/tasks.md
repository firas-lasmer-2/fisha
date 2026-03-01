# Tasks: Clear User Journey

**Feature**: Clear User Journey  
**Branch**: `1-clarify-user-journey`  
**Feature Dir**: `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey`  
**Generated From**:
- `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey\plan.md`
- `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey\spec.md`
- `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey\data-model.md`
- `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey\research.md`
- `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey\quickstart.md`
- `C:\Users\Asus\Documents\GitHub\fisha\specs\1-clarify-user-journey\contracts\journey-clarity.openapi.yaml`

**Automation Note**: `.specify/scripts/powershell/check-prerequisites.ps1` and `.specify/templates/tasks-template.md` are not present in this repository, so this file is the manual equivalent of the missing generated task list.

**Priority Mapping**:
- `US1` = `P1` First-time visitor chooses the right path quickly
- `US2` = `P1` Returning users see only the actions that matter for their role
- `US3` = `P2` Users experience one language at a time
- `US4` = `P3` Product owners can keep the experience focused over time

**Testing Note**: The feature spec does not require a TDD-first workflow or story-specific automated test creation, so the task list focuses on implementation plus final validation commands and manual verification.

## Phase 1: Setup

- [X] T001 Create the journey-governance schema migration in `supabase/migrations/034_journey_clarity_governance.sql`
- [X] T002 Extend governance entities, request bodies, and response schemas in `shared/schema.ts`
- [X] T003 Seed baseline journey paths, feature inventory items, and redirect rules in `supabase/seed.sql`

## Phase 2: Foundational

- [X] T004 Implement `JourneyPath`, `FeatureInventoryItem`, `RedirectRule`, and `LocalizationAudit` storage interfaces and query helpers in `server/storage.ts`
- [X] T005 Implement `/api/navigation/manifest`, `/api/navigation/resolve`, `/api/admin/feature-inventory`, and `/api/admin/localization-audits` handlers in `server/routes.ts`
- [X] T006 [P] Create the client manifest query hook in `client/src/hooks/use-navigation-manifest.ts`
- [X] T007 [P] Create canonical route and redirect resolution utilities in `client/src/lib/navigation.ts`

## Phase 3: User Story 1 - First-Time Visitor Chooses The Right Path Quickly

**Story Goal**: Make `/support` the single clear public decision surface and remove competing public entry points that describe the same user goal.

**Independent Test Criteria**: A signed-out visitor can start at `/`, reach `/support` through the primary CTA, see one clearly promoted option per goal, and continue to the matching next route without being redirected through unrelated pages.

- [X] T008 [US1] Route primary public discovery calls to action through `client/src/pages/landing.tsx`
- [X] T009 [P] [US1] Refactor `client/src/pages/support.tsx` to load manifest-backed primary and secondary support paths from `/api/navigation/manifest`
- [X] T010 [P] [US1] Align public discovery copy and destination labels in `client/src/pages/therapists.tsx` and `client/src/pages/peer-support.tsx`
- [X] T011 [US1] Update guest navigation in `client/src/components/app-layout.tsx` to promote `/support` as the canonical public start path

## Phase 4: User Story 2 - Returning Users See Only The Actions That Matter For Their Role

**Story Goal**: Give each signed-in role one canonical home destination and one clear set of primary next actions.

**Independent Test Criteria**: A signed-in client, therapist, listener, moderator, or admin lands on the same canonical home route every time and sees only the role-relevant primary and secondary actions for that stage.

- [X] T012 [US2] Replace `homeRouteForRole` and related redirect logic with canonical role-home resolution in `client/src/App.tsx`
- [X] T013 [P] [US2] Extend `GET /api/workflow/overview` to return canonical home, primary actions, and secondary actions in `server/routes.ts`
- [X] T014 [P] [US2] Refactor `client/src/pages/workflow-hub.tsx` to render role-home primary and secondary actions from the updated workflow overview contract
- [X] T015 [P] [US2] Demote or retire duplicate continuation behavior in `client/src/pages/welcome.tsx` so it only appears when it adds value after onboarding
- [X] T016 [US2] Update signed-in navigation labels and primary destinations in `client/src/components/app-layout.tsx`

## Phase 5: User Story 3 - Users Experience One Language At A Time

**Story Goal**: Remove mixed-language system copy from the audited journey and make release readiness measurable per route and language.

**Independent Test Criteria**: On audited routes, Arabic sessions show Arabic system copy only, French sessions show French system copy only, and admin reviewers can see route-level localization audit status before release.

- [X] T017 [US3] Implement localization audit persistence and review actions in `server/storage.ts` and `server/routes.ts`
- [X] T018 [US3] Add audited route, navigation, and governance translation keys in `client/src/lib/i18n.tsx`
- [X] T019 [P] [US3] Replace raw or fallback-driven system copy in `client/src/pages/support.tsx`, `client/src/pages/workflow-hub.tsx`, and `client/src/pages/welcome.tsx`
- [X] T020 [P] [US3] Replace mixed-language journey copy in `client/src/pages/therapists.tsx`, `client/src/pages/peer-support.tsx`, `client/src/pages/self-care.tsx`, and `client/src/components/app-layout.tsx`
- [X] T021 [P] [US3] Build and mount localization audit review UI in `client/src/components/admin/localization-audit-panel.tsx` and `client/src/pages/admin-dashboard.tsx`

## Phase 6: User Story 4 - Product Owners Can Keep The Experience Focused Over Time

**Story Goal**: Give product owners and admins a persistent feature inventory, clear status model, and safe redirect handling so duplication does not return after cleanup.

**Independent Test Criteria**: Admin users can classify audited entries as primary, secondary, experimental, or retired; retired routes resolve to active replacements; and the review criteria for future promotions are visible in the governance UI.

- [X] T022 [US4] Implement feature inventory list, update, and review-criteria persistence in `server/storage.ts` and `server/routes.ts`
- [X] T023 [P] [US4] Build the feature inventory management panel in `client/src/components/admin/feature-inventory-panel.tsx`
- [X] T024 [US4] Mount feature inventory management and review criteria in `client/src/pages/admin-dashboard.tsx`
- [X] T025 [US4] Wire redirect rule resolution into `client/src/App.tsx`, `client/src/lib/navigation.ts`, and `client/src/pages/not-found.tsx`

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T026 Run `npm run check` from `C:\Users\Asus\Documents\GitHub\fisha`
- [X] T027 Run `npm test` from `C:\Users\Asus\Documents\GitHub\fisha`
- [X] T028 Run `npm run build` from `C:\Users\Asus\Documents\GitHub\fisha` and record final manual verification notes in `specs/1-clarify-user-journey/quickstart.md`

## Dependencies

- Complete Phase 1 before Phase 2.
- Complete Phase 2 before starting any user story phase.
- `US1` and `US2` can begin after Phase 2 and form the MVP scope.
- `US3` depends on the canonical public and signed-in journey surfaces defined by `US1` and `US2`.
- `US4` depends on the governance foundation from Phase 2 and should finalize after canonical journey decisions from `US1` and `US2`.
- Phase 7 depends on completion of `US1`, `US2`, `US3`, and `US4`.

## Dependency Graph

- Setup -> Foundational -> US1
- Setup -> Foundational -> US2
- Setup -> Foundational -> US1 -> US3
- Setup -> Foundational -> US2 -> US3
- Setup -> Foundational -> US1 -> US4
- Setup -> Foundational -> US2 -> US4
- US1 -> Phase 7
- US2 -> Phase 7
- US3 -> Phase 7
- US4 -> Phase 7

## Parallel Execution Examples

- `US1`: After `T008`, run `T009` and `T010` in parallel, then finish `T011`.
- `US2`: After `T012`, run `T013`, `T014`, and `T015` in parallel, then finish `T016`.
- `US3`: After `T017` and `T018`, run `T019`, `T020`, and `T021` in parallel.
- `US4`: After `T022`, run `T023` and `T025` in parallel, then finish `T024`.

## Implementation Strategy

1. Deliver the MVP by completing `US1` and `US2` first so public discovery and signed-in role homes become clear before deeper governance tooling.
2. Add `US3` next so the newly consolidated journeys are language-consistent and auditable.
3. Finish with `US4` to make the cleanup sustainable through admin governance, inventory review, and redirect safety.
