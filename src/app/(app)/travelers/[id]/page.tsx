import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { MainCharacterControl } from './main-character-control';
import { LodgeSharingControl } from './lodge-sharing-control';
import { displayProfileSchema } from '@/lib/wow/character-display';
import { loadRefreshFailures } from '@/lib/wow/refresh-status';
import { CharacterPortrait } from '@/components/character-portrait';
import { CharacterFreshness } from '@/components/character-freshness';
const characterSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  class: z.string().nullable(),
  faction: z.string().nullable(),
  level: z.number().nullable(),
  is_main: z.boolean(),
});

const snapshotSchema = z.object({
  source: z.string(),
  last_refreshed_at: z.string(),
  snapshot_data: z.unknown(),
});

export default async function CharacterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { data, error } = await supabase
    .from('characters')
    .select('id, profile_id, character_name, realm_slug, region, class, faction, level, is_main')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load this character.');
  }

  if (!data) {
    notFound();
  }

  const character = characterSchema.parse(data);

  const { data: snapshotData, error: snapshotError } = await supabase
    .from('character_snapshots')
    .select('source, last_refreshed_at, snapshot_data')
    .eq('character_id', id)
    .order('last_refreshed_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    throw new Error('Unable to load the character snapshot.');
  }

  const snapshot = snapshotData ? snapshotSchema.parse(snapshotData) : null;

  const displayProfile = displayProfileSchema.safeParse(snapshot?.snapshot_data);
  const profile = displayProfile.success ? displayProfile.data : null;

  const name = profile?.name || character.character_name;
  const realm = profile?.realm?.name || character.realm_slug;
  const specialization = profile?.active_spec?.name;
  const isOwner = character.profile_id === user.id;
  const failures = await loadRefreshFailures(supabase, [character.id]);
  let availableLodges: { id: string; name: string }[] = [];
  let selectedLodgeIds: string[] = [];

  if (isOwner) {
    const [membershipResult, sharingResult] = await Promise.all([
      supabase.from('lodge_members').select('lodge_id').eq('profile_id', user.id),
      supabase.from('character_lodges').select('lodge_id').eq('character_id', character.id),
    ]);

    if (membershipResult.error || sharingResult.error) {
      throw new Error('Unable to load Lodge sharing settings.');
    }

    const lodgeIdRows = z.array(z.object({ lodge_id: z.uuid() }));

    const memberships = lodgeIdRows.parse(membershipResult.data ?? []);
    const sharing = lodgeIdRows.parse(sharingResult.data ?? []);

    selectedLodgeIds = sharing.map((row) => row.lodge_id);

    const membershipIds = memberships.map((row) => row.lodge_id);

    if (membershipIds.length > 0) {
      const { data: lodgeData, error: lodgeError } = await supabase
        .from('lodges')
        .select('id, name')
        .in('id', membershipIds)
        .order('name');

      if (lodgeError) {
        throw new Error('Unable to load your Lodges.');
      }

      availableLodges = z
        .array(z.object({ id: z.uuid(), name: z.string() }))
        .parse(lodgeData ?? []);
    }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <div className="lodge-panel p-6 sm:p-8">
      <p className="lodge-kicker">
        {isOwner ? 'Your saved character' : 'Shared Lodge character'}
      </p>

      <h1 className="font-display text-text-primary mt-3 text-4xl font-bold">{name}</h1>

      <div className="mt-5 flex items-center gap-4 rounded-lg border border-[color:var(--border-ornate)] bg-surface-sunken/35 p-4">
        <CharacterPortrait
          src={profile?.portrait_url}
          name={name}
          characterClass={character.class}
          gender={profile?.gender?.name}
        />
        <p className="text-text-muted text-sm">
          {realm} · {character.region.toUpperCase()}
        </p>
      </div>

      <div className="mt-6">
        <dl className="grid grid-cols-2 gap-6">
          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Equipped item level</dt>
            <dd className="text-text-primary mt-1">
              {profile?.equipped_item_level ?? 'Unavailable — refresh to check'}
            </dd>
          </div>
          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Average item level</dt>
            <dd className="text-text-primary mt-1">
              {profile?.average_item_level ?? 'Unavailable — refresh to check'}
            </dd>
          </div>
          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Level</dt>
            <dd className="text-text-primary mt-1">{character.level ?? 'Unavailable'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Class</dt>
            <dd className="text-text-primary mt-1">{character.class ?? 'Unavailable'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Race</dt>
            <dd className="text-text-primary mt-1">{profile?.race?.name ?? 'Unavailable'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Gender</dt>
            <dd className="text-text-primary mt-1">{profile?.gender?.name ?? 'Unavailable'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Specialization</dt>
            <dd className="text-text-primary mt-1">{specialization ?? 'Unavailable'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Faction</dt>
            <dd className="text-text-primary mt-1">{character.faction ?? 'Unavailable'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Character status</dt>
            <dd className="text-text-primary mt-1">{character.is_main ? 'Main' : 'Alternate'}</dd>
          </div>

          <div className="lodge-data-cell">
            <dt className="text-text-muted text-sm">Source</dt>
            <dd className="text-text-primary mt-1">
              {snapshot?.source === 'blizzard' ? 'Blizzard' : (snapshot?.source ?? 'Unavailable')}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <CharacterFreshness
            refreshedAt={snapshot?.last_refreshed_at}
            failedAt={failures.latest.get(character.id)}
            statusUnavailable={failures.unavailable}
          />
        </div>
        {snapshot && (
          <p className="text-text-muted mt-6 text-sm">
            Last refreshed:{' '}
            <time dateTime={snapshot.last_refreshed_at}>
              {new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'UTC',
              }).format(new Date(snapshot.last_refreshed_at))}{' '}
              UTC
            </time>
          </p>
        )}
      </div>
      </div>
      {isOwner && (
        <p className="text-text-muted mt-4 text-sm">
          To refresh this profile,{' '}
          <Link
            href="/travelers/new"
            className="text-accent focus-visible:outline-accent underline focus-visible:outline-2"
          >
            import this character again
          </Link>{' '}
          using the same region, realm, and name. Main and Lodge sharing settings are preserved.
        </p>
      )}
      {isOwner && <MainCharacterControl characterId={character.id} isMain={character.is_main} />}
      {isOwner && (
        <LodgeSharingControl
          key={character.id}
          characterId={character.id}
          lodges={availableLodges}
          selectedLodgeIds={selectedLodgeIds}
        />
      )}
      <Link href="/travelers/new" className="text-accent hover:text-accent-hover mt-6 inline-block">
        Add another character
      </Link>
    </div>
  );
}
