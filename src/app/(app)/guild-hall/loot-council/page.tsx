import { notFound } from 'next/navigation';
import { GuildLootCouncil } from '@/components/guild-raid-room';
import {
  getGuildMemberships,
  isGuildLeadership,
  loadGuildMembers,
  loadGuildRaidLoot,
  loadGuildRaidLootOperations,
} from '@/lib/guilds';

export default async function LootCouncilPage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string | string[]; operation?: string | string[] }>;
}) {
  const [memberships, params] = await Promise.all([getGuildMemberships(), searchParams]);
  const membership = memberships.find((entry) => entry.guild_id === params.guild);
  if (!membership) notFound();
  const roles = membership.guild_member_roles.map((entry) => entry.role);
  if (!roles.includes('loot_council') && !isGuildLeadership(roles)) notFound();

  const operations = await loadGuildRaidLootOperations(membership.guild_id);
  if (!operations) notFound();
  const operation = params.operation
    ? operations.find((entry) => entry.id === params.operation)
    : null;
  if (params.operation && !operation) notFound();

  const [guildMembers, loot] = operation
    ? await Promise.all([loadGuildMembers(membership.guild_id), loadGuildRaidLoot(operation.id)])
    : [null, null];
  if (operation && (!guildMembers || !loot)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="lodge-panel p-5 sm:p-7">
        <a
          href={`/guild-hall?guild=${membership.guild_id}`}
          className="text-accent text-sm underline underline-offset-4"
        >
          Back to Guild Hall
        </a>
        <p className="lodge-kicker mt-5">Loot Council</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          {operation?.title ?? 'Guild raid loot'}
        </h1>
        <p className="text-text-muted mt-2 text-sm">
          {operation
            ? `${operation.event_date}${operation.event_time ? ` · ${operation.event_time.slice(0, 5)} UTC` : ''}`
            : 'Choose an authorized Guild raid operation.'}
        </p>
        <p className="text-text-muted mt-3 text-xs">
          This role sees only linked raid titles and dates, Guild members, and loot decisions—not
          Lodge events or RSVPs, roster plans, or encounter strategies.
        </p>
      </header>

      <nav aria-label="Loot Council raids" className="lodge-panel p-5 sm:p-6">
        <h2 className="font-display text-text-primary text-xl font-bold">Raid operations</h2>
        {operations.length ? (
          <ul className="mt-4 space-y-2">
            {operations.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`/guild-hall/loot-council?guild=${membership.guild_id}&operation=${entry.id}`}
                  className="lodge-list-row text-accent block p-3 text-sm underline underline-offset-4"
                  aria-current={entry.id === operation?.id ? 'page' : undefined}
                >
                  {entry.title} · {entry.event_date}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted mt-3 text-sm">No authorized raid operations yet.</p>
        )}
      </nav>

      {operation && guildMembers && loot && (
        <GuildLootCouncil
          operationId={operation.id}
          guildMembers={guildMembers.map(({ id, profiles }) => ({ id, profiles }))}
          {...loot}
        />
      )}
    </div>
  );
}
