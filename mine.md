# Three-Tier User Role System — Comprehensive Implementation Plan

Extend Shifa's existing mental wellness platform with a clearly defined three-tier user role system (Regular Listener → Graduated Doctor → Premium Doctor), enhanced booking/payment, doctor landing pages, and creative value-add features — leveraging what's already built.

---

## Current State Summary

**Already built** (reusable):
- Supabase Auth + JWT + RBAC middleware (`requireRoles`) with roles: `client`, `therapist`, `listener`, `moderator`, `admin`
- Listener application + admin approval flow (`listener_applications`, `listener_profiles` tables, admin-listeners page)
- Therapist tiers: `student` (capped at 20 TND) / `professional` (free pricing) — **migration 008**
- Payment gateways: Flouci + Konnect (Tunisian TND)
- Therapist slots + appointments with `meet_link` field
- Therapist landing page builder (`/p/:slug`, `landing_page_sections`, `LandingSection` types)
- Therapist document verification workflow (migration 013)
- Session summaries with therapist notes, key topics, homework (migration 018)
- Admin dashboard with analytics, verification review, user management, content flags
- E2E encrypted messaging, peer sessions, crisis detection

**Key gaps vs. your requirements:**
1. No **qualification test** for listener applicants
2. Tier naming is confusing (`student` ≠ graduated doctor semantically)
3. No **Google Meet API** integration (only manual link field)
4. Landing page builder exists but needs richer customization for both doctor tiers
5. No **consultation prep form** or **post-meeting workflow**
6. Admin dashboard lacks dedicated **listener/doctor validation pipeline** views

---

## Phase 1: Tier Renaming & Schema Evolution

**Goal:** Align the DB model with the three-tier system.

### 1a. Rename therapist tiers
- New migration `019_tier_rename.sql`:
  - `student` → `graduated_doctor`
  - `professional` → `premium_doctor`
  - Add badge columns: `badge_type VARCHAR(30)` with values `verified` / `premium`
  - Update check constraint on `therapist_profiles.tier`
  - Update `app_config` key: `graduated_doctor_cap_dinar` = `20`
- Update `shared/schema.ts`: `TherapistTier = "graduated_doctor" | "premium_doctor"`
- Update server `routes.ts` + `storage.ts`: all references to `student` → `graduated_doctor`, `professional` → `premium_doctor`
- Update client pages: `therapist-dashboard.tsx`, `therapists.tsx`, `therapist-profile.tsx`, `admin-dashboard.tsx`

### 1b. New table: `listener_qualification_tests`
```sql
CREATE TABLE listener_qualification_tests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  answers JSONB NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)  -- one attempt per user (can be relaxed later)
);
```
- RLS: users read own, admins read all
- Qualification test questions stored as seed data or in `app_config`

### 1c. Extend `therapist_profiles` for richer landing pages
```sql
ALTER TABLE therapist_profiles
  ADD COLUMN IF NOT EXISTS custom_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_css JSONB,           -- safe style overrides
  ADD COLUMN IF NOT EXISTS gallery_images TEXT[],
  ADD COLUMN IF NOT EXISTS certifications JSONB,       -- [{name, issuer, year, url}]
  ADD COLUMN IF NOT EXISTS consultation_intro TEXT;     -- shown pre-booking
```

**Files touched:** new migration SQL, `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`

---

## Phase 2: Listener Qualification Test & Application Flow

**Goal:** Tier 1 users (regular clients) can take a test and apply to become active listeners.

### 2a. Qualification test API
- `POST /api/listener/qualification-test` — submit answers, auto-score, return pass/fail
- Test content: 10–15 scenario-based questions on active listening, empathy, boundaries, crisis escalation
- Passing threshold configurable via `app_config` (default: 70%)

### 2b. Updated listener application flow
- User must pass qualification test **before** submitting a listener application
- `POST /api/listener/apply` — now validates `listener_qualification_tests.passed = true`
- Admin reviews application + test score in `/admin/listeners`

### 2c. Frontend
- New page `/listener/test` — interactive multi-step quiz with progress bar
- Update `/listener/apply` to require passed test (show "Take Test First" CTA if not passed)
- Admin listeners page: show test score alongside application

**Files touched:** `server/routes.ts`, new `listener-test.tsx` page, `listener-apply.tsx`, `admin-listeners.tsx`

---

## Phase 3: Google Meet Integration

