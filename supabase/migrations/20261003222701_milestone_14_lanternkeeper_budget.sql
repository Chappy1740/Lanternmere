-- Metadata only: no prompts, source records, model responses, or player identities beyond caller IDs.
create table public.lanternkeeper_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  view text not null check (view in ('weekly', 'raid', 'changes')),
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  provider text,
  model text,
  latency_ms integer check (latency_ms between 0 and 120000),
  input_tokens integer check (input_tokens between 0 and 100000),
  output_tokens integer check (output_tokens between 0 and 100000)
);
create index idx_lanternkeeper_requests_guild_time on public.lanternkeeper_requests(guild_id, requested_at desc);
create index idx_lanternkeeper_requests_user_time on public.lanternkeeper_requests(user_id, requested_at desc);
alter table public.lanternkeeper_requests enable row level security;
revoke all on public.lanternkeeper_requests from public, anon, authenticated;
grant select, insert, update, delete on public.lanternkeeper_requests to service_role;

create function public.claim_lanternkeeper_request(p_guild_id uuid, p_view text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or p_view is null or p_view not in ('weekly', 'raid', 'changes')
     or not private.can_lead_guild(p_guild_id) then
    raise exception 'Lanternkeeper briefing not authorized' using errcode = '42501';
  end if;
  -- Serialize all claims for this Guild, including claims by different members.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_guild_id::text, 0));
  if (select count(*) from public.lanternkeeper_requests
      where user_id = v_user and requested_at > now() - interval '1 hour') >= 6
     or (select count(*) from public.lanternkeeper_requests
      where guild_id = p_guild_id and requested_at > now() - interval '1 day') >= 40 then
    return null;
  end if;
  insert into public.lanternkeeper_requests(user_id, guild_id, view)
  values (v_user, p_guild_id, p_view) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.claim_lanternkeeper_request(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_lanternkeeper_request(uuid, text) to authenticated;

create function public.finish_lanternkeeper_request(
  p_id uuid, p_status text, p_provider text, p_model text,
  p_latency_ms integer, p_input_tokens integer, p_output_tokens integer
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status is null or p_status not in ('success', 'failed') then
    raise exception 'Invalid Lanternkeeper status' using errcode = '22023';
  end if;
  update public.lanternkeeper_requests set
    status = p_status,
    provider = pg_catalog.left(p_provider, 40),
    model = pg_catalog.left(p_model, 80),
    latency_ms = p_latency_ms,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens
  where id = p_id and status = 'pending';
end;
$$;
revoke all on function public.finish_lanternkeeper_request(uuid, text, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.finish_lanternkeeper_request(uuid, text, text, text, integer, integer, integer)
  to service_role;

create function private.purge_lanternkeeper_requests()
returns void language sql security definer set search_path = '' as $$
  delete from public.lanternkeeper_requests where requested_at < now() - interval '30 days';
$$;
revoke all on function private.purge_lanternkeeper_requests() from public, anon, authenticated;
select cron.schedule('lanternmere-lanternkeeper-retention', '35 4 * * *',
  'select private.purge_lanternkeeper_requests()');
