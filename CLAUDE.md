# CLAUDE.md

## Project Overview

Shifa (شفاء) is a full-stack TypeScript mental wellness platform for Tunisia.

- Frontend: React + Vite + Wouter + React Query
- Backend: Express API
- Data/Auth/Realtime: Supabase (Postgres + Auth + Realtime + RLS)
- AI: OpenAI

## Commands

```bash
npm run dev
npm run build
npm run start
npm run check
```

## Key Architecture

- `server/storage.ts` is the single data access layer (`IStorage` + `DatabaseStorage`).
- `server/supabase.ts` initializes Supabase server clients.
- Auth is bearer JWT based (`Authorization: Bearer <token>`), validated in `server/routes.ts`.
- Shared API/domain types live in `shared/schema.ts`.
- Client auth/session integration is in `client/src/hooks/use-auth.ts` + `client/src/lib/supabase.ts`.

## Realtime

- Messages: Supabase `postgres_changes` subscriptions in `client/src/pages/messages.tsx`.
- Presence: Supabase Presence channel via `client/src/hooks/use-online-therapists.ts`.
- Appointments: realtime invalidation in `client/src/pages/appointments.tsx`.

## Database Migrations

Supabase SQL migrations are in `supabase/migrations/`:

- `001_initial_schema.sql`
- `002_rls_policies.sql`
- `003_constraints_and_onboarding.sql`
- `004_e2e_keys.sql`
- `005_payment_webhook_hardening.sql`

## Security Notes

- RLS is enforced at database level.
- Webhook endpoints support optional HMAC verification via env secrets.
- E2E messaging is client-side encrypted (pragmatic v1 with wrapped conversation keys).

