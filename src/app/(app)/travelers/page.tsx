import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { displayProfileSchema } from '@/lib/wow/character-display';
import { loadRefreshFailures } from '@/lib/wow/refresh-status';
import { CharacterPortrait } from '@/components/character-portrait';
import { CharacterFreshness } from '@/components/character-freshness';

const characterSchema = z.object({
  id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  class: z.string().nullable(),
  faction: z.string().nullable(),
  level: z.number().nullable(),
  is_main: z.boolean(),
  character_snapshots: z.array(
    z.object({
      source: z.string(),
      last_refreshed_at: z.string(),
      snapshot_data: z.unknown(),
    }),
  ),
});

export default async function TravelersPage() {
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
      `
      id,
      character_name,
      realm_slug,
      region,
      class,
      faction,
      level,
      is_main,
      character_snapshots (
        source,
        last_refreshed_at,
        snapshot_data
      )
    `,
    )
    .eq('profile_id', user.id)
    .order('is_main', { ascending: false })
    .order('character_name', { ascending: true })
    .order('last_refreshed_at', {
      referencedTable: 'character_snapshots',
      ascending: false,
    })
    .order('created_at', {
      referencedTable: 'character_snapshots',
      ascending: false,
    })
    .limit(1, { referencedTable: 'character_snapshots' });

  if (error) {
    throw new Error('Unable to load your characters.');
  }

  const characters = z.array(characterSchema).parse(data ?? []);
  const failures = await loadRefreshFailures(
    supabase,
    characters.map((character) => character.id),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="lodge-panel flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
        <div>
          <p className="text-accent text-sm font-medium tracking-[0.14em] uppercase">The company</p>
          <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Travelers</h1>
          <p className="text-text-muted mt-2">Your saved World of Warcraft characters.</p>
        </div>

        <Link
          href="/travelers/new"
          className="lodge-button px-5 py-2.5 font-medium"
        >
          Add Character
        </Link>
      </div>

      {characters.length === 0 ? (
        <div className="lodge-empty mt-8 p-8">
          <h2 className="font-display text-text-primary text-xl">Your journey starts here</h2>
          <p className="text-text-muted mt-2">
            Add a character to bring their public Blizzard profile into Lanternmere.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => {
            const snapshot = character.character_snapshots[0];
            const parsed = displayProfileSchema.safeParse(snapshot?.snapshot_data);
            const profile = parsed.success ? parsed.data : null;

            const name = profile?.name || character.character_name;
            const realm = profile?.realm?.name || character.realm_slug;
            const specialization = profile?.active_spec?.name;
            const identity = [profile?.race?.name, profile?.gender?.name]
              .filter(Boolean)
              .join(' · ');

            return (
              <Link
                key={character.id}
                href={`/travelers/${character.id}`}
                className="lodge-panel lodge-panel-interactive focus-visible:outline-accent block p-6 focus-visible:outline-2"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <CharacterPortrait
                    src={profile?.portrait_url}
                    name={name}
                    characterClass={character.class}
                    gender={profile?.gender?.name}
                  />
                  <h2 className="font-display text-text-primary min-w-0 flex-1 text-2xl font-bold break-words">
                    {name}
                  </h2>
                  <span className="bg-background text-accent rounded-full px-2 py-1 text-xs">
                    {character.is_main ? 'Main' : 'Alternate'}
                  </span>
                </div>

                <p className="text-text-muted mt-2 text-sm">
                  {realm} · {character.region.toUpperCase()}
                </p>

                <p className="text-text-primary mt-4">
                  Level {character.level ?? '?'} · {character.class ?? 'Unknown class'}
                </p>

                <p className="text-text-muted mt-1 text-sm">
                  {[specialization, identity, character.faction].filter(Boolean).join(' · ') ||
                    'Details unavailable'}
                </p>

                {profile?.equipped_item_level !== undefined && (
                  <p className="text-text-primary mt-2 text-sm">
                    Equipped item level {profile.equipped_item_level}
                  </p>
                )}

                <div className="border-border text-text-muted mt-6 border-t pt-4 text-xs">
                  <p>
                    Source:{' '}
                    {snapshot?.source === 'blizzard'
                      ? 'Blizzard'
                      : (snapshot?.source ?? 'Unavailable')}
                  </p>

                  <CharacterFreshness
                    refreshedAt={snapshot?.last_refreshed_at}
                    failedAt={failures.latest.get(character.id)}
                    statusUnavailable={failures.unavailable}
                  />

                  {snapshot && (
                    <p className="mt-1">
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
