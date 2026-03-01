# Feature Specification: Clear User Journey

**Feature Branch**: `1-clarify-user-journey`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "this is my codebase and i want to make clear path and clearer features because now i see alot of features but without real value and duplication and also some english with frensh text , i want to make everything clear for all users"

## Problem Statement

The product currently exposes too many overlapping paths, promotes features with unclear value, and mixes languages within the same experience. Users can see multiple ways to start, several destinations that feel similar, and copy that shifts between English and French. This creates hesitation, weakens trust, and makes it harder for each role to understand what to do next.

## Goals

- Define a clear primary path for each major user role.
- Reduce visible feature duplication and remove low-value distractions from primary journeys.
- Ensure user-facing copy is consistent and understandable in each supported language.
- Make the product easier to understand for first-time and returning users.

## Scope Boundaries

### In Scope

- Public and signed-in navigation for major user roles.
- Role-specific starting points and next-step guidance.
- Audit and consolidation of overlapping user-facing features.
- Standardization of user-facing copy and language behavior.
- Rules for retiring, merging, or hiding low-value features.

### Out of Scope

- Launching entirely new services or user roles.
- Rewriting internal operational tools that are not user-facing.
- Deep technical refactors that do not improve user clarity.
- Visual redesign work that does not support clearer navigation, language, or feature understanding.

## User Scenarios & Testing

### User Story 1 - First-time visitor chooses the right path quickly

As a first-time visitor, I want to understand the main ways the platform can help me so that I can choose the path that fits my need without reading through duplicate or confusing options.

#### Acceptance Criteria

1. Given a first-time visitor lands on the product, when they view the primary entry experience, then they see a small set of distinct support paths with plain-language explanations of who each path is for.
2. Given two features solve the same core need, when the visitor is choosing where to go, then only one primary option is promoted and the other is either merged, hidden, or clearly marked as secondary.
3. Given the visitor selects a path, when they continue, then the next step matches that choice and does not redirect them through unrelated features first.

### User Story 2 - Returning users see only the actions that matter for their role

As a signed-in user, I want my home experience to highlight my role-specific next steps so that I can continue my journey without sorting through irrelevant or duplicated features.

#### Acceptance Criteria

1. Given a signed-in client, therapist, listener, moderator, or admin opens their main landing area, when the page loads, then the page shows a clear summary of their most important next actions.
2. Given a role has one primary home destination, when the user signs in or returns later, then they are guided to that destination consistently from navigation, onboarding completion, and dashboard shortcuts.
3. Given a feature is not useful for the user's current role or stage, when the user views their main path, then that feature is not promoted as a primary action.

### User Story 3 - Users experience one language at a time

As a user, I want the interface to stay in my selected language so that I can understand navigation, instructions, and actions without mixed-language confusion.

#### Acceptance Criteria

1. Given a user has selected a supported language, when they move through the core product journey, then navigation labels, headings, buttons, helper text, and system messages appear in that language.
2. Given a page contains untranslated or mixed-language system copy before release, when the page is reviewed for launch, then that copy is corrected or replaced with approved fallback text.
3. Given a user changes language, when they continue browsing, then the core journey reflects the new language consistently without leaving mixed-language system text or unintended fallback copy on the same view.

### User Story 4 - Product owners can keep the experience focused over time

As a product owner, I want a clear inventory of user-facing features and their purpose so that low-value duplication does not return after this cleanup.

#### Acceptance Criteria

1. Given the active feature set is reviewed, when the audit is complete, then each user-facing feature is classified as primary, secondary, experimental, or retired.
2. Given a feature remains visible in a primary journey, when it is reviewed, then its user value, audience, and reason for inclusion are documented.
3. Given a feature is retired or merged, when a user reaches its old entry point, then they are redirected or clearly informed where that need is now handled.

## Edge Cases

