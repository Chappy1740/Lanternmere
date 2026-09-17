import Link from 'next/link';
import { LodgeActivity } from '@/components/lodge-activity';
import { LodgeRoster } from '@/components/lodge-roster';
import { notFound } from 'next/navigation';
import { Flame } from 'lucide-react';
import { MainCharacterHighlight } from '@/components/main-character-highlight';
import { getViewer, getLodgeMemberships } from '@/lib/hearth/context';

export default async function HearthPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [memberships, params, { supabase, user }] = await Promise.all([
    getLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  // Never use a URL-supplied Lodge until it matches a verified membership.
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : memberships.find((membership) => membership.lodge_id === params.lodge);
  if (!selected) notFound();
  const lodge = selected.lodges;
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
    // The greeting is optional; keep the verified Lodge context usable.
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-border border-b pb-6">
        <p className="text-accent mb-3 flex items-center gap-2 text-sm">
          <Flame size={18} aria-hidden="true" /> A place to return to
        </p>
        <h1 className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
          The Hearth
        </h1>
        <p className="text-text-primary mt-4 text-xl break-words">
          {displayName ? `Welcome back, ${displayName}.` : 'Welcome back.'}
        </p>
        <p className="text-text-muted mt-2">Settle in. Your next chapter starts here.</p>
      </header>

      <section
        aria-labelledby="lodge-heading"
        className="border-border bg-surface rounded-lg border p-6 sm:p-8"
      >
        <p className="text-accent text-sm">Your Lodge</p>
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
          className="text-accent hover:text-accent-hover focus-visible:outline-accent mt-6 inline-block rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Visit your Travelers
        </Link>
      </section>

      <MainCharacterHighlight />
      <LodgeRoster lodgeId={lodge.id} />
      <LodgeActivity lodgeId={lodge.id} />

      {memberships.length > 1 && (
        <nav aria-label="Choose a Lodge">
          <h2 className="font-display text-text-primary text-lg">Gather at another Lodge</h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {memberships.map((membership) => (
              <li key={membership.lodge_id}>
                <Link
                  href={`/hearth?lodge=${membership.lodge_id}`}
                  aria-current={membership.lodge_id === lodge.id ? 'page' : undefined}
                  className="border-border text-accent hover:bg-surface focus-visible:outline-accent block rounded-md border px-4 py-2 break-words focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {membership.lodges.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
