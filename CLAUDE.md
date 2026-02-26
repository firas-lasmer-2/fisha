# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shifa (شفاء)** — A mental wellness PWA for the Tunisian market connecting users with therapists. Full-stack TypeScript app with React SPA frontend, Express backend, PostgreSQL via Drizzle ORM, and WebSocket real-time messaging.

## Commands

```bash
npm run dev          # Development server (tsx server/index.ts, port 5000)
npm run build        # Build client (Vite) + server (esbuild) to dist/
npm run start        # Production server (node dist/index.cjs)
npm check            # TypeScript type-checking only (tsc)
npm run db:push      # Push Drizzle schema to PostgreSQL
```

No test framework is configured.

## Architecture

### Directory Layout

- **`client/`** — React 18 SPA (Vite, Tailwind, Shadcn UI new-york style)
- **`server/`** — Express 5 API + WebSocket server
- **`shared/`** — Drizzle schema (`schema.ts`) and shared models, used by both client and server
- **`script/build.ts`** — Custom build: Vite for client → `dist/public`, esbuild for server → `dist/index.cjs`

### Path Aliases (tsconfig + vite)

- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Backend (server/)

- **`index.ts`** — Express + HTTP server setup, binds WebSocket, dev (Vite middleware) vs prod (static serving)
- **`routes.ts`** — All API routes + WebSocket handler (~600 lines). WebSocket tracks online therapist presence via `Map<userId, Set<WebSocket>>`
- **`storage.ts`** — `IStorage` interface + `DatabaseStorage` class — all DB operations go through this layer
- **`db.ts`** — Drizzle ORM setup with PostgreSQL Pool from `DATABASE_URL`
- **`seed.ts`** — Seeds 6 therapists and 6 resources
- **`replit_integrations/`** — Replit Auth (Passport + OpenID Connect), AI chat, audio, image generation

### Frontend (client/src/)

- **Routing**: Wouter. Public routes (`/`, `/therapists`, `/resources`, `/self-care`) and protected routes with `AuthGuard`
- **State**: React Query (TanStack) with `staleTime=Infinity`, `retry=false` defaults. Mutations use `apiRequest` helper from `lib/queryClient.ts`
- **Auth**: `use-auth.ts` hook queries `/api/auth/user`. Replit Auth via OpenID Connect
- **i18n**: Custom context in `lib/i18n.tsx` — Arabic (RTL), French (LTR), Tunisian Darija (RTL). 200+ translation keys. `useI18n()` provides `t()`, `dir`, `isRTL`
- **Forms**: React Hook Form + Zod validation
- **UI Components**: `components/ui/` has 40+ Shadcn components. `app-layout.tsx` provides the authenticated shell with role-based navigation

### Database (Drizzle ORM)

Schema in `shared/schema.ts` with 10+ tables: users, therapist_profiles, therapist_reviews, therapy_conversations, therapy_messages, appointments, mood_entries, journal_entries, resources, sessions. Insert/select types exported via `drizzle-zod`.

Config: `drizzle.config.ts` outputs migrations to `migrations/`.

### WebSocket Protocol

Connected at `/ws` with session auth. Broadcasts: therapist presence (online/offline), new messages, appointment updates. Server maintains `onlineTherapists` map for real-time status.

### Styling

- Tailwind with CSS custom properties for theming (light/dark via class strategy)
- Primary color: teal (`hsl(168 55% 38%)`)
- Font stack: Inter (Latin), Tajawal/Noto Sans Arabic (Arabic)
- Custom utility classes: `.gradient-calm`, `.glass-effect`, `.card-premium`, `.breathing-circle`, `.animate-float`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Express session secret
- `ISSUER_URL`, `REPL_ID` — Replit Auth configuration
- `AI_INTEGRATIONS_*` — OpenAI via Replit AI endpoints

## Key Patterns

- All database access goes through `IStorage` interface in `server/storage.ts` — never query the DB directly from routes
- API responses use `res.json()` consistently; errors use `res.status(N).json({ message })`
- Auth check pattern: `if (!req.isAuthenticated()) return res.status(401).json({ message: "..." })`
- Client mutations invalidate React Query cache via `queryClient.invalidateQueries`
- Multilingual content fields use `*Ar`, `*Fr`, `*Darija` suffixes (e.g., `titleAr`, `titleFr`, `titleDarija`)
