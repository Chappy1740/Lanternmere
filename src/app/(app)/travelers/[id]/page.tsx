import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { MainCharacterControl } from './main-character-control';
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

const displayProfileSchema = z.object({
  name: z.string().optional(),
  realm: z.object({ name: z.string().optional() }).optional(),
  active_spec: z.object({ name: z.string().optional() }).optional(),
});

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    .select(
      'id, profile_id, character_name, realm_slug, region, class, faction, level, is_main',
    )
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

  const snapshot = snapshotData
    ? snapshotSchema.parse(snapshotData)
    : null;

  const displayProfile = displayProfileSchema.safeParse(
    snapshot?.snapshot_data,
  );
  const profile = displayProfile.success ? displayProfile.data : null;

  const name = profile?.name || character.character_name;
  const realm = profile?.realm?.name || character.realm_slug;
  const specialization = profile?.active_spec?.name;
  const isOwner = character.profile_id === user.id;

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-text-muted">
        {isOwner ? 'Your saved character' : 'Shared Lodge character'}
      </p>

      <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">
        {name}
      </h1>

      <p className="mt-2 text-text-muted">
        {realm} · {character.region.toUpperCase()}
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        <dl className="grid grid-cols-2 gap-6">
          <div>
            <dt className="text-sm text-text-muted">Level</dt>
            <dd className="mt-1 text-text-primary">
              {character.level ?? 'Unavailable'}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Class</dt>
            <dd className="mt-1 text-text-primary">
              {character.class ?? 'Unavailable'}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Specialization</dt>
            <dd className="mt-1 text-text-primary">
              {specialization ?? 'Unavailable'}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Faction</dt>
            <dd className="mt-1 text-text-primary">
              {character.faction ?? 'Unavailable'}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Character status</dt>
            <dd className="mt-1 text-text-primary">
              {character.is_main ? 'Main' : 'Alternate'}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Source</dt>
            <dd className="mt-1 text-text-primary">
              {snapshot?.source === 'blizzard'
                ? 'Blizzard'
                : snapshot?.source ?? 'Unavailable'}
            </dd>
          </div>
        </dl>

        {snapshot && (
          <p className="mt-6 text-sm text-text-muted">
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
      {isOwner && (
        <MainCharacterControl
          characterId={character.id}
          isMain={character.is_main}
        />
      )}
      <Link
        href="/travelers/new"
        className="mt-6 inline-block text-accent hover:text-accent-hover"
      >
        Add another character
      </Link>
    </div>
  );
}