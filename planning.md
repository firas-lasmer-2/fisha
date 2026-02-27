# Shifa Platform — Comprehensive Architecture & UX Remediation Plan

## Context

Shifa is a mental health platform for Tunisia with 5 roles (client, therapist, listener, moderator, admin), 40+ DB tables, 120+ storage methods, and 35 pages. A full codebase audit revealed several critical gaps: Google Calendar routes are implemented but never wired, no slot conflict detection, no appointment reminders, no cancellation workflow, monolithic therapist dashboard (~2000 lines), no seed data for dev, and inconsistent role-based flows. This plan addresses all of these through 8 focused workstreams.

---

## W1: Role Clarity & Onboarding (HIGH)

**Problem**: Signup doesn't differentiate roles clearly. Onboarding is client-only. Listeners/therapists land on generic flows.

### Changes

**`client/src/pages/signup.tsx`**
- Add role selector step (3 cards): "I need support" → client, "I want to help" → listener, "I'm a professional" → therapist
- Pass selected role to `POST /api/auth/signup`

**`client/src/pages/onboarding.tsx`**
- Branch steps by role:
  - **Client**: current 4 steps (display name, concerns, preferences, complete)
  - **Listener**: display name → motivation → redirect to `/listener/test`
  - **Therapist**: display name → credentials upload → redirect to `/therapist-dashboard`

**`client/src/pages/support.tsx`** (already created)
- Already has 3 clear paths (Peer/Graduated/Premium) — no changes needed

### Files
| File | Action |
|------|--------|
| `client/src/pages/signup.tsx` | Add role selector cards |
| `client/src/pages/onboarding.tsx` | Branch by role |

---

## W2: Scheduling & Appointments (HIGH)

**Problem**: No slot overlap detection, no cancel/reschedule, no reminders.

### Changes

**`server/storage.ts`** — Add:
- `hasOverlappingSlot(therapistId, startTime, endTime)` — check before insert
- `cancelAppointment(id, reason, cancelledBy)` — set status + notify
- `rescheduleAppointment(id, newSlotId)` — cancel old + create new

