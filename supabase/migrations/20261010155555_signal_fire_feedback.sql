-- Private application feedback. Only the service role writes; member reads are
-- restricted by RLS. Server actions verify the current session and owner role.
create table public.app_feedback_reports (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('problem', 'idea')),
  title text not null check (char_length(btrim(title)) between 5 and 100),
  body text not null check (char_length(btrim(body)) between 20 and 4000),
  page_context text check (page_context is null or char_length(btrim(page_context)) between 1 and 200),
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'closed')),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint feedback_closed_state check ((status = 'closed') = (closed_at is not null))
);

create table public.app_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.app_feedback_reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_kind text not null default 'sender' check (author_kind in ('sender', 'owner')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index feedback_sender_activity_idx on public.app_feedback_reports(sender_id, last_activity_at desc);
create index feedback_sender_created_idx on public.app_feedback_reports(sender_id, created_at desc);
create index feedback_owner_inbox_idx on public.app_feedback_reports(status, last_activity_at desc);
create index feedback_closed_retention_idx on public.app_feedback_reports(closed_at) where status = 'closed';
create index feedback_replies_report_time_idx on public.app_feedback_replies(report_id, created_at, id);
create index feedback_replies_author_time_idx on public.app_feedback_replies(author_id, created_at desc);

alter table public.app_feedback_reports enable row level security;
alter table public.app_feedback_replies enable row level security;
revoke all on public.app_feedback_reports, public.app_feedback_replies from public, anon, authenticated;
grant all on public.app_feedback_reports, public.app_feedback_replies to service_role;
grant select on public.app_feedback_reports to authenticated;
grant select (id, report_id, author_kind, body, created_at) on public.app_feedback_replies to authenticated;

create policy feedback_sender_read on public.app_feedback_reports
  for select to authenticated using (sender_id = (select auth.uid()));
create policy feedback_reply_sender_read on public.app_feedback_replies
  for select to authenticated using (
    exists (
      select 1 from public.app_feedback_reports r
      where r.id = report_id and r.sender_id = (select auth.uid())
    )
  );
create policy app_account_active on public.app_feedback_reports
  as restrictive for all to authenticated
  using ((select private.app_account_active()))
  with check ((select private.app_account_active()));
create policy app_account_active on public.app_feedback_replies
  as restrictive for all to authenticated
  using ((select private.app_account_active()))
  with check ((select private.app_account_active()));

-- Lock the sender's profile to serialize concurrent submissions from one account.
create function private.limit_feedback_reports() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles where id = new.sender_id for update;
  if not found then raise foreign_key_violation; end if;
  if exists (select 1 from public.app_account_access where profile_id = new.sender_id and suspended) then
    raise insufficient_privilege using message = 'Account access is suspended.';
  end if;
  if exists (
    select 1 from public.app_feedback_reports
    where sender_id = new.sender_id and created_at > now() - interval '60 seconds'
  ) or (
    select count(*) from public.app_feedback_reports
    where sender_id = new.sender_id and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise check_violation using message = 'Feedback submission limit reached.';
  end if;
  return new;
end $$;
revoke all on function private.limit_feedback_reports() from public, anon, authenticated;
create trigger limit_feedback_reports before insert on public.app_feedback_reports
  for each row execute function private.limit_feedback_reports();

-- Reply inserts serialize on their parent report and update inbox ordering.
create function private.record_feedback_reply() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare report_status text; report_sender uuid;
begin
  select status, sender_id into report_status, report_sender
    from public.app_feedback_reports where id = new.report_id for update;
  if not found then raise foreign_key_violation; end if;
  new.author_kind := case when new.author_id = report_sender then 'sender' else 'owner' end;
  if exists (select 1 from public.app_account_access where profile_id = new.author_id and suspended) then
    raise insufficient_privilege using message = 'Account access is suspended.';
  end if;
  if report_status = 'closed' then
    raise check_violation using message = 'Closed feedback cannot receive replies.';
  end if;
  if exists (
    select 1 from public.app_feedback_replies
    where report_id = new.report_id and author_id = new.author_id
      and created_at > now() - interval '5 seconds'
  ) or (
    select count(*) from public.app_feedback_replies
    where author_id = new.author_id and created_at > now() - interval '24 hours'
  ) >= 20 or (
    select count(*) from public.app_feedback_replies where report_id = new.report_id
  ) >= 200 then
    raise check_violation using message = 'Feedback reply limit reached.';
  end if;
  update public.app_feedback_reports set last_activity_at = now() where id = new.report_id;
  return new;
end $$;
revoke all on function private.record_feedback_reply() from public, anon, authenticated;
create trigger record_feedback_reply before insert on public.app_feedback_replies
  for each row execute function private.record_feedback_reply();

create function private.record_feedback_status() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.last_activity_at := now();
    new.closed_at := case when new.status = 'closed' then now() else null end;
  end if;
  return new;
end $$;
revoke all on function private.record_feedback_status() from public, anon, authenticated;
create trigger record_feedback_status before update of status on public.app_feedback_reports
  for each row execute function private.record_feedback_status();

-- Closed conversations are retained for 180 days, then removed with replies.
create function private.prune_closed_feedback() returns void
language sql security invoker set search_path = '' as $$
  delete from public.app_feedback_reports
  where status = 'closed' and closed_at < now() - interval '180 days';
$$;
revoke all on function private.prune_closed_feedback() from public, anon, authenticated;
select cron.schedule(
  'signal-fire-closed-retention', '0 4 * * *',
  'select private.prune_closed_feedback();'
);
