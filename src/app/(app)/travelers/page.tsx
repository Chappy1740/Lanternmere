import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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

const displayProfileSchema = z.object({
  name: z.string().optional(),
  realm: z.object({ name: z.string().optional() }).optional(),
  active_spec: z.object({ name: z.string().optional() }).optional(),
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
    .select(`
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
    `)
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

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">
            Travelers
          </h1>
          <p className="mt-2 text-text-muted">
            Your saved World of Warcraft characters.
          </p>
        </div>

        <Link
          href="/travelers/new"
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-background hover:bg-accent-hover"
        >
          Add Character
        </Link>
      </div>

      {characters.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-surface p-8">
          <h2 className="font-display text-xl text-text-primary">
            Your journey starts here
          </h2>
          <p className="mt-2 text-text-muted">
            Add a character to bring their public Blizzard profile into
            Lanternmere.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => {
            const snapshot = character.character_snapshots[0];
            const parsed = displayProfileSchema.safeParse(
              snapshot?.snapshot_data,
            );
            const profile = parsed.success ? parsed.data : null;

            const name = profile?.name || character.character_name;
            const realm = profile?.realm?.name || character.realm_slug;
            const specialization = profile?.active_spec?.name;

            return (
              <Link
                key={character.id}
                href={`/travelers/${character.id}`}
                className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold text-text-primary">
                    {name}
                  </h2>
                  <span className="rounded-full bg-background px-2 py-1 text-xs text-accent">
                    {character.is_main ? 'Main' : 'Alternate'}
                  </span>
                </div>

                <p className="mt-2 text-sm text-text-muted">
                  {realm} · {character.region.toUpperCase()}
                </p>

                <p className="mt-4 text-text-primary">
                  Level {character.level ?? '?'} ·{' '}
                  {character.class ?? 'Unknown class'}
                </p>

                <p className="mt-1 text-sm text-text-muted">
                  {[specialization, character.faction]
                    .filter(Boolean)
                    .join(' · ') || 'Details unavailable'}
                </p>

                <div className="mt-6 border-t border-border pt-4 text-xs text-text-muted">
                  <p>
                    Source:{' '}
                    {snapshot?.source === 'blizzard'
                      ? 'Blizzard'
                      : snapshot?.source ?? 'Unavailable'}
                  </p>

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