**Goal:** Graduated doctors offer 20 TND sessions; premium doctors set their own prices. All via Google Meet.

### 3a. Google Calendar API integration
- New `server/google-meet.ts` module
- OAuth2 flow: doctors connect their Google account once (store refresh token encrypted in `therapist_google_tokens` table)
- `createGoogleMeetEvent(therapistId, clientId, scheduledAt, durationMinutes)` → returns `meetLink`
- Auto-populates `appointments.meet_link` and `therapist_slots.meet_link`

### 3b. New table: `therapist_google_tokens`
```sql
CREATE TABLE therapist_google_tokens (
  therapist_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3c. Booking flow update
- When client books a slot → server creates Google Meet event → stores link → sends confirmation email with link
- Graduated doctor slots: price locked at 20 TND (enforced by existing DB trigger, updated for new tier name)
- Premium doctor slots: price set freely by doctor

### 3d. Frontend
- Therapist dashboard: "Connect Google Account" button + OAuth popup
- Booking confirmation shows Google Meet link
- Appointment card shows "Join Meeting" button when within 15min of scheduled time

**Files touched:** new `server/google-meet.ts`, new migration, `server/routes.ts`, `therapist-dashboard.tsx`, `appointments.tsx`

---

## Phase 4: Enhanced Payment System

**Goal:** Secure payment for Google Meet sessions with Tunisian payment gateways.

### 4a. Payment flow
- Existing Flouci + Konnect integrations handle TND payments
- Update `POST /api/payments/initiate` to:
  - Validate slot price matches tier cap for graduated doctors
  - Create `payment_transactions` record
  - Redirect to payment gateway
- Webhook confirms payment → updates appointment status to `confirmed` → triggers Google Meet creation

### 4b. Doctor payout tracking (new table)
```sql
CREATE TABLE doctor_payouts (
  id SERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_amount_dinar REAL NOT NULL DEFAULT 0,
  platform_fee_dinar REAL NOT NULL DEFAULT 0,
  net_amount_dinar REAL NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4c. Frontend
- `payment-dialog.tsx` already exists — extend with tier-aware pricing display
- Add payment history for doctors in therapist-dashboard
- Admin dashboard: revenue reports per doctor tier

**Files touched:** `server/routes.ts`, `payment-dialog.tsx`, new migration, `therapist-dashboard.tsx`, `admin-dashboard.tsx`

---

## Phase 5: Doctor Landing Page Customization

**Goal:** Both graduated and premium doctors can fully personalize their landing pages.

### 5a. Enhanced landing page builder
- Extend existing `LandingSection` type with new section types:
  - `"banner"` — custom hero banner image
  - `"gallery"` — photo gallery carousel
  - `"certifications"` — education & certificates showcase
  - `"pricing"` — service pricing table
  - `"booking_calendar"` — inline slot calendar
  - `"contact_form"` — lead capture form
- Drag-and-drop section reordering (already partially in `landing-page-builder.tsx`)
- Premium doctors get additional `"custom_text"` sections (unlimited) + custom color theming

### 5b. Style customization
- Color palette picker (primary color, accent color) → stored as `custom_css` JSONB
- Font selection from curated list
- Applied via CSS variables on `/p/:slug` page

### 5c. Frontend
- Expand `landing-page-builder.tsx` with new section editors
- `/p/:slug` renders sections dynamically with custom styling
- Preview mode in therapist dashboard

**Files touched:** `shared/schema.ts`, `landing-page-builder.tsx`, `therapist-landing.tsx`, `therapist-dashboard.tsx`

---

## Phase 6: Post-Session Features (Creative Value-Adds)

**Goal:** Add features that enhance the doctor-client relationship after sessions.

### 6a. Enhanced session notes (extends existing `session_summaries`)
- **Client mood rating** post-session: quick 1–5 emoji scale
- **Homework assignments**: doctor assigns tasks, client marks completion
- **Follow-up reminders**: auto-schedule reminder notification 24h before next session
- **Session tags**: categorize sessions (e.g., "anxiety", "grief", "relationship") for trend analysis

### 6b. New table: `session_homework`
```sql
CREATE TABLE session_homework (
  id SERIAL PRIMARY KEY,
  summary_id INTEGER NOT NULL REFERENCES session_summaries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  client_notes TEXT
);
```

### 6c. New table: `session_mood_ratings`
```sql
CREATE TABLE session_mood_ratings (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id),
  pre_session_mood INTEGER CHECK (pre_session_mood BETWEEN 1 AND 5),
  post_session_mood INTEGER CHECK (post_session_mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6d. Client progress snapshot (for doctors)
- Doctor sees a client summary card before each session:
  - Mood trend (last 5 entries)
  - Homework completion rate
  - Session history timeline
  - Active treatment goals

### 6e. Consultation prep form
- Before a booked session, client fills a brief "What's on your mind?" form
- Doctor sees it before the call starts
- New table: `consultation_prep`

### 6f. AI-powered session insights (leverages existing OpenAI integration)
- After session notes are saved, optionally generate:
  - Suggested follow-up topics
  - Recommended resources from the `resources` table
  - Progress summary for the client's treatment goals

**Files touched:** new migration, `server/routes.ts`, `server/storage.ts`, new `session-notes.tsx` component, `appointments.tsx`, `progress.tsx`

---

## Phase 7: Admin Dashboard Enhancements

**Goal:** Comprehensive admin tools for managing the three tiers.

### 7a. Listener management
- View all qualification test results
- Approve/reject listener applications with test score context
- Listener activity metrics (sessions completed, avg rating, reports)

### 7b. Doctor management
- Verification pipeline: review documents → approve/reject → assign tier
- Tier upgrade requests: graduated → premium (doctor applies, admin reviews portfolio)
- Revenue per doctor, session completion rate, client satisfaction

### 7c. Platform analytics
- User funnel: signup → onboarding → first session
- Revenue breakdown by tier
- Active doctors heatmap (availability coverage)
- Flagged content / reports overview (existing)

### 7d. New table: `tier_upgrade_requests`
```sql
CREATE TABLE tier_upgrade_requests (
  id SERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES profiles(id),
  current_tier VARCHAR(20) NOT NULL,
  requested_tier VARCHAR(20) NOT NULL,
  portfolio_url TEXT,
  justification TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Files touched:** `admin-dashboard.tsx`, `admin-listeners.tsx`, new migration, `server/routes.ts`

---

## Phase 8: Security Hardening

### 8a. RBAC enforcement audit
- Verify every API endpoint has proper `requireRoles()` or ownership check
- Ensure RLS policies cover all new tables
- Add rate limiting to payment and booking endpoints

### 8b. Google OAuth token security
- Encrypt tokens at rest using `AES-256-GCM` with server-side key
- Rotate refresh tokens on use
- Revoke on doctor account deletion

### 8c. Payment security
- Webhook HMAC verification (already exists for Flouci/Konnect)
- Idempotency keys for payment initiation
- Double-charge prevention: check for existing pending payment before creating new one

### 8d. Landing page safety
- Sanitize `custom_css` to prevent XSS (whitelist allowed CSS properties)
- Validate/sanitize `custom_text` content sections
- Image upload validation (file type, size limits)

---

## Database Schema Diagram (New/Modified Tables)

```
profiles (existing)
  ├── listener_qualification_tests (NEW)
  ├── listener_profiles (existing)
  ├── listener_applications (existing)
  ├── therapist_profiles (MODIFIED: tier rename, new columns)
  │   ├── therapist_verifications (existing)
  │   ├── therapist_slots (existing)
  │   └── therapist_google_tokens (NEW)
  ├── appointments (existing)
  │   ├── session_summaries (existing)
  │   │   └── session_homework (NEW)
  │   ├── session_mood_ratings (NEW)
  │   └── consultation_prep (NEW)
  ├── payment_transactions (existing)
  ├── doctor_payouts (NEW)
  └── tier_upgrade_requests (NEW)
```

---

## API Architecture (New Endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/listener/qualification-test` | client | Submit test answers |
| GET | `/api/listener/qualification-test` | client | Get own test result |
| GET | `/api/admin/qualification-tests` | admin | List all test results |
| POST | `/api/doctor/google/connect` | therapist | Start Google OAuth |
| GET | `/api/doctor/google/callback` | therapist | OAuth callback |
| DELETE | `/api/doctor/google/disconnect` | therapist | Revoke Google access |
| POST | `/api/appointments/:id/prep` | client | Submit consultation prep |
| GET | `/api/appointments/:id/prep` | therapist/client | Get consultation prep |
| POST | `/api/appointments/:id/mood-rating` | client | Submit post-session mood |
| POST | `/api/session-summaries/:id/homework` | therapist | Add homework item |
| PATCH | `/api/homework/:id` | client | Mark homework complete |
| POST | `/api/doctor/tier-upgrade` | therapist | Request tier upgrade |
| GET | `/api/admin/tier-upgrades` | admin | List upgrade requests |
| PATCH | `/api/admin/tier-upgrades/:id` | admin | Approve/reject upgrade |
| GET | `/api/admin/doctor-payouts` | admin | List payout summaries |
| POST | `/api/session-summaries/:id/ai-insights` | therapist | Generate AI insights |

---

## Frontend Component Structure (New/Modified)

```
pages/
  listener-test.tsx          (NEW — qualification quiz)
  listener-apply.tsx         (MODIFIED — require test pass)
  therapist-dashboard.tsx    (MODIFIED — Google connect, payouts, enhanced notes)
  therapist-landing.tsx      (MODIFIED — richer sections, custom styling)
  appointments.tsx           (MODIFIED — prep form, mood rating, join meeting)
  progress.tsx               (MODIFIED — homework tracking, session mood trend)
  admin-dashboard.tsx        (MODIFIED — tier management, upgrade requests, payouts)
  admin-listeners.tsx        (MODIFIED — test scores, enhanced review)

components/
  landing-page-builder.tsx   (MODIFIED — new section types, style editor)
  payment-dialog.tsx         (MODIFIED — tier-aware pricing)
  session-notes.tsx          (NEW — post-session note editor with homework)
  consultation-prep.tsx      (NEW — pre-session form for clients)
  client-snapshot.tsx        (NEW — doctor's pre-session client summary)
  qualification-quiz.tsx     (NEW — reusable quiz component)
  tier-badge.tsx             (NEW — verified/premium badge component)
  google-connect.tsx         (NEW — Google OAuth button + status)
```

---

## User Flows

### Flow 1: Client → Listener
1. Client registers → completes onboarding
2. Navigates to `/listener/test` → takes qualification quiz (10–15 questions)
3. If passed → redirected to `/listener/apply` with pre-filled data
4. Submits application (motivation, experience, hours)
5. Admin reviews in `/admin/listeners` (sees test score + application)
6. Admin approves → user role changes to `listener` → notification sent

### Flow 2: Doctor → Graduated Doctor Tier
1. Therapist registers with role `therapist`
2. Submits verification documents (license, diploma)
3. Admin reviews documents + assigns `graduated_doctor` tier
4. Doctor connects Google account → gets verified badge
5. Doctor creates slots at 20 TND (enforced) → publishes landing page
6. Client books slot → pays 20 TND → Google Meet created → email sent

### Flow 3: Graduated → Premium Doctor Upgrade
1. Graduated doctor submits tier upgrade request with portfolio
2. Admin reviews request + performance metrics
3. Admin approves → tier changes to `premium_doctor` → premium badge
4. Doctor can now set custom prices + access advanced landing page features

### Flow 4: Session Lifecycle
1. Client fills consultation prep form before session
2. Doctor reviews client snapshot (mood trend, homework, goals)
3. Session via Google Meet
4. Doctor writes session notes (key topics, homework, observations)
5. AI suggests follow-up topics + resources (optional)
6. Client rates post-session mood + marks homework as done over time
7. Progress visible in client's `/progress` page

---

## Implementation Order

| # | Phase | Estimated Effort | Dependencies |
|---|-------|-----------------|--------------|
| 1 | Tier rename + schema | 1–2 days | None |
| 2 | Qualification test | 2–3 days | Phase 1 |
| 3 | Google Meet integration | 3–4 days | Phase 1 |
| 4 | Payment enhancements | 2 days | Phase 3 |
| 5 | Landing page customization | 3 days | Phase 1 |
| 6 | Post-session features | 3–4 days | Phase 3 |
| 7 | Admin dashboard | 2–3 days | Phases 1–6 |
| 8 | Security hardening | 2 days | All phases |

**Total: ~18–21 days of focused work**

---

## Environment Variables Needed

```
# Google OAuth (new)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Token encryption (new)
TOKEN_ENCRYPTION_KEY=          # 32-byte hex for AES-256-GCM

# Existing (verify configured)
FLOUCI_APP_TOKEN=
FLOUCI_APP_SECRET=
KONNECT_API_KEY=
KONNECT_WALLET_ID=
OPENAI_API_KEY=
```