**`server/routes.ts`** — Add:
- `POST /api/appointments/:id/cancel` — with 24h policy check
- `POST /api/appointments/:id/reschedule` — validates new slot availability
- Slot creation: call `hasOverlappingSlot` before insert (currently no check)
- Appointment confirmation: generate video session link (platform's existing video API)

**`client/src/pages/appointments.tsx`** — Add:
- Cancel button (with confirmation dialog) on upcoming appointments
- Reschedule button → opens slot picker for same therapist
- Status badges: `pending` yellow, `confirmed` green, `cancelled` gray, `completed` blue

**Migration 028** — Add:
- `appointments.cancelled_by` (user_id FK, nullable)
- `appointments.cancellation_reason` (text, nullable)
- `appointments.original_appointment_id` (self-FK for reschedules)

### Files
| File | Action |
|------|--------|
| `server/storage.ts` | 3 new methods |
| `server/routes.ts` | 2 new endpoints + slot overlap guard |
| `client/src/pages/appointments.tsx` | Cancel/reschedule UI |
| `supabase/migrations/028_remediation.sql` | New columns |

---

## W3: Dashboard Remediation (HIGH)

**Problem**: Client dashboard recently simplified but needs mood chart + quick actions. Therapist dashboard is monolithic (~2000 lines). Listener/admin dashboards need polish.

### Changes

**`client/src/pages/dashboard.tsx`** (client)
- Current state is good (wellness score, appointments, bento grid, recharts). Minor tweaks:
  - Add unread message count badge on Messages quick-action card
  - Link "Find Support" banner to `/support`

**`client/src/pages/therapist-dashboard.tsx`** — Decompose:
- Extract into 4 components:
  - `client/src/components/therapist/schedule-tab.tsx` (~400 lines)
  - `client/src/components/therapist/clients-tab.tsx` (~300 lines)
  - `client/src/components/therapist/earnings-tab.tsx` (~250 lines)
  - `client/src/components/therapist/landing-tab.tsx` (~350 lines)
- Parent keeps tab navigation + role guard only

**`client/src/pages/listener-dashboard.tsx`** — Enhance:
- Add session history list (reuse existing query)
- Add "hours this week" stat card
- Add link to `/listener/test` for retake

**`client/src/pages/admin-dashboard.tsx`** — Add:
- Search bar for users/therapists (client-side filter on existing data)
- CSV export button for analytics data

### Files
| File | Action |
|------|--------|
| `client/src/pages/dashboard.tsx` | Minor: unread badge on messages card |
| `client/src/pages/therapist-dashboard.tsx` | Decompose into 4 tab components |
| `client/src/components/therapist/` | 4 new files (extracted, not new logic) |
| `client/src/pages/listener-dashboard.tsx` | Add stats + history |
| `client/src/pages/admin-dashboard.tsx` | Add search + export |

---

## W4: Payment & Subscription (MEDIUM)

**Problem**: Webhook idempotency not enforced. Subscription credit deduction has no guard against double-spend. Payout status transitions unchecked.

### Changes

**`server/routes.ts`**
- Webhook endpoints: add idempotency check — store `webhook_event_id` in new `webhook_events` table, skip duplicates
- Subscription booking: wrap credit check + deduction in a Supabase RPC (atomic)
- Payout status: enforce valid transitions (pending→approved→paid, pending→rejected)

**Migration 028** — Add:
- `webhook_events` table (id, event_id UNIQUE, provider, processed_at, payload JSONB)
- RPC `deduct_subscription_credit(user_id, plan_id)` — atomic decrement with check

**`server/storage.ts`**
- `recordWebhookEvent(eventId, provider, payload)` — returns false if duplicate
- `deductSubscriptionCredit(userId)` — calls RPC

### Files
| File | Action |
|------|--------|
| `server/routes.ts` | Idempotency guard on webhooks, atomic credit deduction |
| `server/storage.ts` | 2 new methods |
| `supabase/migrations/028_remediation.sql` | webhook_events table + RPC |

---

## W5: Matching & Discovery (MEDIUM)

**Problem**: Filter state lost on navigation. No "similar therapists" suggestion. AI matching doesn't weight subscription tier.

### Changes

**`client/src/pages/therapists.tsx`**
- Persist filters in URL search params (already partially done with `?tier=`)
- Add `?specialization=`, `?language=`, `?gender=` params
- Read params on mount, write on change

**`client/src/pages/therapist-profile.tsx`**
- Add "Similar Therapists" section at bottom — query `/api/therapists` with same specialization, exclude current, limit 3

**`server/routes.ts`** — `POST /api/ai/match-therapist`
- Add subscription tier bonus: if user has active subscription, boost therapists matching their plan tier by +10

### Files
| File | Action |
|------|--------|
| `client/src/pages/therapists.tsx` | URL param persistence for filters |
| `client/src/pages/therapist-profile.tsx` | Similar therapists section |
| `server/routes.ts` | Subscription-aware matching bonus |

---

## W6: Verification & Trust (MEDIUM)

**Problem**: No SLA enforcement on verification reviews. No public trust badges. Listener test retry has no cooldown.

### Changes

**`server/routes.ts`**
- `GET /api/admin/verifications`: sort by `sla_deadline ASC` (already has column from migration 025)
- Add automated reminder: when verification is >48h pending, flag in admin dashboard

**`client/src/pages/admin-dashboard.tsx`**
- Verifications tab: show SLA countdown badge (green/yellow/red based on deadline proximity)
- Sort overdue items first

**`client/src/pages/therapist-profile.tsx`**
- Show "Verified" badge if therapist has approved verification

**`client/src/pages/listener-test.tsx`**
- Add 24h cooldown check: query last test attempt, disable if <24h ago
- Show countdown timer to next attempt

**`server/routes.ts`**
- `POST /api/listener/test/submit`: check `created_at` of last attempt, reject if <24h

### Files
| File | Action |
|------|--------|
| `server/routes.ts` | SLA sort, listener test cooldown |
| `client/src/pages/admin-dashboard.tsx` | SLA badges |
| `client/src/pages/therapist-profile.tsx` | Verified badge |
| `client/src/pages/listener-test.tsx` | 24h cooldown UI |

---

## W7: Real-time & Notifications (HIGH)

**Problem**: No appointment reminders. Presence has no heartbeat (stale online indicators). No in-app notification center.

### Changes

**Migration 028** — Add:
- `notifications` table (id, user_id, type, title, body, read, data JSONB, created_at)
- RLS: users see only own notifications

**`server/storage.ts`**
- `createNotification(userId, type, title, body, data)`
- `getNotifications(userId, limit, offset)`
- `markNotificationRead(id)`
- `getUnreadNotificationCount(userId)`

**`server/routes.ts`**
- `GET /api/notifications` — paginated
- `PATCH /api/notifications/:id/read`
- `GET /api/notifications/unread-count`
- Appointment creation: create notification for both parties
- Appointment 1h before: scheduled job or Supabase Edge Function (document as TODO — requires cron)

**`client/src/components/notification-bell.tsx`** (new)
- Bell icon in app-layout header
- Dropdown with recent notifications
- Badge with unread count
- Uses Supabase realtime subscription on `notifications` table

**`client/src/components/app-layout.tsx`**
- Add `<NotificationBell />` in header between language switcher and settings

**`client/src/hooks/use-online-therapists.ts`**
- Add heartbeat: send presence update every 30s, mark offline after 60s silence

### Files
| File | Action |
|------|--------|
| `supabase/migrations/028_remediation.sql` | notifications table + RLS |
| `server/storage.ts` | 4 notification methods |
| `server/routes.ts` | 3 notification endpoints + creation hooks |
| `client/src/components/notification-bell.tsx` | New component |
| `client/src/components/app-layout.tsx` | Add bell to header |
| `client/src/hooks/use-online-therapists.ts` | Heartbeat interval |

---

## W8: Admin & Dev Tooling (MEDIUM)

**Problem**: No seed data for development. No content moderation escalation. Admin search limited.

### Changes

**`supabase/seed.sql`** (update existing file)
- 3 test therapists (1 graduated, 2 premium) with profiles, slots, verifications
- 5 test clients with mood entries, journal entries, appointments
- 2 test listeners with completed qualifications
- 1 admin user
- Sample subscription plans (already seeded in migration 025, verify)

**`server/routes.ts`**
- `POST /api/admin/users/search` — text search on name/email/display_name
- `GET /api/admin/export/:type` — CSV export for users, appointments, analytics

**`client/src/pages/admin-dashboard.tsx`**
- Add user search input at top of Users tab
- Add export buttons (CSV) on Analytics and Users tabs

### Files
| File | Action |
|------|--------|
| `supabase/seed.sql` | Comprehensive dev seed data |
| `server/routes.ts` | Admin search + export endpoints |
| `client/src/pages/admin-dashboard.tsx` | Search + export UI |

---

## Migration 028 — Combined Schema

All DB changes in a single migration: `supabase/migrations/028_remediation.sql`

```sql
-- Appointment cancellation/reschedule
ALTER TABLE appointments ADD COLUMN cancelled_by UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN original_appointment_id UUID REFERENCES appointments(id);

-- Webhook idempotency
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  payload JSONB
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY webhook_events_service ON webhook_events FOR ALL USING (true);

-- Atomic credit deduction
CREATE OR REPLACE FUNCTION deduct_subscription_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
  UPDATE user_subscriptions
  SET sessions_remaining = sessions_remaining - 1
  WHERE user_id = p_user_id AND sessions_remaining > 0 AND status = 'active'
  RETURNING true;
$$ LANGUAGE sql;
```

---

## Execution Order (5 Sprints)

| Sprint | Workstreams | Rationale |
|--------|-------------|-----------|
| **S1** | W1 (Role Clarity) + W2 (Scheduling) | Foundation — roles and core booking flow |
| **S2** | W7 (Notifications) + W3 (Dashboards) | Notifications needed before dashboard can show them |
| **S3** | W4 (Payments) + W6 (Verification) | Trust & money — builds on working scheduling |
| **S4** | W5 (Matching) + W8 (Admin/Seed) | Discovery improvements + dev tooling |
| **S5** | Polish, i18n audit, e2e tests | All strings translated, test coverage |

### Dependency Graph
```
W1 (Roles) ──→ W3 (Dashboards)
W2 (Scheduling) ──→ W7 (Notifications) ──→ W3 (Dashboards)
W4 (Payments) ──→ W5 (Matching)
W6 (Verification) ── independent
W8 (Seed) ── independent (can start anytime)
```

---

## Verification

1. `npm run check` — 0 TypeScript errors after each workstream
2. `npm run build` — clean production build
3. Manual test: sign up as client → onboarding → dashboard → book appointment → cancel → reschedule
4. Manual test: sign up as listener → test → apply → dashboard
5. Manual test: therapist → create slots → receive booking notification
6. Manual test: admin → verify therapist → check SLA badges → export CSV
7. Notifications: create appointment → both parties see notification bell update
8. Seed data: `psql < supabase/seed.sql` → therapists page shows 3 profiles
