-- Shifa: Pragmatic E2E key exchange columns

-- Store each user's public key for key wrapping.
alter table public.profiles
  add column if not exists public_key text;

-- Store per-participant wrapped conversation keys.
alter table public.therapy_conversations
  add column if not exists client_key_encrypted text,
  add column if not exists therapist_key_encrypted text,
  add column if not exists key_version integer default 1;

create index if not exists idx_therapy_conversations_key_version
  on public.therapy_conversations(key_version);

