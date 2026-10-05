import Link from 'next/link';
import Image from 'next/image';
import { LodgeActivity } from '@/components/lodge-activity';
import { LodgeRoster } from '@/components/lodge-roster';
import { notFound } from 'next/navigation';
import { Flame } from 'lucide-react';
import { z } from 'zod';
import { MainCharacterHighlight } from '@/components/main-character-highlight';
import { getViewer, getOptionalLodgeMemberships } from '@/lib/hearth/context';

export default async function HearthPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [memberships, params, { supabase, user }] = await Promise.all([
    getOptionalLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  // Never use a URL-supplied Lodge until it matches a verified membership.
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : memberships.find((membership) => membership.lodge_id === params.lodge);
  if (params.lodge !== undefined && !selected) notFound();
  const lodge = selected?.lodges;
  let displayName: string | undefined;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && typeof data?.display_name === 'string')
      displayName = data.display_name.trim() || undefined;
  } catch {
    // The greeting is optional; keep the personal Hearth usable.
  }
  const { data: alternateData, error: alternateError } = await supabase
    .from('characters')
    .select('id, character_name, realm_slug, region, level')
    .eq('profile_id', user.id)
    .eq('is_main', false)
    .order('level', { ascending: false })
    .limit(6);
  const alternateSchema = z.array(
    z.object({
      id: z.uuid(),
      character_name: z.string(),
      realm_slug: z.string(),
      region: z.string(),
      level: z.number().nullable(),
    }),
  );
  const parsedAlternates = alternateSchema.safeParse(alternateData);
  const alternates = !alternateError && parsedAlternates.success ? parsedAlternates.data : [];

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-8">
      <header className="lodge-panel relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <Image
          src="/brand/lanternmere-lodge-hero-v1.png"
          alt=""
          fill
          priority
          className="object-cover object-[66%_center] opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,17,29,0.94),rgba(9,17,29,0.66)_56%,rgba(9,17,29,0.25)),linear-gradient(0deg,rgba(9,17,29,0.72),transparent)]" />
        <div className="relative">
          <p className="text-accent mb-2 flex items-center gap-2 text-sm font-medium tracking-[0.16em] uppercase">
            <Flame size={18} aria-hidden="true" /> A place to return to
          </p>
          <h2 className="font-display text-text-primary text-2xl font-bold sm:text-3xl">
            The Hearth
          </h2>
          <p className="text-text-primary mt-2 text-base break-words">
            {displayName ? `Welcome back, ${displayName}.` : 'Welcome back.'}
          </p>
          <p className="text-text-muted mt-2">Settle in. Your next chapter starts here.</p>
        </div>
      </header>

      <MainCharacterHighlight />
      <details className="text-text-muted text-xs">
        <summary className="cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-offset-4">
          Sources and inspiration
        </summary>
        <aside
          aria-label="Sources and design credit"
          className="text-text-muted flex min-w-0 flex-wrap items-center gap-2 text-xs"
        >
          <span>Data sources:</span>
          <a
            href="https://develop.battle.net/documentation/world-of-warcraft/profile-apis"
            target="_blank"
            rel="noopener noreferrer"
            className="lodge-button-secondary px-3 py-2"
          >
            Blizzard
          </a>
          <a
            href="https://raider.io/api"
            target="_blank"
            rel="noopener noreferrer"
            className="lodge-button-secondary px-3 py-2"
          >
            Raider.IO
          </a>
          <a
            href="https://wowaudit.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="lodge-button-secondary px-3 py-2"
          >
            Layout inspiration: WoWAudit
          </a>
          <span>Independent Lanternmere design.</span>
        </aside>
      </details>

      {alternates.length > 0 && (
        <section className="space-y-3" aria-labelledby="alternates-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="alternates-heading" className="font-display text-text-primary text-2xl">
              Your alternates
            </h2>
            <Link href="/travelers" className="text-accent text-sm underline underline-offset-4">
              View all Travelers
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alternates.map((character) => (
              <li key={character.id} className="lodge-panel min-w-0 p-4">
                <Link
                  href={`/travelers/${character.id}`}
                  className="text-text-primary hover:text-accent block font-semibold [overflow-wrap:anywhere] break-words"
                >
                  {character.character_name}
                </Link>
                <p className="text-text-muted mt-1 text-sm [overflow-wrap:anywhere] break-words">
                  {character.realm_slug} · {character.region.toUpperCase()} · Level{' '}
                  {character.level ?? 'unknown'}
                </p>
                <Link
                  href={`/travelers/${character.id}`}
                  className="text-accent mt-3 inline-block text-xs underline underline-offset-4"
                >
                  Open or make Main
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="space-y-5">
        <summary className="font-display text-text-primary cursor-pointer rounded py-3 text-xl focus-visible:outline-2 focus-visible:outline-offset-4">
          {lodge ? `Your Lodge · ${lodge.name}` : 'Lodge and community (optional)'}
        </summary>
        {selected && lodge ? (
          <section aria-labelledby="lodge-heading" className="lodge-panel p-6 sm:p-8">
            <p className="text-accent text-sm font-medium tracking-[0.14em] uppercase">
              Your Lodge
            </p>
            <h2
              id="lodge-heading"
              className="font-display text-text-primary mt-2 text-2xl font-bold break-words"
            >
              {lodge.name}
            </h2>
            {lodge.description?.trim() && (
              <p className="text-text-primary mt-3 max-w-2xl break-words whitespace-pre-line">
                {lodge.description}
              </p>
            )}
            <p className="text-text-muted mt-4 text-sm">
              Your role: <span className="capitalize">{selected.role}</span>
            </p>
            <Link
              href="/travelers"
              className="lodge-button-secondary focus-visible:outline-accent mt-6 inline-block px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Visit your Travelers
            </Link>
            {selected.role === 'owner' && (
              <Link
                href={`/caretakers-office?lodge=${lodge.id}`}
                className="text-accent focus-visible:outline-accent mt-4 ml-4 inline-block text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                Edit this Lodge
              </Link>
            )}
          </section>
        ) : (
          <section className="lodge-panel p-6 sm:p-8" aria-labelledby="lodge-heading">
            <p className="lodge-kicker">Optional company</p>
            <h2 id="lodge-heading" className="font-display text-text-primary mt-2 text-2xl">
              Your Lodge can come later
            </h2>
            <p className="text-text-muted mt-3">
              Your Hearth and Main Traveler belong to you. Join or create a Lodge when you are ready
              to gather with others.
            </p>
            <Link href="/lodges/new" className="lodge-button-secondary mt-5 inline-block px-4 py-2">
              Create a Lodge
            </Link>
          </section>
        )}

        {selected && lodge && (
          <>
            <LodgeRoster lodgeId={lodge.id} />
            <LodgeActivity lodgeId={lodge.id} />
          </>
        )}

        {selected && lodge && memberships.length > 1 && (
          <nav aria-label="Choose a Lodge">
            <h2 className="font-display text-text-primary text-lg">Gather at another Lodge</h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {memberships.map((membership) => (
                <li key={membership.lodge_id}>
                  <Link
                    href={`/hearth?lodge=${membership.lodge_id}`}
                    aria-current={membership.lodge_id === lodge.id ? 'page' : undefined}
                    className="lodge-button-secondary focus-visible:outline-accent block px-4 py-2 break-words focus-visible:outline-2 focus-visible:outline-offset-4"
                  >
                    {membership.lodges.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </details>
    </div>
  );
}
