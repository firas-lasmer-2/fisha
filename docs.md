# Shifa: Migrate to Supabase + Add MVP Features

## Context

The current Shifa app uses Express + Vite/React + Drizzle ORM on direct PostgreSQL + Replit Auth. The goal is to **replace the database layer with Supabase** (gaining auth, realtime, storage, RLS) while keeping the existing Express + React architecture, then add new Phase 1 MVP features (payments, push notifications, crisis intervention, onboarding, E2E encryption).

---

## Phase 1: Supabase Project Setup + Database Migration

### 1.1 Create Supabase project
- Create project at [supabase.com](https://supabase.com)
- Note: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Add to `.env`: these three + keep existing `OPENAI_API_KEY`

### 1.2 Install Supabase dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 1.3 Create Supabase SQL migration from current Drizzle schema
Source file: `shared/schema.ts` (11 tables, 187 lines)

**Changes from current schema:**
- **Drop `sessions` table** (Express session store) — Supabase Auth handles sessions
- **Rename `users` → `profiles`** — `id uuid references auth.users(id) on delete cascade primary key`
- All FKs referencing `users.id` now reference `profiles(id)`
- Keep all other tables as-is (therapist_profiles, therapist_reviews, therapy_conversations, therapy_messages, appointments, mood_entries, journal_entries, resources)
- Drop AI `conversations` + `messages` tables (Replit-specific, will rework later)

Create: `supabase/migrations/001_initial_schema.sql`

**New tables to add for MVP features:**
```sql
-- Payments
payment_transactions (id, client_id, therapist_id, appointment_id, amount_dinar, payment_method, status, external_ref, created_at)

-- Push notifications
fcm_tokens (id, user_id, token, device_type, created_at)

-- Crisis
crisis_reports (id, user_id, severity, auto_detected, responder_id, resolved_at, created_at)

-- Onboarding
onboarding_responses (id, user_id, primary_concerns text[], preferred_language, gender_preference, budget_range, completed_at)
```

Add `onboarding_completed boolean default false` column to `profiles` table.

### 1.4 Row Level Security policies
Create: `supabase/migrations/002_rls_policies.sql`

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | All read | Auto-trigger | Own (`id = auth.uid()`) | — |
| therapist_profiles | All read | Own (`user_id = auth.uid()`) | Own | — |
| therapy_conversations | Participants | Auth'd | — | — |
| therapy_messages | Conversation participants | Conversation participants | Own sender (mark read) | — |
| appointments | Participants | Auth'd | Participants | — |
| mood_entries | Own only | Own | — | Own |
| journal_entries | Own only | Own | Own | Own |
| resources | All read | Service role only | — | — |
| therapist_reviews | All read | Auth'd clients | Therapist (response only) | — |
| payment_transactions | Participants | Service role | Service role | — |
| crisis_reports | Own + responder | Auth'd | Responder | — |

### 1.5 Auto-create profile trigger
```sql
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 1.6 Seed data
Translate `server/seed.ts` (6 therapists, 6 multilingual resources) to SQL inserts in `supabase/seed.sql`.

---

## Phase 2: Replace Database Layer (Drizzle → Supabase Client)

### 2.1 Create Supabase client utilities
Create `server/supabase.ts`:
- `createServerClient()` — uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for server-side operations
- `createClientForRequest(req)` — uses anon key + extracts user session from request for RLS-aware queries

### 2.2 Rewrite `server/storage.ts`
The current `IStorage` interface has ~59 methods using Drizzle ORM queries. Rewrite `DatabaseStorage` to use Supabase JS client instead of Drizzle.

**Example transformation:**
```typescript
// BEFORE (Drizzle)
async getMoodEntries(userId: string, limit = 30) {
  return db.select().from(moodEntries)
    .where(eq(moodEntries.userId, userId))
    .orderBy(desc(moodEntries.createdAt))
    .limit(limit);
}

// AFTER (Supabase)
async getMoodEntries(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
```

**Key method groups to rewrite:**
- User CRUD (3 methods) — now operates on `profiles` table
- Therapist profiles (5 methods) — filter logic moves to Supabase `.or()` / `.contains()`
- Conversations + messages (8 methods) — including `getOrCreateConversation`, `markMessagesRead`, `getUnreadCount`
- Appointments (3 methods)
- Mood entries (2 methods)
- Journal entries (4 methods)
- Resources (2 methods)
- Reviews (5 methods) — including `updateTherapistRating` aggregate

### 2.3 Update `server/db.ts`
Replace Drizzle pool + ORM setup with Supabase client initialization. Keep the file as the single source of the Supabase client instance.

### 2.4 Update `shared/schema.ts`
Remove Drizzle table definitions. Replace with TypeScript type definitions matching the Supabase tables (can auto-generate with `supabase gen types typescript`). Keep the Zod insert schemas for API validation.

---

## Phase 3: Replace Auth (Replit Auth → Supabase Auth)

### 3.1 Configure Supabase Auth providers
In Supabase dashboard:
- Enable Email/Password with email confirmation
- Enable Google OAuth
- Enable Facebook OAuth
- Enable Phone OTP (configure for +216 Tunisian numbers via Twilio)

### 3.2 Remove Replit Auth
Delete: `server/replit_integrations/auth/` (replitAuth.ts, routes.ts, storage.ts)
Remove: Passport.js, express-session, connect-pg-simple dependencies

### 3.3 Create new auth routes in `server/routes.ts`
Replace the old `/api/login`, `/api/logout`, `/api/auth/user` with:
- `POST /api/auth/signup` — `supabase.auth.signUp({ email, password })`
- `POST /api/auth/login` — `supabase.auth.signInWithPassword({ email, password })`
- `POST /api/auth/login/otp` — `supabase.auth.signInWithOtp({ phone })`
- `POST /api/auth/verify-otp` — `supabase.auth.verifyOtp({ phone, token })`
- `GET /api/auth/user` — Extract user from Supabase JWT in Authorization header
- `POST /api/auth/logout` — `supabase.auth.signOut()`
- `GET /api/auth/oauth/:provider` — Redirect to OAuth URL
- `GET /api/auth/callback` — OAuth callback handler

### 3.4 Update auth middleware
Replace `req.isAuthenticated()` pattern throughout `server/routes.ts` with Supabase JWT verification:
```typescript
const { data: { user }, error } = await supabase.auth.getUser(token)
if (!user) return res.status(401).json({ message: 'Unauthorized' })
```

### 3.5 Update client auth hook
Rewrite `client/src/hooks/use-auth.ts`:
- Initialize Supabase browser client
- `supabase.auth.getUser()` for session check
- `supabase.auth.onAuthStateChange()` for reactive updates
- Fetch profile from `profiles` table after auth
- Return `{ user, profile, isLoading, isAuthenticated, signOut }`

### 3.6 Create login/signup pages
New files:
- `client/src/pages/login.tsx` — Email/password form + OAuth buttons (Google, Facebook) + phone OTP tab
- `client/src/pages/signup.tsx` — Registration with role selection (client/therapist)

Add routes in `client/src/App.tsx`.

---

## Phase 4: Replace WebSocket with Supabase Realtime

### 4.1 Remove custom WebSocket server
Remove from `server/routes.ts`: the WebSocket setup (lines ~15-109), `wsClients` Map, `broadcastToUser()`, `broadcastPresence()`.
Remove from `server/index.ts`: WebSocket server binding.
Uninstall: `ws` package.

### 4.2 Message real-time (client-side)
In `client/src/pages/messages.tsx`, replace the `refetchInterval: 3000` polling with:
```typescript
supabase.channel(`conversation-${id}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'therapy_messages', filter: `conversation_id=eq.${id}` },
    (payload) => { /* append message to state */ })
  .subscribe()
```

### 4.3 Therapist presence (client-side)
In `client/src/pages/therapists.tsx`, replace WebSocket presence with Supabase Realtime Presence:
```typescript
const channel = supabase.channel('online-users')
channel.on('presence', { event: 'sync' }, () => { /* update online set */ })
channel.subscribe(() => channel.track({ user_id, role }))
```

### 4.4 Appointment notifications
Subscribe to `postgres_changes` on `appointments` table filtered by user ID for real-time appointment updates.

---

## Phase 5: Onboarding Questionnaire

### 5.1 New page: `client/src/pages/onboarding.tsx`
Multi-step form:
1. Primary concerns (anxiety, depression, stress, relationships, trauma, etc.)
2. Language preference (Arabic, French, Darija)
3. Gender preference for therapist
4. Budget range
5. How did you hear about Shifa?

### 5.2 API route
- `POST /api/onboarding` — Save responses to `onboarding_responses` table, set `profiles.onboarding_completed = true`

### 5.3 Redirect logic
In `client/src/App.tsx` AuthGuard: if user authenticated but `profile.onboarding_completed === false`, redirect to `/onboarding`.

---

## Phase 6: Payment Integration (Flouci + Konnect)

### 6.1 Payment API routes
Add to `server/routes.ts`:
- `POST /api/payments/flouci/initiate` — Create Flouci payment session, return redirect URL
- `POST /api/payments/flouci/webhook` — Verify payment callback, update `payment_transactions` status
- `POST /api/payments/konnect/initiate` — Create Konnect/D17 payment
- `POST /api/payments/konnect/webhook` — Handle Konnect callback

### 6.2 Updated booking flow
Modify `client/src/pages/therapist-profile.tsx` booking dialog:
- Add payment method selection (Flouci, Konnect/D17)
- Redirect to payment gateway → callback → confirm appointment

### 6.3 Payment history
Add to dashboard: recent payment transactions list.

---

## Phase 7: Push Notifications (FCM)

### 7.1 Setup
- Install `firebase-admin` (server) and `firebase` (client)
- Create Firebase project, get service account key
- Add `FIREBASE_SERVICE_ACCOUNT` to env

### 7.2 Token registration
- `POST /api/notifications/register` — Save FCM token to `fcm_tokens` table
- Client requests notification permission on login, registers token

### 7.3 Notification triggers
Add to relevant routes in `server/routes.ts`:
- New message → push to recipient
- Appointment created → push to therapist
- Appointment status changed → push to other party
- Appointment reminder (scheduled, e.g., 1 hour before)

---

## Phase 8: Crisis Intervention

### 8.1 SOS button component
Add to `client/src/components/app-layout.tsx`: floating SOS button visible on all protected screens.

### 8.2 Crisis page: `client/src/pages/crisis.tsx`
- Full-screen with large, clear options
- Direct call buttons: SAMU (190), Police (197)
- Chat with crisis volunteer (if available)
- Self-help grounding exercise quick-access
- "I'm safe" confirmation button

### 8.3 Keyword detection
In message creation route (`POST /api/conversations/:id/messages`):
- Check content against crisis keyword list (Arabic, French, Darija)
- If detected: create `crisis_reports` entry, trigger push notification to available responders
- Show gentle intervention prompt to the user

---

## Phase 9: E2E Encryption for Messages

### 9.1 Approach
Use Web Crypto API for client-side encryption:
- On conversation creation: generate shared AES-256 key
- Encrypt messages client-side before sending
- Store encrypted content in `therapy_messages.content`
- Decrypt on recipient's client

### 9.2 Key management
- Add `encryption_key` column to `therapy_conversations` (encrypted with user's public key)
- Key exchange during first message in conversation

### 9.3 Client changes
In `client/src/pages/messages.tsx`:
- Encrypt before `POST /api/conversations/:id/messages`
- Decrypt when rendering received messages

---

## Files Modified/Created Summary

### Modified (existing files):
- `server/storage.ts` — Rewrite all methods from Drizzle → Supabase client
- `server/db.ts` — Replace Drizzle + pg Pool with Supabase client
- `server/routes.ts` — New auth routes, remove WebSocket, add payment/notification/crisis routes
- `server/index.ts` — Remove WebSocket server, remove Passport/session middleware
- `shared/schema.ts` — Replace Drizzle definitions with TypeScript types + Zod schemas
- `client/src/hooks/use-auth.ts` — Rewrite for Supabase Auth
- `client/src/App.tsx` — Add new routes (login, signup, onboarding, crisis)
- `client/src/pages/messages.tsx` — Supabase Realtime instead of polling
- `client/src/pages/therapists.tsx` — Supabase Realtime Presence instead of WebSocket
- `client/src/pages/therapist-profile.tsx` — Payment flow in booking dialog
- `client/src/components/app-layout.tsx` — Add SOS button
- `client/src/lib/queryClient.ts` — Update apiRequest for Supabase auth headers
- `package.json` — Add/remove dependencies

### New files:
- `server/supabase.ts` — Supabase client initialization
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/seed.sql`
- `client/src/pages/login.tsx`
- `client/src/pages/signup.tsx`
- `client/src/pages/onboarding.tsx`
- `client/src/pages/crisis.tsx`

### Deleted:
- `server/replit_integrations/auth/` (entire directory)
- `drizzle.config.ts`
- Remove `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `pg`, `passport*`, `express-session`, `connect-pg-simple`, `ws`, `@replit/*` from dependencies

---

## Verification Plan

1. **Database:** Create Supabase project → run migrations → verify all tables + RLS policies by testing queries as different user roles
2. **Auth:** Sign up with email → verify profile auto-created → login → verify JWT works in API calls → test OAuth + phone OTP
3. **Data layer:** Test every storage method — create/read/update/delete for all tables through the API
4. **Realtime:** Open two browser tabs → send message → verify instant delivery → verify therapist presence updates
5. **Existing features:** Walk through every page (landing, therapists, profile, dashboard, messages, appointments, mood, journal, resources, self-care, therapist-dashboard) — verify no regressions
6. **Onboarding:** New user signup → redirected to onboarding → complete quiz → redirected to dashboard
7. **Payments:** Initiate Flouci payment → complete in sandbox → verify appointment confirmed
8. **Push notifications:** Trigger a message → verify FCM push received on mobile browser
9. **Crisis:** Click SOS → verify crisis page loads → test keyword detection in chat
10. **E2E encryption:** Send message → verify stored content is encrypted in DB → verify decrypted correctly on recipient
