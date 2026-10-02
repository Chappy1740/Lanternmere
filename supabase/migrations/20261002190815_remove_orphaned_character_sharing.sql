-- Remove consent rows left by membership deletions before the exit trigger.
-- A character's owner must currently belong to the Lodge for sharing to persist.
delete from public.character_lodges sharing using public.characters character
where sharing.character_id = character.id
  and not exists (
    select 1 from public.lodge_members member
    where member.lodge_id = sharing.lodge_id
      and member.profile_id = character.profile_id
  );

delete from public.character_raiderio_sharing sharing using public.characters character
where sharing.character_id = character.id
  and not exists (
    select 1 from public.lodge_members member
    where member.lodge_id = sharing.lodge_id
      and member.profile_id = character.profile_id
  );

delete from public.character_raidbots_reports report using public.characters character
where report.character_id = character.id
  and not exists (
    select 1 from public.lodge_members member
    where member.lodge_id = report.lodge_id
      and member.profile_id = character.profile_id
  );
