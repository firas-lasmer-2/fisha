# Data Model: Clear User Journey

**Feature**: [spec.md](./spec.md)  
**Research**: [research.md](./research.md)  
**Date**: 2026-02-28

## Overview

The data model supports four responsibilities:

1. define canonical journey paths,
2. classify user-facing feature entries,
3. preserve retired or merged routes safely,
4. audit route-level localization readiness.

## Entity: JourneyPath

Represents one canonical starting point or continuation path for a role and stage.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `key` | string | Yes | Stable identifier such as `client-support-start` |
| `role` | enum | Yes | `visitor`, `client`, `therapist`, `listener`, `moderator`, `admin` |
| `stage` | enum | Yes | `discovery`, `onboarding`, `home`, `continuation` |
| `labelKey` | string | Yes | Translation key for the path label |
| `summaryKey` | string | Yes | Translation key for the path summary |
| `destinationPath` | string | Yes | Canonical route such as `/support` or `/workflow` |
| `audienceDescription` | text | Yes | Human-readable explanation for reviewers |
| `status` | enum | Yes | `draft`, `active`, `retired` |
| `supportsGuest` | boolean | Yes | Whether authentication is required |
| `displayOrder` | integer | Yes | Controls ordering in navigation and review screens |
| `createdAt` | timestamp | Yes | Audit field |
| `updatedAt` | timestamp | Yes | Audit field |

### Validation Rules

- Only one `active` journey path may exist for the same `(role, stage)` pair.
- `destinationPath` must match an allowed route in the application router.
- `labelKey` and `summaryKey` must be present for every supported language before `status = active`.

### State Transitions

- `draft -> active`
- `active -> retired`
- `draft -> retired`

## Entity: FeatureInventoryItem

Represents a visible user-facing entry point, shortcut, card, menu item, or page included in the audit scope.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `featureKey` | string | Yes | Stable identifier such as `support-triage-card` |
| `surface` | enum | Yes | `landing`, `support`, `welcome`, `workflow`, `dashboard`, `nav`, `settings`, `other` |
| `routePath` | string | Yes | Route where the entry is displayed |
| `goalKey` | string | Yes | Canonical user goal such as `choose-support` |
| `roleScope` | string[] | Yes | Allowed roles or `visitor` |
| `status` | enum | Yes | `primary`, `secondary`, `experimental`, `retired` |
| `journeyPathId` | UUID | No | Canonical path this entry supports |
| `replacementRoute` | string | No | Required when retired or merged |
| `duplicateOfItemId` | UUID | No | Links duplicate entries to the kept canonical item |
| `ownerUserId` | UUID | No | Reviewer or product owner |
| `userValueStatement` | text | Yes | Why this entry exists for users |
| `reviewNotes` | text | No | Human review notes |
| `lastReviewedAt` | timestamp | No | Governance timestamp |
| `createdAt` | timestamp | Yes | Audit field |
| `updatedAt` | timestamp | Yes | Audit field |

### Validation Rules

- Only one `primary` item may exist for the same `(surface, goalKey)` pair.
- `replacementRoute` is required when `status = retired`.
- `duplicateOfItemId` cannot point to the same record.
- `journeyPathId` is required when `status = primary`.

### State Transitions

- `experimental -> secondary`
- `secondary -> primary`
- `primary -> secondary`
- `primary|secondary|experimental -> retired`

## Entity: RedirectRule

Represents a route transition for a retired, renamed, or merged feature entry point.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `sourcePath` | string | Yes | Legacy path such as `/welcome` |
| `targetPath` | string | Yes | New canonical destination |
| `reason` | enum | Yes | `retired`, `merged`, `renamed`, `role-home-change` |
| `messageKey` | string | No | Optional translated explanation shown to the user |
| `roleScope` | string[] | No | Optional role restriction |
| `preserveQuery` | boolean | Yes | Whether to carry query params through redirect |
| `status` | enum | Yes | `scheduled`, `active`, `disabled` |
| `startsAt` | timestamp | No | Optional activation time |
| `endsAt` | timestamp | No | Optional sunset time |
| `createdAt` | timestamp | Yes | Audit field |
| `updatedAt` | timestamp | Yes | Audit field |

### Validation Rules

- `sourcePath` must be unique among active rules.
- `sourcePath` and `targetPath` cannot be identical.
- `targetPath` must resolve to a known active route.

### State Transitions

- `scheduled -> active`
- `active -> disabled`
- `scheduled -> disabled`

## Entity: LocalizationAudit

Represents route-level readiness for a given supported language.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `routePath` | string | Yes | Audited route |
| `language` | enum | Yes | `ar`, `fr` |
| `status` | enum | Yes | `pending`, `in_review`, `approved`, `blocked` |
| `untranslatedCount` | integer | Yes | Missing translation-key count |
| `mixedCopyCount` | integer | Yes | Mixed-language system copy count |
| `fallbackCopyCount` | integer | Yes | Raw fallback string count on audited surfaces |
| `reviewedByUserId` | UUID | No | Reviewer |
| `reviewedAt` | timestamp | No | Review timestamp |
| `notes` | text | No | Reviewer notes |
| `createdAt` | timestamp | Yes | Audit field |
| `updatedAt` | timestamp | Yes | Audit field |

### Validation Rules

- `approved` requires `untranslatedCount = 0`, `mixedCopyCount = 0`, and `fallbackCopyCount = 0`.
- Only one active audit record should exist per `(routePath, language)` pair.
- `routePath` must exist in the audited route catalog.

### State Transitions

- `pending -> in_review`
- `in_review -> approved`
- `in_review -> blocked`
- `blocked -> in_review`

## Relationships

- `JourneyPath` 1-to-many `FeatureInventoryItem`
  - One canonical path can have many visible entries across surfaces.
- `FeatureInventoryItem` 0-to-many `RedirectRule`
  - Retired or merged entries can publish one or more redirects.
- `FeatureInventoryItem` 1-to-many `LocalizationAudit`
  - Multiple audited routes can be associated with the same user goal across languages.

## Derived Constraints

- Every `primary` feature inventory item must map to exactly one `active` journey path.
- Every retired inventory item must either:
  - have an `active` redirect rule, or
  - provide a replacement route directly.
- A route cannot be marked release-ready for the feature if its localization audit is not `approved` for each supported language in scope.

## Seed Scope for Initial Rollout

The first seeded inventory should include at least:

- `/`
- `/support`
- `/workflow`
- `/welcome`
- `/therapists`
- `/peer-support`
- `/self-care`
- `/therapist-dashboard`
- `/listener/dashboard`
- `/admin/dashboard`
- `/admin/listeners`
- primary navigation items from [client/src/components/app-layout.tsx](/C:/Users/Asus/Documents/GitHub/fisha/client/src/components/app-layout.tsx)
