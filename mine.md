# Shifa (شفاء) — Software Architecture & UX Design Remediation Plan

Comprehensive remediation plan for transforming the existing Shifa mental health platform into a production-ready, culturally-aware Tunisian marketplace with three user roles, professional landing pages, enhanced booking/payment, matching, and admin oversight — building on the substantial existing codebase (23 migrations, 35 pages, full E2E encryption, Flouci/Konnect payments, AI matching).

---

## 1. Current State Audit

### What's Already Built (Reusable)
- **Auth**: Supabase Auth + JWT + RBAC middleware (`requireRoles`) with roles: `client`, `therapist`, `listener`, `moderator`, `admin`
- **Tiers**: `graduated_doctor` / `premium_doctor` (migration 019), badge system, tier cap enforcement
- **Payments**: Flouci + Konnect (TND), `payment_transactions`, webhook HMAC verification
- **Matching**: Two-stage hybrid pipeline (deterministic scoring + OpenAI refinement) in `server/matching.ts`
- **Landing pages**: `/p/:slug` with `landing_page_sections`, builder UI, CTA fields
- **Verification**: `therapist_verifications` table, document upload + admin review (migration 013)
- **Messaging**: E2E encrypted therapy conversations + peer messages via Supabase Realtime
- **Peer support**: Listener applications, qualification test, queue, sessions, feedback, reports
- **Progress tracking**: Treatment goals, session summaries, homework, mood ratings (migrations 018, 022)
- **Admin**: Dashboard with analytics, verification review, user management, content flags, listener management
- **Google Meet**: OAuth token storage + event creation in `server/google-meet.ts` (migration 020)
- **Payout tracking**: `doctor_payouts` table (migration 021)
- **Tier upgrades**: `tier_upgrade_requests` table (migration 023)
- **i18n**: Arabic/French/Darija support in `client/src/lib/i18n.tsx`
- **Mobile**: Capacitor config for Android/iOS
- **Security**: RLS policies, rate limiting, audit log, content moderation

### Identified Gaps & Remediation Targets

| # | Gap | Severity | Remediation |
|---|-----|----------|-------------|
| G1 | Anonymous display name uniqueness not enforced at DB level | High | Add unique index + server-side collision check |
| G2 | No subscription/bundle payment model (only per-session) | Medium | Add `subscription_plans` + `user_subscriptions` tables |
| G3 | Landing page builder missing key section types (pricing table, inline booking calendar, testimonials widget) | Medium | Extend `LandingSection` type + new editor components |
| G4 | Matching algorithm doesn't factor in client onboarding `primaryConcerns` structured data | Medium | Wire onboarding response into match pipeline |
| G5 | No client-to-professional matching preferences persistence | Medium | Add `matching_preferences` table |
| G6 | Admin dashboard lacks revenue analytics breakdown by tier/period | Medium | New analytics API endpoints + Recharts views |
| G7 | No email notification templates for key workflows (booking confirm, session reminder, payment receipt) | Medium | Extend `server/email.ts` with templates |
| G8 | Professional verification workflow lacks SLA tracking | Low | Add `sla_deadline` to verification table |
| G9 | No rate-limit on sensitive mutation endpoints (booking, payment) | High | Apply `express-rate-limit` middleware to critical routes |
| G10 | Missing CSRF protection for state-changing POST endpoints | High | Add CSRF token middleware |
| G11 | `custom_css` JSONB on therapist profiles not sanitized | High | Whitelist CSS properties before persistence |
| G12 | No structured error boundary / offline fallback in client | Medium | Add React error boundary + service worker |
| G13 | Peer support and therapist booking UX are separate disconnected flows | Low | Unified "Get Help" entry point |

---

## 2. Architecture Remediation

### 2.1 Database Schema Changes

#### New Tables

