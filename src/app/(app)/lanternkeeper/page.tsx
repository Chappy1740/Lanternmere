import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpenCheck, Sparkles } from 'lucide-react';
import { LanternkeeperSummary } from '@/components/lanternkeeper-summary';
import { getGuildMemberships, isGuildLeadership } from '@/lib/guilds';
import { getLanternkeeperBrief, type BriefingView } from '@/lib/lanternkeeper/briefing';
import { getLanternkeeperProvider } from '@/lib/lanternkeeper/provider';
import { findLanternkeeperDestination } from '@/lib/lanternkeeper/navigation';

const views: { key: BriefingView; label: string; description: string }[] = [
  { key: 'weekly', label: 'This week', description: 'Guild operations at a glance' },
  {
    key: 'raid',
    label: 'Prepare for the next raid',
    description: 'Roster and confirmation context',
  },
  { key: 'changes', label: 'Since the last raid', description: 'Recent records and history' },
];

export default async function LanternkeeperPage({
  searchParams,
}: {
  searchParams: Promise<{
    guild?: string | string[];
    view?: string | string[];
    question?: string | string[];
  }>;
}) {
  const [params, memberships] = await Promise.all([searchParams, getGuildMemberships()]);
  const leaders = memberships.filter(
    (membership) =>
      membership.verified &&
      isGuildLeadership(membership.guild_member_roles.map((entry) => entry.role)),
  );
  const selected =
    params.guild === undefined
      ? leaders[0]
      : typeof params.guild === 'string'
        ? leaders.find((membership) => membership.guild_id === params.guild)
        : undefined;
  if (params.guild !== undefined && !selected) notFound();
  const view: BriefingView =
    params.view === 'raid' || params.view === 'changes' ? params.view : 'weekly';
  const briefing = selected ? await getLanternkeeperBrief(selected.guild_id, view) : null;
  const question = typeof params.question === 'string' ? params.question.trim().slice(0, 160) : '';
  const destination =
    briefing && question ? findLanternkeeperDestination(question, briefing.guildId) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="text-accent flex items-center gap-2 text-sm font-medium tracking-[0.16em] uppercase">
          <Sparkles size={18} aria-hidden="true" /> Guild intelligence
        </p>
        <h1 className="font-display text-text-primary mt-3 text-3xl font-bold sm:text-4xl">
          The Lanternkeeper
        </h1>
        <p className="text-text-muted mt-3 max-w-2xl">
          A read-only briefing from Guild records you are allowed to see. Open any item to check the
          source and make your own call.
        </p>
      </header>

      {leaders.length > 1 && (
        <nav aria-label="Choose Guild" className="flex flex-wrap gap-2">
          {leaders.map((membership) => (
            <Link
              key={membership.guild_id}
              href={`/lanternkeeper?guild=${membership.guild_id}&view=${view}`}
              aria-current={selected?.guild_id === membership.guild_id ? 'page' : undefined}
              className="lodge-button-secondary px-4 py-2 text-sm"
            >
              {membership.guilds.name}
            </Link>
          ))}
        </nav>
      )}

      {briefing ? (
        <>
          <nav aria-label="Briefing type" className="grid gap-3 sm:grid-cols-3">
            {views.map((item) => (
              <Link
                key={item.key}
                href={`/lanternkeeper?guild=${briefing.guildId}&view=${item.key}`}
                aria-current={view === item.key ? 'page' : undefined}
                className="lodge-panel p-4 hover:underline"
              >
                <strong className="text-text-primary block">{item.label}</strong>
                <span className="text-text-muted mt-1 block text-sm">{item.description}</span>
              </Link>
            ))}
          </nav>
          <section aria-labelledby="find-records-heading" className="lodge-panel p-6 sm:p-8">
            <h2
              id="find-records-heading"
              className="font-display text-text-primary text-2xl font-bold"
            >
              Find the right page
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Ask where to find a record. This searches a small list of Lanternmere destinations; it
              does not search private notes or the web.
            </p>
            <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="guild" value={briefing.guildId} />
              <input type="hidden" name="view" value={view} />
              <label className="text-text-primary flex min-w-52 flex-1 flex-col gap-1 text-sm">
                Where can I find…
                <input
                  name="question"
                  type="search"
                  maxLength={160}
                  defaultValue={question}
                  placeholder="boss kills, loot, recruitment…"
                  className="lodge-input px-3 py-2"
                />
              </label>
              <button type="submit" className="lodge-button-secondary px-4 py-2 text-sm">
                Find page
              </button>
            </form>
            {question &&
              (destination ? (
                <p className="text-text-muted mt-4 text-sm">
                  <Link href={destination.href} className="text-accent font-medium underline">
                    Open {destination.label}
                  </Link>{' '}
                  · {destination.explanation}
                </p>
              ) : (
                <p role="status" className="text-text-muted mt-4 text-sm">
                  No matching destination. Try raid, loot, crafting, recruitment, Vault, or boss
                  kills.
                </p>
              ))}
          </section>
          <LanternkeeperSummary
            key={`${briefing.guildId}:${view}`}
            guildId={briefing.guildId}
            view={view}
            enabled={!!getLanternkeeperProvider()}
          />
          <section aria-labelledby="briefing-heading" className="lodge-panel p-6 sm:p-8">
            <h2 id="briefing-heading" className="font-display text-text-primary text-2xl font-bold">
              {views.find((item) => item.key === view)?.label} · {briefing.guild}
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Generated from current records at{' '}
              {new Date(briefing.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC.
              Date windows use UTC.
            </p>
            <ul className="mt-5 space-y-3">
              {briefing.facts.map((fact) => (
                <li key={fact.id} className="lodge-list-row p-4">
                  <span className="text-accent text-xs font-semibold tracking-wide uppercase">
                    {fact.source}
                  </span>
                  <p className="text-text-primary mt-1">{fact.text}</p>
                  <Link
                    href={fact.href}
                    className="text-accent mt-2 inline-block text-sm underline"
                  >
                    Open source records
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <p className="text-text-muted px-1 text-sm">
            These facts help you review the week. They do not award loot, change a roster, decide
            applications, or rate players. For trusted outside guides, open the{' '}
            <Link href="/supply-chest" className="text-accent underline">
              Supply Chest
            </Link>
            .
          </p>
        </>
      ) : (
        <section className="lodge-panel p-6 sm:p-8">
          <BookOpenCheck className="text-accent" size={28} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-2xl font-bold">
            Guild leadership verification needed
          </h2>
          <p className="text-text-muted mt-2">
            Briefings use private Guild operations. A current verified Guild leadership claim is
            required.
          </p>
          <Link href="/guild-hall" className="text-accent mt-4 inline-block underline">
            Check your Guild Hall
          </Link>
        </section>
      )}
    </main>
  );
}
