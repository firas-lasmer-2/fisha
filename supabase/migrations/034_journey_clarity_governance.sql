-- Journey clarity governance

create table if not exists public.journey_paths (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  role text not null check (role in ('visitor', 'client', 'therapist', 'listener', 'moderator', 'admin')),
  stage text not null check (stage in ('discovery', 'onboarding', 'home', 'continuation')),
  label_key text not null,
  summary_key text,
  destination_path text not null,
  audience_description text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  supports_guest boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journey_paths_role_stage_status
  on public.journey_paths(role, stage, status, display_order);

create table if not exists public.feature_inventory_items (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  surface text not null check (surface in ('landing', 'support', 'welcome', 'workflow', 'dashboard', 'nav', 'settings', 'other')),
  route_path text not null,
  destination_path text,
  goal_key text not null,
  role_scope text[] not null default '{}',
  status text not null default 'secondary' check (status in ('primary', 'secondary', 'experimental', 'retired')),
  label_key text not null,
  summary_key text,
  journey_path_id uuid references public.journey_paths(id) on delete set null,
  replacement_route text,
  duplicate_of_item_id uuid references public.feature_inventory_items(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  user_value_statement text not null,
  review_notes text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_inventory_items_surface_status
  on public.feature_inventory_items(surface, status, route_path);

create index if not exists idx_feature_inventory_items_role_scope
  on public.feature_inventory_items using gin (role_scope);

create unique index if not exists idx_feature_inventory_primary_surface_goal
  on public.feature_inventory_items(surface, goal_key)
  where status = 'primary';

create table if not exists public.redirect_rules (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  target_path text not null,
  reason text not null check (reason in ('retired', 'merged', 'renamed', 'role-home-change')),
  message_key text,
  role_scope text[] not null default '{}',
  preserve_query boolean not null default true,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint redirect_rules_source_target_check check (source_path <> target_path)
);

create index if not exists idx_redirect_rules_status
  on public.redirect_rules(status, source_path);

create table if not exists public.localization_audits (
  id uuid primary key default gen_random_uuid(),
  route_path text not null,
  language text not null check (language in ('ar', 'fr')),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'blocked')),
  untranslated_count integer not null default 0 check (untranslated_count >= 0),
  mixed_copy_count integer not null default 0 check (mixed_copy_count >= 0),
  fallback_copy_count integer not null default 0 check (fallback_copy_count >= 0),
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(route_path, language)
);

create index if not exists idx_localization_audits_route_language_status
  on public.localization_audits(route_path, language, status);
