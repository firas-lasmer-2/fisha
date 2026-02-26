-- Shifa: Strengthen listener progression ledger deduplication and analytics indexes

drop index if exists idx_listener_points_award_once;
create unique index if not exists idx_listener_points_award_once
  on public.listener_points_ledger(listener_id, session_id, event_type)
  where event_type in (
    'session_base',
    'rating_bonus',
    'low_rating_penalty',
    'detailed_feedback_bonus',
    'streak_bonus'
  );

create unique index if not exists idx_listener_report_penalty_once
  on public.listener_points_ledger(listener_id, ((meta->>'reportId')))
  where event_type = 'report_penalty' and (meta ? 'reportId');

create index if not exists idx_peer_session_feedback_listener_created
  on public.peer_session_feedback(listener_id, created_at desc);
