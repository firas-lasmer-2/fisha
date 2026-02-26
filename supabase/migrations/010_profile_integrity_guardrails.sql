-- Shifa: Profile integrity guardrails for auth/profile consistency

-- Ensure auto-profile trigger exists and stays compatible with current schema.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, onboarding_completed)
  values (new.id, new.email, 'client', false)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill missing profiles for existing auth users.
-- If email is already used by a different legacy profile row, keep email null and keep auth id integrity.
insert into public.profiles (id, email, role, onboarding_completed, created_at, updated_at)
select
  u.id,
  case
    when exists (
      select 1
      from public.profiles p2
      where p2.email = u.email
        and p2.id <> u.id
    ) then null
    else u.email
  end as email,
  'client' as role,
  false as onboarding_completed,
  now(),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Normalize nullable role values to prevent role-gating failures.
update public.profiles
set role = 'client'
where role is null or role = '';
