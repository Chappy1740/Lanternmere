-- Run only with the new migration in a caller-owned BEGIN/ROLLBACK transaction.
-- Select two existing nonsuspended profiles; create temporary report/reply rows.
-- No fixture rows should persist after ROLLBACK.
do $$
declare first_id uuid; second_id uuid; first_report uuid; second_report uuid;
begin
  select p.id into first_id from public.profiles p
  where not exists (select 1 from public.app_account_access a where a.profile_id = p.id and a.suspended)
  order by p.id limit 1;
  select p.id into second_id from public.profiles p
  where p.id <> first_id and not exists (select 1 from public.app_account_access a where a.profile_id = p.id and a.suspended)
  order by p.id limit 1;
  if first_id is null or second_id is null then raise exception 'Two active accounts are required'; end if;
  insert into public.app_feedback_reports(sender_id,category,title,body)
    values (first_id,'problem','Fixture one','Fixture report for first account only.') returning id into first_report;
  insert into public.app_feedback_reports(sender_id,category,title,body)
    values (second_id,'idea','Fixture two','Fixture report for second account only.') returning id into second_report;
  insert into public.app_feedback_replies(report_id,author_id,body)
    values (first_report,first_id,'First account reply'),(second_report,second_id,'Second account reply');
  perform set_config('request.jwt.claim.sub', first_id::text, true);
  perform set_config('signal_fire.fixture.first_report', first_report::text, true);
  perform set_config('signal_fire.fixture.second_report', second_report::text, true);
end $$;

set local role authenticated;
do $$
begin
  if (select count(*) from public.app_feedback_reports where id in
    (current_setting('signal_fire.fixture.first_report')::uuid,
     current_setting('signal_fire.fixture.second_report')::uuid)) <> 1 then
    raise exception 'Report ownership isolation failed';
  end if;
  if (select count(*) from public.app_feedback_replies where report_id in
    (current_setting('signal_fire.fixture.first_report')::uuid,
     current_setting('signal_fire.fixture.second_report')::uuid)) <> 1 then
    raise exception 'Reply ownership isolation failed';
  end if;
  if has_table_privilege(current_user,'public.app_feedback_reports','INSERT')
     or has_table_privilege(current_user,'public.app_feedback_reports','UPDATE')
     or has_table_privilege(current_user,'public.app_feedback_replies','INSERT') then
    raise exception 'Authenticated user can bypass server writes';
  end if;
end $$;
reset role;
select 'SIGNAL FIRE RLS REHEARSAL PASSED' as result;
