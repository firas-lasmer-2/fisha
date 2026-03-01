-- Migration 035: System announcements
-- Admins/moderators can broadcast announcements to specific roles.

create table if not exists announcements (
  id           bigserial primary key,
  author_id    uuid not null references profiles(id) on delete cascade,
  title        text not null,
  body         text not null,
  target_roles text[] not null default '{}',  -- empty = all roles
  priority     text not null default 'info' check (priority in ('info', 'warning', 'urgent')),
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Authenticated users can read active announcements targeted to their role.
alter table announcements enable row level security;

create policy "Authenticated users read active announcements"
  on announcements for select
  using (
    auth.role() = 'authenticated'
    and (expires_at is null or expires_at > now())
    and starts_at <= now()
  );

create policy "Admins and moderators manage announcements"
  on announcements for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'moderator')
    )
  );

create index idx_announcements_active on announcements (starts_at, expires_at)
  where expires_at is null or expires_at > now();