- A user opens an outdated link to a retired or merged feature.
- A user changes language in the middle of onboarding or another guided flow.
- A returning user has a different role or a partially completed journey than before.
- A secondary feature is still useful for a niche case but should no longer compete with the primary path.
- A newly added page has incomplete translation coverage before release.

## Functional Requirements

- **FR-001**: The product shall define one primary starting path for each major user role and stage covered by this feature.
- **FR-002**: The product shall present a distinct purpose statement for each primary path so users can understand when to choose it.
- **FR-003**: The product shall identify and review all user-facing features that currently appear in public navigation, onboarding, dashboards, settings, or guided workflows.
- **FR-004**: The product shall classify each reviewed feature as primary, secondary, experimental, or retired.
- **FR-005**: The product shall not promote more than one primary feature entry for the same core user goal within the same surface.
- **FR-006**: The product shall consolidate, hide, or retire overlapping feature entries that create duplicated user choices.
- **FR-007**: The product shall provide one consistent primary home destination per major signed-in role.
- **FR-008**: The product shall ensure that primary navigation labels and destination names use consistent terminology across all user-facing surfaces.
- **FR-009**: The product shall support a single-language experience across the audited user journey for each selected language.
- **FR-010**: The product shall remove mixed-language system copy from the audited user journey unless the text is a proper noun or user-generated content.
- **FR-011**: The product shall ensure that headings, buttons, helper text, empty states, and error messages in the audited journey are available in the selected supported language before release.
- **FR-012**: The product shall provide approved fallback text for any user-facing string that is not yet fully localized so incomplete copy is not exposed as mixed-language system text.
- **FR-013**: The product shall define which features remain visible in primary navigation versus secondary or contextual locations.
- **FR-014**: The product shall preserve access to still-valid user needs when features are merged or retired through clear redirects, replacement guidance, or updated labels.
- **FR-015**: The product shall document the owner, audience, user value, and status of each audited user-facing feature.
- **FR-016**: The product shall include review criteria for adding or promoting future features so new duplication is prevented.
- **FR-017**: The product shall cover the end-to-end journeys for discovery, choosing support, onboarding, role home, and ongoing task continuation within the audit scope.

## Key Entities

- **User Role**: The user grouping that determines the most relevant journey and home destination, such as visitor, client, therapist, listener, moderator, or admin.
- **Journey Path**: A guided route that helps a user move from a starting point to a meaningful next step.
- **Feature Entry**: A visible navigation item, shortcut, card, call to action, or page that invites the user into a capability.
- **Feature Inventory Record**: A record of a user-facing capability, including purpose, audience, status, owner, and whether it belongs in a primary journey.
- **Language Surface**: Any user-facing text area that must reflect the selected language consistently.

## Assumptions

- The current supported end-user languages are French and Arabic, and English system copy should not appear in end-user flows unless intentionally approved later.
- The existing major roles remain in place and need clearer paths rather than replacement.
- The cleanup should prioritize the most visible public and authenticated journeys first, then secondary surfaces.
- Some specialized operational tools may remain available to authorized roles without appearing in the main user journey.

## Dependencies

- Product or business owners must approve the final feature inventory and retirement decisions.
- Copy review must be available for each supported language in scope.
- Existing user journeys must be mapped before retirement decisions are finalized so valid user needs are not lost.

## Success Criteria

- **SC-001**: In moderated usability testing, at least 90% of first-time visitors can choose the correct support path in 60 seconds or less.
- **SC-002**: At least 85% of users in each major signed-in role can reach their primary next task from their role home in three actions or fewer.
- **SC-003**: 100% of user-facing screens in the audited release scope are classified in the feature inventory with a documented status and purpose.
- **SC-004**: 100% of audited release-scope screens present system copy in one approved language per session, with no unintended mixed-language system text.
- **SC-005**: The audited primary navigation contains zero duplicated primary entries for the same user goal on the same surface.
- **SC-006**: In post-release usability review, fewer than 10% of participants report uncertainty about where to start or what the main next action is.
