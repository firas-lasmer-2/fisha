# Shifa → 7cups-Inspired Redesign & Migration Plan

Transform Shifa from a functional-but-dense mental wellness app into a polished, emotionally-warm, 7cups-like platform by redesigning UX, streamlining features, and improving the mobile experience — without rebuilding from scratch.

---

## 1. Current State: What You Have (and What 7cups Has)

### Feature Parity Matrix

| Feature | 7cups | Shifa Today | Gap |
|---|---|---|---|
| Peer listener matching | ✅ Core | ✅ Built | Queue UX needs polish |
| Licensed therapist marketplace | ✅ Paid tier | ✅ Built | Filter/discovery UX dense |
| Crisis intervention + hotlines | ✅ | ✅ SOS button | Design too alarming |
| Mood tracking | ✅ | ✅ | OK, could be richer |
| Journaling | ✅ | ✅ | OK |
| Self-help content / growth paths | ✅ Core loop | ✅ Partial | Growth paths are stubbed |
| Community forums | ✅ Major feature | ❌ | Out of scope (Phase 4+) |
| Onboarding quiz | ✅ Warm, visual | ⚠️ Functional but cold | Major improvement needed |
| Mobile app | ✅ Native apps | ✅ Capacitor | Navigation needs mobile-first rethink |
| E2E encrypted chat | ❌ | ✅ | Shifa ahead |
| Tunisian payment (Flouci/Konnect) | ❌ | ✅ | Shifa ahead |
| Multi-language (AR/FR/Darija) | ❌ | ✅ | Shifa ahead |

**Conclusion:** Shifa is functionally comparable to or ahead of 7cups for its target market. The gap is entirely **UX design quality** and **emotional feel**, not missing features.

---

## 2. Critical UX Problems (Priority-Ranked)

### 🔴 High Priority (Fix First)

**A. Onboarding is a form, not a welcome**
- All 5 steps are fully required including "How did you hear about us?" — this is a marketing question, not user-serving
- No warmth, no personalization feedback, no sense of progress payoff
- `canContinue()` blocks advancement with no explanation

**B. Navigation overload**
- Clients see 12+ nav items in the sidebar
- Desktop nav crams all items inline at `text-xs` — illegible at a glance
- No bottom navigation bar for mobile (critical for Capacitor apps — hamburger menus are friction)

**C. Dashboard is a data dump**
- 590-line page showing: mood widget, wellness score, growth paths, affirmations, upcoming appointments, unread messages, payment history, quick actions — all at once
- No hierarchy, no "one thing to do today"

**D. Peer Support page has zero warmth**
- Raw `<Input>` for language preference, comma-separated topic tags, numeric rating input
- Status badge shows raw DB enum values
- No sense of safety or emotional scaffolding before connecting with a stranger

### 🟡 Medium Priority

**E. Therapist discovery is filter-heavy**
- Good filters exist but the page opens with a generic list; no AI/onboarding-driven matching suggestion

**F. Crisis page design is jarring**
- Full-screen with `bg-destructive` red — appropriate for severity but could feel more calm + guiding

**G. Self-care is feature-complete but isolated**
- Not surfaced in the main user flow; breathing exercise reached only via nav

**H. Landing page CTAs lead to login wall**
- Quiz cards on hero → `/login` for guests; should let guests explore self-care first

### 🟢 Low Priority (Polish)

- Footer links are non-functional `<span>` elements
- `profileThemeColor`, `officePhotos`, `faqItems`, `socialLinks` on therapist profiles add admin complexity with low user value
- Listener points/gamification system is built but not surfaced to users

---

## 3. Feature Prioritization Framework

### Keep & Polish (Core Value)
1. **Peer listener system** — the 7cups differentiator; queue + anonymous sessions
2. **Therapist marketplace + booking** — revenue core
3. **Crisis intervention** — non-negotiable safety feature
4. **Mood tracking + journaling** — retention/engagement loop
5. **Self-care tools** (breathing, grounding, affirmations) — unique vs. 7cups
6. **Onboarding quiz** → rebuild as warm, conversational flow
7. **E2E messaging** — keep (competitive advantage)

### Simplify (Reduce Complexity)
| Current | Simplified Version |
|---|---|
| 5 required onboarding steps | 2 required (concerns + language) + 3 optional |
| 12-item sidebar nav | 5-item bottom nav (mobile) + grouped sidebar (desktop) |
| Therapist profile: 15+ editable fields including theme color, office photos, social links | Keep core 8 fields; hide advanced behind "more options" |
| Listener points ledger + levels | Show only: total sessions, average rating; remove ledger UI |
| Admin moderation panel | Keep approve/reject; remove detail complexity |