```sql
-- Subscription plans (per-session remains default; this adds bundle/subscription option)
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  name_fr VARCHAR(100),
  description TEXT,
  sessions_included INTEGER NOT NULL,       -- e.g. 4 sessions/month
  price_dinar REAL NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  tier_restriction VARCHAR(30),             -- NULL = any, or 'graduated_doctor'/'premium_doctor'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  therapist_id UUID REFERENCES profiles(id), -- NULL = platform-wide, or locked to one therapist
  sessions_remaining INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'active',      -- active, expired, cancelled
  payment_transaction_id INTEGER REFERENCES payment_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Persistent matching preferences (extends onboarding_responses)
CREATE TABLE matching_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_specializations TEXT[],
  preferred_languages TEXT[],
  preferred_gender VARCHAR(20),
  max_budget_dinar REAL,
  session_type_preference VARCHAR(20),      -- online, in_person, any
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Schema Modifications

```sql
-- G1: Enforce unique anonymous display names
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name_unique
  ON profiles (LOWER(display_name)) WHERE display_name IS NOT NULL;

-- G8: Add SLA tracking to verification
ALTER TABLE therapist_verifications
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

-- Extend landing_page_sections with new section types
-- (No schema change needed — sections are JSONB; types enforced in app layer)
```

#### RLS Policies for New Tables

```sql
-- subscription_plans: public read, admin write
-- user_subscriptions: user reads own, admin reads all
-- matching_preferences: user reads/writes own
```

### 2.2 API Endpoint Remediation

#### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/subscription-plans` | public | List active subscription plans |
| POST | `/api/subscriptions` | client | Purchase a subscription (initiates payment) |
| GET | `/api/subscriptions/mine` | client | Get user's active subscriptions |
| POST | `/api/subscriptions/:id/cancel` | client | Cancel subscription |
| GET | `/api/matching/preferences` | client | Get saved matching preferences |
| PUT | `/api/matching/preferences` | client | Update matching preferences |
| POST | `/api/matching/recommend` | client | Get recommendations (uses saved prefs + onboarding) |
| GET | `/api/admin/analytics/revenue` | admin | Revenue breakdown by tier, period, gateway |
| GET | `/api/admin/analytics/funnel` | admin | User funnel: signup → onboarding → first session |
| GET | `/api/admin/verifications/sla` | admin | Verifications approaching/past SLA deadline |

#### Existing Endpoint Fixes

- **`POST /api/user/profile`** — Add server-side uniqueness check for `displayName` (case-insensitive) before update; return 409 on collision
- **`POST /api/payments/initiate`** — Add idempotency key header support; check for existing pending payment before creating new one
- **`POST /api/therapist-slots`** — Validate `priceDinar` against tier cap for `graduated_doctor` (20 TND) server-side, not just DB trigger
- **`GET /api/therapists`** — Add query params: `specialization`, `language`, `minRating`, `maxPrice`, `hasAvailability` for filtering

### 2.3 Frontend Component Remediation

#### New Components

```
components/
  subscription-dialog.tsx          — Plan selection + purchase flow
  matching-preferences-form.tsx    — Persistent preference editor
  unified-help-entry.tsx           — "Get Help" button → peer support OR therapist booking
  error-boundary.tsx               — Global React error boundary with friendly fallback
  landing-sections/
    pricing-table-section.tsx      — Therapist landing: service packages display
    booking-calendar-section.tsx   — Inline availability calendar (reuses slot-calendar.tsx)
    testimonials-section.tsx       — Client testimonials carousel
    video-intro-section.tsx        — Embedded video introduction
```

#### Modified Components

- **`landing-page-builder.tsx`** — Add section type editors for `pricing`, `booking_calendar`, `testimonials`, `video_intro`; add live preview mode toggle
- **`payment-dialog.tsx`** — Add subscription purchase option alongside per-session; show tier badge + pricing context
- **`slot-calendar.tsx`** — Add embeddable mode (for landing page sections) with reduced chrome
- **`app-layout.tsx`** — Add global error boundary wrapper; add offline indicator

#### Modified Pages

- **`therapists.tsx`** — Add advanced filter sidebar (specialization, language, price range, availability, gender); wire into `/api/therapists` query params
- **`therapist-profile.tsx`** — Show subscription plans offered by this therapist; improve mobile layout
- **`admin-dashboard.tsx`** — Add revenue analytics tab with Recharts (line chart: revenue over time by tier; pie chart: gateway split); add SLA-tracking verification queue
- **`settings.tsx`** — Add matching preferences section; display name uniqueness validation with live availability check
- **`dashboard.tsx`** — Add unified "Get Help" CTA card; show active subscription status

### 2.4 State Management Remediation

Current approach (React Query + Supabase Realtime) is sound. Specific fixes:

- **Optimistic updates** for subscription purchase flow (show pending state immediately)
- **Query key normalization** — ensure all therapist list queries use consistent key prefix `["/api/therapists", filters]` for proper invalidation
- **Realtime subscription management** — add cleanup for Supabase channel subscriptions in `useEffect` return (audit all pages using `postgres_changes`)
- **Auth state race condition** — `PublicOnlyRoute` uses `window.location.href` for redirects; replace with wouter `useLocation` to avoid full page reloads

---

## 3. UX Design Remediation

### 3.1 Cultural & Accessibility Considerations

| Principle | Implementation |
|-----------|---------------|
| **RTL-first** | Ensure all layouts use logical CSS properties (`margin-inline-start` not `margin-left`); test with Arabic as primary language |
| **Language hierarchy** | Arabic (Tunisian dialect) → French → English; all UI strings must exist in Arabic first |
| **Trust signals** | Prominent verified badges, license numbers, university names; "Approved by Shifa" seal on verified professionals |
| **Privacy-first defaults** | Anonymous display name shown by default; real name only visible to admin; reviews default to anonymous |
| **Color palette** | Calming teal/green primary (already exists), warm neutrals; avoid clinical white — use soft cream/off-white backgrounds |
| **Typography** | Arabic: Noto Sans Arabic or Cairo; French/English: Inter or system font; minimum 16px body text for readability |
| **Imagery** | Use illustrations over stock photos; culturally relevant imagery (Tunisian architectural motifs, Mediterranean palette); avoid Western clinical imagery |
| **Accessibility** | WCAG 2.1 AA minimum; focus indicators on all interactive elements; screen reader labels in Arabic |
| **Low-bandwidth** | Lazy load images; skeleton screens instead of spinners; service worker for offline-capable resource pages |

### 3.2 Key UX Workflow Improvements

#### A. Unified "Get Help" Flow
```
User clicks "Get Help" →
  ├─ "Talk to someone now" → Peer listener queue (free)
  ├─ "Book a session" → Therapist marketplace with matching
  └─ "I'm in crisis" → Crisis resources + hotline (existing)
```

#### B. Improved Therapist Discovery
```
Therapists page redesign:
  1. Smart recommendation banner (top 3 AI-matched, based on saved preferences)
  2. Filter bar: specialization chips, language toggle, price slider, availability toggle
  3. Card grid: photo, name, badge, headline, rate, rating, "Book" CTA
  4. Map view toggle (for in-person, using Tunisian governorate data)
```

#### C. Professional Landing Page Builder (Enhanced)
```
Builder sections (drag-and-drop reorder):
  ├─ Hero banner (custom image + headline + CTA)
  ├─ About me (rich text)
  ├─ Specializations (tag chips with icons)
  ├─ Education & certifications (timeline layout)
  ├─ Pricing table (per-session + subscription bundles)
  ├─ Availability calendar (inline booking)
  ├─ Testimonials (approved client reviews carousel)
  ├─ Video introduction (embedded player)
  ├─ FAQ (accordion)
  ├─ Contact form (lead capture → in-app message)
  └─ Social links (footer)
  
Customization:
  - Color theme picker (primary + accent)
  - Font selection (from curated Arabic-compatible list)
  - Custom domain/slug: /p/:slug
  - Shareable externally (standalone page, no login required to view)
```

#### D. Appointment Booking Flow (Refined)
```
1. Client selects therapist → views available slots on calendar
2. Selects slot → sees price (20 TND for graduated / custom for premium)
3. Payment options: per-session (Flouci/Konnect) OR use subscription session credit
4. Consultation prep form: "What would you like to discuss?" (optional, shown to therapist before session)
5. Confirmation: email + in-app notification with Google Meet link
6. 24h reminder notification
7. "Join Meeting" button appears 15 min before session
8. Post-session: mood rating → homework assigned by therapist → AI insights (optional)
```

#### E. Admin Verification Pipeline (Enhanced)
```
Admin dashboard → Verifications tab:
  ├─ Queue sorted by SLA deadline (urgent first)
  ├─ Expandable row: documents viewer, license check, education check
  ├─ One-click approve/reject with required notes
  ├─ Auto-assign tier based on document type (diploma → graduated, license → premium eligible)
  ├─ Bulk actions for efficient processing
  └─ SLA metrics: avg review time, % within SLA, backlog count
```

