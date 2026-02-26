-- Shifa: RLS policies for hybrid peer support and billing

alter table public.listener_profiles enable row level security;
alter table public.listener_applications enable row level security;
alter table public.listener_queue enable row level security;
alter table public.peer_sessions enable row level security;
alter table public.peer_messages enable row level security;
alter table public.peer_session_feedback enable row level security;
alter table public.peer_reports enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;

-- LISTENER PROFILES
create policy "Listener profiles are viewable by everyone"
  on public.listener_profiles for select using (true);

create policy "Users can create own listener profile"
  on public.listener_profiles for insert with check (auth.uid() = user_id);

create policy "Users can update own listener profile"
  on public.listener_profiles for update using (auth.uid() = user_id);

create policy "Moderators can manage listener profiles"
  on public.listener_profiles for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- LISTENER APPLICATIONS
create policy "Users can view own listener applications"
  on public.listener_applications for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

create policy "Users can submit own listener application"
  on public.listener_applications for insert with check (auth.uid() = user_id);

create policy "Moderators can review listener applications"
  on public.listener_applications for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- LISTENER QUEUE
create policy "Clients can view own queue entries"
  on public.listener_queue for select using (
    auth.uid() = client_id
    or auth.uid() = matched_listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

create policy "Clients can join queue"
  on public.listener_queue for insert with check (auth.uid() = client_id);

create policy "Clients can leave own queue"
  on public.listener_queue for delete using (auth.uid() = client_id);

create policy "Matched listener or moderators can update queue entries"
  on public.listener_queue for update using (
    auth.uid() = matched_listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- PEER SESSIONS
create policy "Participants can view peer sessions"
  on public.peer_sessions for select using (
    auth.uid() = client_id
    or auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

create policy "Participants can create peer sessions"
  on public.peer_sessions for insert with check (
    auth.uid() = client_id or auth.uid() = listener_id
  );

create policy "Participants can update peer sessions"
  on public.peer_sessions for update using (
    auth.uid() = client_id
    or auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- PEER MESSAGES
create policy "Participants can view peer messages"
  on public.peer_messages for select using (
    exists (
      select 1 from public.peer_sessions s
      where s.id = peer_messages.session_id
      and (s.client_id = auth.uid() or s.listener_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

create policy "Participants can send peer messages"
  on public.peer_messages for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.peer_sessions s
      where s.id = session_id
      and (s.client_id = auth.uid() or s.listener_id = auth.uid())
    )
  );

-- FEEDBACK
create policy "Clients can view own feedback"
  on public.peer_session_feedback for select using (
    auth.uid() = client_id
    or auth.uid() = listener_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

create policy "Clients can submit own feedback"
  on public.peer_session_feedback for insert with check (
    auth.uid() = client_id
  );

-- REPORTS
create policy "Reporter and moderators can view reports"
  on public.peer_reports for select using (
    auth.uid() = reporter_id
    or auth.uid() = target_user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

create policy "Users can submit reports"
  on public.peer_reports for insert with check (
    auth.uid() = reporter_id
  );

create policy "Moderators can update reports"
  on public.peer_reports for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderator', 'admin')
    )
  );

-- BILLING
create policy "Plans are viewable by everyone"
  on public.plans for select using (true);

create policy "Users can view own subscriptions"
  on public.subscriptions for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin')
    )
  );

create policy "Users can create own subscriptions"
  on public.subscriptions for insert with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on public.subscriptions for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin')
    )
  );

create policy "Users can view own entitlements"
  on public.entitlements for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin')
    )
  );

create policy "Users can create own entitlements"
  on public.entitlements for insert with check (auth.uid() = user_id);

create policy "Users can update own entitlements"
  on public.entitlements for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin')
    )
  );