### Remove / Defer (Low ROI, High Complexity)
- **Community forums** — massive moderation burden; skip for now
- **Video intro URL** on therapist profiles — no video player built; remove or implement properly
- **Slot-based scheduling UI** — `therapist_slots` table exists but booking UX unclear; consolidate into simple calendar
- **`howDidYouHear` onboarding step** — pure marketing data, remove from user flow (collect via analytics instead)
- **`profileThemeColor`** for therapists — cosmetic, low value

---

## 4. Technical Architecture Recommendations

### Current Stack Assessment: ✅ Solid
```
React + Vite + Wouter + TanStack Query
Express API + Supabase (Postgres + Auth + Realtime + RLS)
Capacitor (iOS + Android)
TailwindCSS + shadcn/ui + Framer Motion
```
No need for a framework change. Improvements are at the component/design-system level.

### Recommended Technical Changes

**A. Design System Refresh**
- Introduce a warmer color palette: swap harsh `bg-destructive` reds for softer earth tones in wellness contexts
- Create 3 new semantic tokens: `--color-calm`, `--color-warm`, `--color-safe` used in peer/crisis flows
- Standardize card elevation hierarchy (currently everything is same-weight `Card`)

**B. Mobile Navigation (Capacitor)**
- Add `BottomNav` component with 5 tabs: Home · Listen · Therapists · Wellness · Profile
- Move hamburger menu to desktop only
- Implement safe area insets (`env(safe-area-inset-bottom)`) for iOS

**C. Route Architecture**
- Add `/welcome` as a post-onboarding animated greeting screen
- Rename `/peer-support` → `/listen` (shorter, more 7cups-like)
- Add `/grow` as a dedicated growth paths hub (currently buried in dashboard)

**D. State Management**
- No change needed; TanStack Query + Supabase Realtime is appropriate
- Consider adding `jotai` or Zustand for local UI state in complex pages (dashboard, peer support) to reduce prop drilling

**E. Performance**
- Code-split routes (currently likely one bundle) — add `React.lazy` for heavy pages (therapist profile, dashboard, peer support)
- Add skeleton loading states to peer support and therapist discovery (some exist, extend coverage)

**F. Scalability**
- Supabase can handle up to ~500 concurrent connections on free tier; plan upgrade path at 1,000 MAU
- Add `pgbouncer` pooling via Supabase dashboard before scaling
- FCM push notifications already implemented — verify production credentials before launch

---

## 5. Phased Roadmap

### Phase 1 — Foundation: Navigation + Onboarding (Weeks 1–2)
**Goal:** First-time users feel welcomed, returning users navigate intuitively

- [ ] Replace sidebar/hamburger with `BottomNav` component (5 tabs, mobile-first)
- [ ] Rebuild `onboarding.tsx`: 2 required steps (concerns + language), skip others as soft suggestions; add animated progress, emoji reactions on concern selection
- [ ] Add `/welcome` page: post-onboarding animated screen with first personalized therapist recommendation
- [ ] Remove "How did you hear about us?" step from onboarding
- [ ] Fix `canContinue()` — show helper text on why step is blocked

**Files to touch:** `app-layout.tsx`, `onboarding.tsx`, `App.tsx` (new `/welcome` route)

---

### Phase 2 — Dashboard Redesign (Week 3)
**Goal:** One clear daily action, not a data wall

- [ ] Redesign dashboard as a "Today" screen: featured card (daily affirmation or mood check-in), then 2-3 secondary sections
- [ ] Move growth paths to `/grow` page
- [ ] Move payment history out of dashboard (→ profile/settings page)
- [ ] Add "Recommended for you" section driven by onboarding concerns
- [ ] Improve wellness score visualization (currently a bare `Progress` bar)

**Files to touch:** `dashboard.tsx`, new `grow.tsx` page

---

### Phase 3 — Peer Support UX Overhaul (Week 4)
**Goal:** Feel as safe and warm as 7cups listener experience

- [ ] Replace language/topic raw inputs with styled option chips
- [ ] Add pre-session "What to expect" modal (anonymity guarantee, listener guidelines)
- [ ] Show queue position and estimated wait time
- [ ] Replace numeric rating `<Input>` with star-tap UI component
- [ ] Add post-session "You're not alone" closing card
- [ ] Surface listener availability indicator prominently

**Files to touch:** `peer-support.tsx` (rename to `listen.tsx`)

---

### Phase 4 — Crisis & Self-Care Polish (Week 5)
**Goal:** Crisis feels calm + guiding, not alarming; self-care is a daily destination

- [ ] Redesign `crisis.tsx`: use `--color-safe` palette (soft blue/teal), clear hierarchy of actions, grounding exercise directly embedded
- [ ] Replace floating red SOS button with a softer `AlertCircle` icon labeled "Support" (still red on tap)
- [ ] Elevate self-care: add to bottom nav as "Wellness" tab, show daily suggestion on dashboard
- [ ] Add more self-care content: body scan, sleep meditation, gratitude practice

**Files to touch:** `crisis.tsx`, `app-layout.tsx` (SOS button), `self-care.tsx`

