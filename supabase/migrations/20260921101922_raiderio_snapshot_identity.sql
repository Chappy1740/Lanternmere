-- Keep a minimal, consent-scoped identity beside the external snapshot.
-- This avoids granting selected-Lodge leaders access to a Traveler's broader profile.
alter table public.character_raiderio_snapshots
  add column character_name text,
  add column realm_slug text,
  add column region text;

update public.character_raiderio_snapshots snapshot
set
  character_name = character.character_name,
  realm_slug = character.realm_slug,
  region = character.region
from public.characters character
where character.id = snapshot.character_id;

alter table public.character_raiderio_snapshots
  alter column character_name set not null,
  alter column realm_slug set not null,
  alter column region set not null;
