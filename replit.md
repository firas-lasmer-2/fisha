# Shifa (شفاء) - Mental Wellness Platform for Tunisia

## Overview
Shifa is a comprehensive therapy and mental wellness PWA designed for the Tunisian market, inspired by 7cups/BetterHelp. It connects users with qualified therapists, provides self-care tools, mood tracking, journaling, and culturally-adapted mental health resources.

## Architecture
- **Frontend**: React SPA with TypeScript, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: Express.js with WebSocket support
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)
- **AI**: OpenAI via Replit AI Integrations for therapist matching and wellness insights
- **i18n**: Custom context-based system supporting Arabic (RTL), French (LTR), and Tunisian Darija (RTL)

## Key Features
- Multilingual support (Arabic, French, Tunisian Darija) with RTL layout
- Premium landing page with interactive onboarding quiz ("What brings you here?")
- Self-care toolkit: breathing exercises (4-7-8), grounding (5-4-3-2-1), affirmations, meditation timer
- Therapist directory with filtering and AI-powered matching
- Therapist personal landing pages (public profile at /therapist/:userId) with hero, about, FAQ, availability, reviews
- Rating & review system: multi-dimensional (overall, helpfulness, communication), anonymous option, therapist responses
- Therapist dashboard (/therapist-dashboard): profile editor, stats, review management
- Real-time messaging via WebSocket (session-authenticated)
- Dashboard with wellness score, growth paths, daily check-in, mood trends
- Appointment scheduling
- Mood tracking with AI insights
- Personal journaling
- Self-help resource library
- Crisis intervention contacts (SAMU: 190, Police: 197)
- Real-time online presence: green pulsing indicator on therapist cards/profiles, "Online Now" filter, WebSocket-based live updates
- PWA with offline capabilities

## File Structure
```
client/src/
├── App.tsx                    # Routes and providers
├── components/
│   ├── app-layout.tsx         # Authenticated layout with nav
│   ├── language-switcher.tsx  # Language toggle component
│   ├── theme-toggle.tsx       # Dark/light mode toggle
│   └── ui/                    # Shadcn UI components
├── hooks/
│   ├── use-auth.ts            # Auth hook (Replit Auth)
│   └── use-toast.ts           # Toast notifications
├── lib/
│   ├── i18n.tsx               # Internationalization with AR/FR/Darija
│   ├── queryClient.ts         # React Query setup
│   └── utils.ts               # Utility functions
└── pages/
    ├── landing.tsx            # Premium landing page with onboarding quiz
    ├── dashboard.tsx          # User dashboard with growth paths
    ├── therapists.tsx         # Therapist directory with AI matching
    ├── therapist-profile.tsx  # Public therapist landing page with reviews
    ├── therapist-dashboard.tsx # Therapist profile editor and review management
    ├── messages.tsx           # Real-time messaging
    ├── appointments.tsx       # Appointment management
    ├── mood.tsx               # Mood tracking
    ├── journal.tsx            # Personal journaling
    ├── self-care.tsx          # Self-care toolkit (breathing, grounding, etc.)
    ├── resources.tsx          # Self-help resources
    └── not-found.tsx          # 404 page

server/
├── index.ts                   # Express server setup
├── routes.ts                  # API routes + WebSocket
├── storage.ts                 # Database storage layer
├── seed.ts                    # Database seed data (6 therapists, 6 resources)
├── db.ts                      # Database connection
└── replit_integrations/
    ├── auth/                  # Replit Auth integration
    ├── chat/                  # AI chat integration
    ├── audio/                 # Audio integration
    └── image/                 # Image generation

shared/
└── schema.ts                  # Drizzle schema + types
```

## Database Tables
- `users` - User accounts with role, language preference, governorate
- `sessions` - Auth sessions (Replit Auth)
- `therapist_profiles` - Therapist credentials, specializations, rates, personal page fields (headline, aboutMe, slug, faqItems, socialLinks, etc.)
- `therapist_reviews` - Multi-dimensional reviews (overall/helpfulness/communication ratings, comments, therapist responses, anonymous flag)
- `therapy_conversations` - Chat threads between clients and therapists
- `therapy_messages` - Individual messages in conversations
- `appointments` - Scheduled therapy sessions
- `mood_entries` - Daily mood tracking data
- `journal_entries` - Personal journal entries
- `resources` - Self-help articles and guides (multilingual)

## Color Theme
Calming teal/green palette inspired by mental wellness:
- Primary: `hsl(168 55% 38%)` - Calming teal
- Background: `hsl(160 30% 98%)` - Warm light green
- Charts: Teal, blue, green, amber, purple

## Dark Mode
- Theme toggle component at `client/src/components/theme-toggle.tsx`
- Toggle appears in both the app header and landing page header
- Uses localStorage persistence (key: `shifa-theme`)
- Toggles `dark` class on `document.documentElement`
- `darkMode: ["class"]` in Tailwind config with CSS variables in `:root` and `.dark`

## CSS Utilities
- `.gradient-calm` - Teal to blue gradient
- `.gradient-warm` - Teal to green gradient
- `.gradient-hero` - Hero section background
- `.text-gradient` - Gradient text effect
- `.glass-effect` - Glassmorphism backdrop blur
- `.card-premium` - Hover shadow lift on cards
- `.breathing-circle` - Animated breathing exercise circle (inhale/hold/exhale)
- `.animate-float` / `.animate-float-delayed` / `.animate-float-slow` - Floating animations
- `.animate-pulse-soft` - Soft pulse animation
- `.pattern-dots` - Subtle dot pattern background
- `.mood-btn` - Mood selection button with hover scale
- `.hover-elevate` / `.active-elevate` - Interaction elevation effects

## Fonts
- Latin: Inter
- Arabic: Tajawal, Noto Sans Arabic

## API Endpoints
- `GET /api/therapists` - List therapists with filters
- `GET /api/therapists/online` - Get currently connected therapist user IDs
- `PATCH /api/therapists` - Update therapist profile (authenticated)
- `GET /api/therapists/:userId/reviews` - Get reviews for a therapist
- `POST /api/therapists/:userId/reviews` - Submit review (authenticated)
- `POST /api/reviews/:id/respond` - Therapist responds to review
- `GET /api/therapist/slug/:slug` - Resolve slug to therapist profile
- `GET /api/therapist/dashboard` - Therapist dashboard data (authenticated)
- `POST /api/conversations` - Start conversation with therapist
- `GET/POST /api/conversations/:id/messages` - Messages
- `GET/POST /api/appointments` - Appointments
- `GET/POST /api/mood` - Mood entries
- `GET/POST /api/journal` - Journal entries
- `GET /api/resources` - Self-help resources
- `POST /api/ai/match-therapist` - AI therapist matching
- `POST /api/ai/wellness-insight` - AI mood analysis