### 3.3 Mobile-First Responsive Strategy

The app already uses Capacitor for Android/iOS. Key responsive improvements:

- **Bottom navigation bar** for authenticated mobile users (Dashboard, Therapists, Messages, Appointments, More)
- **Swipe gestures** for message navigation (swipe right = back to conversation list)
- **Pull-to-refresh** on all list views
- **Touch-optimized calendar** for slot selection (larger tap targets, 48px minimum)
- **Haptic feedback** on key actions (existing `haptics.ts` — extend to booking confirmation, message sent)

---

## 4. Security Remediation

### 4.1 Critical Fixes

| Issue | Fix | Priority |
|-------|-----|----------|
| **G9: Rate limiting** | Apply `express-rate-limit` to: `/api/payments/*` (5/min), `/api/appointments` POST (10/min), `/api/auth/*` (20/min) | P0 |
| **G10: CSRF** | Add CSRF token middleware for all state-changing POST/PATCH/DELETE; exempt webhook endpoints | P0 |
| **G11: CSS injection** | Whitelist `custom_css` keys to: `primaryColor`, `accentColor`, `fontFamily`, `borderRadius` — reject arbitrary CSS strings | P0 |
| **Display name enumeration** | Rate-limit display name availability check endpoint (20/min) | P1 |
| **Webhook HMAC** | Ensure both Flouci and Konnect webhook handlers reject requests with invalid/missing HMAC (already partially implemented — verify coverage) | P1 |
| **Google OAuth tokens** | Verify `therapist_google_tokens.access_token_encrypted` uses AES-256-GCM with env-based key; add token rotation on refresh | P1 |

### 4.2 Health Data Compliance

- **Data minimization**: Only store data necessary for platform function; no raw session transcripts unless explicitly opted in
- **Encryption at rest**: Supabase encrypts storage at rest; E2E encryption for therapy messages (already implemented)
- **Audit logging**: All admin actions on user data logged to `audit_log` table (migration 014 — verify completeness)
- **Data export**: Add `GET /api/user/data-export` endpoint for GDPR-style data portability
- **Account deletion**: Ensure cascading deletes remove all PII; retain anonymized analytics data only
- **Session timeout**: Auto-logout after 30 min of inactivity for therapist/admin roles

### 4.3 Scalability Considerations

- **Database indexing**: Add composite indexes on `therapist_slots(therapist_id, status, starts_at)`, `appointments(client_id, status)`, `payment_transactions(client_id, status)`
- **Connection pooling**: Use Supabase connection pooler (PgBouncer) for production
- **CDN for static assets**: Serve therapist profile images, banners via Supabase Storage CDN
- **API response caching**: Cache therapist list (5 min TTL), resource list (15 min TTL) at API level
- **Realtime channel limits**: Monitor Supabase Realtime channel count; implement channel reuse for messaging
- **Background jobs**: Extract email sending, AI insights generation, and Google Meet creation into async job queue (consider BullMQ or Supabase Edge Functions)

---

## 5. Technology Stack Summary

| Layer | Current | Recommendation |
|-------|---------|----------------|
| **Frontend** | React 18 + Vite 7 + Wouter + TanStack Query + Tailwind + Radix UI + Framer Motion | ✅ Keep — modern and performant |
| **Backend** | Express 5 + TypeScript + tsx | ✅ Keep — add structured error handling middleware |
| **Database** | Supabase (Postgres) + RLS | ✅ Keep — add missing indexes per §4.3 |
| **Auth** | Supabase Auth + JWT | ✅ Keep — enforce email verification before booking |
| **Payments** | Flouci + Konnect | ✅ Keep — add subscription model on top |
| **Realtime** | Supabase Realtime (postgres_changes + Presence) | ✅ Keep — audit channel cleanup |
| **AI** | OpenAI (gpt-4o-mini) | ✅ Keep — extend to session insights |
| **Email** | Resend | ✅ Keep — add HTML templates for key flows |
| **Push** | Firebase Cloud Messaging | ✅ Keep — add appointment reminders |
| **Mobile** | Capacitor (Android/iOS) | ✅ Keep — add bottom nav for mobile shell |
| **Monitoring** | None | ❌ Add: Sentry for error tracking, Supabase dashboard for DB metrics |
| **CI/CD** | None visible | ❌ Add: GitHub Actions for lint + typecheck + test on PR |

