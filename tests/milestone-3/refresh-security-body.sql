-- Run only after the Milestone 2 regression body, inside a rollback transaction.
select pg_temp.check_true((select relrowsecurity from pg_class where oid='public.character_refresh_failures'::regclass), 'failure RLS enabled');
select pg_temp.check_true(not has_table_privilege('anon','public.character_refresh_failures','SELECT'), 'anonymous failure reads denied');
do $$ declare r text; op text; begin
  foreach r in array array['anon','authenticated'] loop
    foreach op in array array['INSERT','UPDATE','DELETE'] loop
      perform pg_temp.check_true(not has_table_privilege(r,'public.character_refresh_failures',op), r || ' failure ' || op || ' denied');
    end loop;
  end loop;
end $$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.sub','',true);
insert into public.character_refresh_failures(character_id,attempted_at,failure_code)
values(pg_temp.fixture('first'),now(),'throttled');
select pg_temp.check_true((select count(*)=1 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'trusted failure insertion works');
select pg_temp.check_true((select count(*)=2 from public.character_snapshots where character_id=pg_temp.fixture('first')), 'failure preserves snapshots');
select pg_temp.expect_error($q$insert into public.character_refresh_failures(character_id,attempted_at,failure_code) values(pg_temp.fixture('first'),now(),'raw-secret-error')$q$,'23514','failure codes restricted');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select pg_temp.check_true((select count(*)=1 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'owner reads failure');
select pg_temp.expect_error($q$insert into public.character_refresh_failures(character_id,attempted_at,failure_code) values(pg_temp.fixture('first'),now(),'save')$q$,'42501','owner cannot forge failure');
select pg_temp.expect_error($q$update public.character_refresh_failures set failure_code='save' where character_id=pg_temp.fixture('first')$q$,'42501','owner cannot change failure');
select pg_temp.expect_error($q$delete from public.character_refresh_failures where character_id=pg_temp.fixture('first')$q$,'42501','owner cannot delete failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=0 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'unshared Lodgemate cannot read failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select public.set_character_lodge_sharing(pg_temp.fixture('first'),array[pg_temp.fixture('lodge_a')]);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=1 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'selected Lodge member reads failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('outsider'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('outsider')::text,true);
select pg_temp.check_true((select count(*)=0 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'outsider cannot read failure');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('alice'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('alice')::text,true);
select public.set_character_lodge_sharing(pg_temp.fixture('first'),'{}'::uuid[]);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('bob'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',pg_temp.fixture('bob')::text,true);
select pg_temp.check_true((select count(*)=0 from public.character_refresh_failures where character_id=pg_temp.fixture('first')), 'unsharing removes failure visibility');
reset role;
