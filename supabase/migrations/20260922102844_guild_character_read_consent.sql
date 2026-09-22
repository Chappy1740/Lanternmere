create or replace function private.character_shared_with_guild(p_character_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.character_guild_sharing sharing
    where sharing.character_id = p_character_id
      and (
        (sharing.visibility = 'members' and private.is_guild_member(sharing.guild_id))
        or (sharing.visibility = 'leadership' and private.can_lead_guild(sharing.guild_id))
      )
  );
$$;

create or replace function private.can_read_character(p_character_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.owns_character(p_character_id)
      or private.character_shared_with_me(p_character_id)
      or private.character_shared_with_guild(p_character_id);
$$;
