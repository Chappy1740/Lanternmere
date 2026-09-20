import Link from 'next/link';
import { BookOpen, Plus, Search } from 'lucide-react';
import { notFound } from 'next/navigation';
import { chronicleDate, chronicleExcerpt, loadChronicles } from '@/lib/chronicles';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function ChroniclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    lodge?: string | string[];
    q?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const [memberships, params, { supabase }] = await Promise.all([
    getLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : typeof params.lodge === 'string'
        ? memberships.find((membership) => membership.lodge_id === params.lodge)
        : undefined;
  if (!selected) notFound();
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : '';
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const from = typeof params.from === 'string' && date.test(params.from) ? params.from : '';
  const to = typeof params.to === 'string' && date.test(params.to) ? params.to : '';
  const entries = await loadChronicles(supabase, selected.lodge_id, query, { from, to });
  const lodgeId = selected.lodge_id;
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="lodge-panel flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-accent mb-3 flex items-center gap-2 text-sm">
            <BookOpen size={18} aria-hidden="true" /> Stories & memories
          </p>
          <h1 className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
            Chronicles
          </h1>
          <p className="text-text-muted mt-3">The shared history of {selected.lodges.name}.</p>
        </div>
        <Link
          href={`/chronicles/new?lodge=${lodgeId}`}
          className="lodge-button inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium"
        >
          <Plus size={18} aria-hidden="true" /> Record a memory
        </Link>
      </header>

      <form
        className="lodge-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
        role="search"
      >
        <input type="hidden" name="lodge" value={lodgeId} />
        <label className="sr-only" htmlFor="chronicle-search">
          Search shared memories
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
            size={17}
            aria-hidden="true"
          />
          <input
            id="chronicle-search"
            name="q"
            defaultValue={query}
            maxLength={80}
            placeholder="Search shared memories"
            className="lodge-field w-full py-2 pr-3 pl-10"
          />
        </div>
        <label className="text-text-muted flex flex-col gap-1 text-xs">
          From
          <input name="from" type="date" defaultValue={from} className="lodge-field px-2 py-2" />
        </label>
        <label className="text-text-muted flex flex-col gap-1 text-xs">
          To
          <input name="to" type="date" defaultValue={to} className="lodge-field px-2 py-2" />
        </label>
        <button type="submit" className="lodge-button-secondary px-4 py-2 text-sm font-medium">
          Search
        </button>
      </form>

      <section aria-labelledby="chronicle-list-heading" className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Lodge record</p>
        <h2
          id="chronicle-list-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          {query || from || to ? 'Matching memories' : 'Recent memories'}
        </h2>
        {entries === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Chronicles could not be loaded. Please try again later.
          </p>
        ) : entries.length === 0 ? (
          <div className="lodge-empty mt-5 p-6">
            <p className="text-text-primary font-medium">
              {query || from || to
                ? 'No shared memories matched those filters.'
                : 'The first page is waiting.'}
            </p>
            <p className="text-text-muted mt-2 text-sm">
              {query || from || to
                ? 'Try another search or adjust the date range.'
                : 'Record a Chronicle when your Lodge has a story worth keeping.'}
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="lodge-list-row p-5">
                <Link
                  href={`/chronicles/${entry.id}?lodge=${lodgeId}`}
                  className="font-display text-accent hover:text-accent-hover text-xl font-bold underline-offset-4 hover:underline"
                >
                  {entry.title?.trim() || 'Untitled Chronicle'}
                </Link>
                <p className="text-text-muted mt-2 text-sm">
                  {chronicleDate(entry.created_at)} ·{' '}
                  {entry.profiles?.display_name?.trim() || 'Lodge member'}
                </p>
                {chronicleExcerpt(entry.body) && (
                  <p className="text-text-primary mt-3 break-words">
                    {chronicleExcerpt(entry.body)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {memberships.length > 1 && (
        <nav aria-label="Choose a Lodge">
          <h2 className="font-display text-text-primary text-lg">
            View another Lodge&apos;s history
          </h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {memberships.map((membership) => (
              <li key={membership.lodge_id}>
                <Link
                  href={`/chronicles?lodge=${membership.lodge_id}`}
                  aria-current={membership.lodge_id === lodgeId ? 'page' : undefined}
                  className="border-border text-accent hover:bg-surface block rounded-md border px-4 py-2"
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