---

## 6. Implementation Phases

### Phase A: Security & Stability (3-4 days) — **Do First**
1. Add rate limiting to payment/booking/auth endpoints
2. Sanitize `custom_css` with property whitelist
3. Enforce unique display name index at DB level
4. Add missing DB indexes for performance
5. Audit RLS policies on all tables (including new ones from migrations 019-023)
6. Add React error boundary to client

### Phase B: Subscription Model (3-4 days)
1. Create migration for `subscription_plans`, `user_subscriptions`, `matching_preferences`
2. Implement subscription CRUD API endpoints
3. Build subscription dialog component
4. Wire subscription credit deduction into booking flow
5. Add subscription status to client dashboard

### Phase C: Landing Page Builder Enhancement (3-4 days)
1. Add new section type components (pricing table, booking calendar, testimonials, video intro)
2. Extend builder UI with drag-and-drop for new sections
3. Add color theme + font customization
4. Ensure landing pages render correctly standalone (no auth required to view)
5. Sanitize all user-provided content

### Phase D: UX Flow Improvements (4-5 days)
1. Unified "Get Help" entry point on dashboard
2. Therapist discovery page redesign with advanced filters
3. Matching preferences form + persistence
4. Wire onboarding `primaryConcerns` into matching pipeline
5. Appointment booking flow refinement (prep form, subscription credit option)
6. Email notification templates for key workflows

### Phase E: Admin Dashboard Enhancement (3-4 days)
1. Revenue analytics API + Recharts visualizations
2. SLA-tracked verification queue
3. User funnel analytics
4. Subscription management admin view
5. Bulk actions for verification review

### Phase F: Polish & Production Readiness (2-3 days)
1. RTL layout audit and fixes
2. Mobile responsive polish (bottom nav, touch targets)
3. Offline indicator + service worker for resources
4. Data export endpoint
5. Set up Sentry error tracking
6. CI/CD pipeline (GitHub Actions)

**Total estimated effort: ~18-24 days**

---

## 7. Database Schema Diagram (Complete)

```
profiles (existing)
  ├── matching_preferences (NEW)
  ├── user_subscriptions (NEW) ──→ subscription_plans (NEW)
  ├── onboarding_responses (existing)
  ├── listener_qualification_tests (existing, migration 019)
  ├── listener_profiles (existing)
  ├── listener_applications (existing)
  ├── therapist_profiles (existing, enhanced)
  │   ├── therapist_verifications (existing, +sla_deadline)
  │   ├── therapist_slots (existing)
  │   ├── therapist_google_tokens (existing, migration 020)
  │   └── therapist_reviews (existing)
  ├── therapy_conversations (existing, E2E encrypted)
  │   └── therapy_messages (existing)
  ├── appointments (existing)
  │   ├── session_summaries (existing)
  │   │   └── session_homework (existing, migration 022)
  │   ├── session_mood_ratings (existing, migration 022)
  │   └── consultation_prep (existing, migration 022)
  ├── payment_transactions (existing)
  ├── doctor_payouts (existing, migration 021)
  ├── tier_upgrade_requests (existing, migration 023)
  ├── mood_entries (existing)
  ├── journal_entries (existing)
  ├── treatment_goals (existing, migration 018)
  ├── crisis_reports (existing)
  ├── content_flags (existing, migration 017)
  └── audit_log (existing, migration 014)

subscription_plans (NEW, standalone)
```

---

## 8. Key Design Decisions

1. **Per-session remains primary** — subscriptions are additive, not a replacement; graduated doctors always charge 20 TND per session
2. **Anonymous by default** — display names are the primary identifier in all client-facing views; real names only visible to admin and to the therapist after booking
3. **Landing pages are public** — `/p/:slug` renders without auth; this is intentional for external sharing/marketing by professionals
4. **Matching is opt-in** — clients can browse freely or use the AI-powered matching; saved preferences improve recommendations over time
5. **No custom CSS strings** — only structured theme tokens (color, font, border-radius) to prevent XSS; stored as JSONB with validated keys
6. **Graduated → Premium upgrade is admin-gated** — prevents self-promotion; requires portfolio review and performance metrics
