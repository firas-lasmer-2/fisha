-- Shifa: RLS for marketplace slots and listener progression, and billing policy cleanup

alter table public.therapist_slots enable row level security;
alter table public.listener_progress enable row level security;
alter table public.listener_points_ledger enable row level security;

-- THERAPIST SLOTS
drop policy if exists "Therapist slots are publicly viewable" on public.therapist_slots;
create policy "Therapist slots are publicly viewable"
  on public.therapist_slots for select using (true);

drop policy if exists "Therapists can create own slots" on public.therapist_slots;
create policy "Therapists can create own slots"
  on public.therapist_slots for insert with check (
    auth.uid() = therapist_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

drop policy if exists "Therapists can update own slots" on public.therapist_slots;
create policy "Therapists can update own slots"
  on public.therapist_slots for update using (
    auth.uid() = therapist_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

drop policy if exists "Therapists can delete own slots" on public.therapist_slots;
create policy "Therapists can delete own slots"
  on public.therapist_slots for delete using (
    auth.uid() = therapist_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- LISTENER PROGRESS
drop policy if exists "Listeners can view own progress" on public.listener_progress;
create policy "Listeners can view own progress"
  on public.listener_progress for select using (
    auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

drop policy if exists "Listeners can upsert own progress" on public.listener_progress;
create policy "Listeners can upsert own progress"
  on public.listener_progress for insert with check (
    auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

drop policy if exists "Listeners can update own progress" on public.listener_progress;
create policy "Listeners can update own progress"
  on public.listener_progress for update using (
    auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- LISTENER POINTS LEDGER
drop policy if exists "Participants can view listener ledger" on public.listener_points_ledger;
create policy "Participants can view listener ledger"
  on public.listener_points_ledger for select using (
    auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

drop policy if exists "Listeners can insert own ledger entries" on public.listener_points_ledger;
create policy "Listeners can insert own ledger entries"
  on public.listener_points_ledger for insert with check (
    auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- Keep realtime updates for slot booking surfaces.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'therapist_slots'
  ) then
    alter publication supabase_realtime add table public.therapist_slots;
  end if;
end $$;