---

### Phase 5 — Therapist Discovery Polish (Week 6)
**Goal:** Match display to emotional warmth; reduce cognitive load

- [ ] Add AI-powered "Best match for you" section above therapist list (use onboarding concerns)
- [ ] Simplify therapist card: photo, name, headline, top 2 specializations, rate, online badge
- [ ] Remove `profileThemeColor` UI from therapist edit form
- [ ] Move `videoIntroUrl`, `officePhotos`, `faqItems`, `socialLinks` to "Advanced" collapsible
- [ ] Improve booking flow: streamline to 3 steps (pick slot → confirm details → pay)

**Files to touch:** `therapists.tsx`, `therapist-profile.tsx`, `therapist-dashboard.tsx`

---

### Phase 6 — Design System & Polish (Week 7–8)
**Goal:** Cohesive, emotionally warm visual identity throughout

- [ ] Define new CSS token set: `--color-calm` (soft teal), `--color-warm` (peach/amber), `--color-safe` (lavender)
- [ ] Update `index.css` with new gradient utilities and animation classes
- [ ] Update `tailwind.config.ts` with semantic wellness color scale
- [ ] Audit all pages for consistent card padding, heading sizes, button styles
- [ ] Fix footer links (make them real `<Link>` or `<a>` elements)
- [ ] Add micro-interactions: haptic feedback on mobile (Capacitor `Haptics` plugin), smooth page transitions

**Files to touch:** `index.css`, `tailwind.config.ts`, all pages (audit)

---

### Phase 7 — Mobile Optimization (Week 9)
**Goal:** Capacitor app feels native, not web-in-a-shell

- [ ] Install `@capacitor/haptics`, `@capacitor/status-bar`, `@capacitor/keyboard`
- [ ] Add safe area CSS (`env(safe-area-inset-*)`)
- [ ] Keyboard avoidance in chat/message pages
- [ ] Status bar theming (match app gradient)
- [ ] Test on real iOS + Android device
- [ ] Verify FCM push delivery on both platforms

**Files to touch:** `capacitor.config.ts`, `app-layout.tsx`, `messages.tsx`, `peer-support.tsx`

---

### Phase 8 — Growth Paths & Engagement Loop (Week 10)
**Goal:** Give users a reason to return daily (7cups "Paths" equivalent)

- [ ] Build `/grow` page: visual path cards (Anxiety · Self-Esteem · Stress · Relationships)
- [ ] Each path: 5–8 steps (articles from Resources + self-care exercises + journal prompts)
- [ ] Track progress per user (add `growth_path_progress` table in Supabase)
- [ ] Surface "Continue your path" on dashboard daily card
- [ ] Add streak tracking (days active) as light gamification

**New files:** `grow.tsx`, Supabase migration for `growth_path_progress`

---

## 6. UX Design Principles for Mental Wellness

| Principle | Implementation |
|---|---|
| **Safety first** | Every screen with sensitive content has an accessible support path; SOS always reachable in max 2 taps |
| **No shame friction** | Onboarding never asks "why aren't you better?"; framing is always strengths-based |
| **Warm neutrality** | Color palette avoids clinical whites and alarm reds in main flows; use soft teal/amber |
| **Progressive disclosure** | Show only what's needed now; advanced options behind "more" |
| **Validation** | Small affirmations on completing actions ("Mood logged — every entry helps") |
| **Anonymity by default** | Peer sessions use aliases; journal is private; make privacy visible in UI |
| **Accessibility** | RTL-correct layout already in place; add ARIA labels to all interactive elements; ensure 4.5:1 contrast in new palette |
| **Offline grace** | Show cached content when offline; queue mood entries for sync |

---

## 7. Features to Explicitly NOT Build (Scope Guard)

- ❌ Community discussion forums (7cups biggest complexity; high moderation cost)
- ❌ Video/audio therapy calls (requires WebRTC infra; out of scope)
- ❌ Subscription management UI (Stripe/recurring billing)
- ❌ Therapist license verification automation
- ❌ Insurance/reimbursement flows
- ❌ Native iOS/Android code beyond Capacitor plugins

---

## 8. Key Metrics to Track Post-Launch

- **Onboarding completion rate** (target: >70% complete 2 required steps)
- **Day-7 retention** (target: >30%)
- **Peer session connection rate** (% of queue joiners who get matched)
- **Mood entry frequency** (weekly active loggers)
- **Therapist booking conversion** (profile view → appointment)

---

## Summary: Execution Order

```
Week 1–2  → Onboarding + Navigation
Week 3    → Dashboard
Week 4    → Peer Support
Week 5    → Crisis + Self-Care
Week 6    → Therapist Discovery
Week 7–8  → Design System
Week 9    → Mobile (Capacitor)
Week 10   → Growth Paths
```

No new backend infrastructure needed for Phases 1–7. Phase 8 requires one new Supabase table.
