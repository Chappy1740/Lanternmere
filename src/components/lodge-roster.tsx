import Link from 'next/link';
import { getViewer, getLodgeMemberships } from '@/lib/hearth/context';
import { loadLodgeRoster } from '@/lib/hearth/roster';
import { CharacterFreshness } from '@/components/character-freshness';

export async function LodgeRoster({ lodgeId }: { lodgeId: string }) {
  const [{ supabase, user }, memberships] = await Promise.all([getViewer(), getLodgeMemberships()]);
  const membership = memberships.find((row) => row.lodge_id === lodgeId);
  if (!membership) return null;
  const result = await loadLodgeRoster(supabase, lodgeId);
  return (
    <section
      aria-labelledby="roster-heading"
      className="lodge-panel p-6 sm:p-8"
    >
      <p className="lodge-kicker">Lodge company</p>
      <h2 id="roster-heading" className="font-display text-text-primary mt-2 text-xl font-bold">
        Around the Hearth
      </h2>
      {result.state === 'error' ? (
        <p className="text-text-muted mt-4">
          The Lodge roster could not be loaded right now. Please try again later.
        </p>
      ) : (
        <>
          <p className="text-text-muted mt-2 break-words">
            {result.total} {result.total === 1 ? 'member' : 'members'} in {membership.lodges.name}
          </p>
          {result.total === 1 && (
            <p className="text-text-primary mt-3">
              You have the Hearth to yourself for now. There is room for more company.
            </p>
          )}
          {result.total === 0 && (
            <p className="text-text-muted mt-3">No members are available to display.</p>
          )}
          {result.charactersUnavailable && (
            <p className="text-text-muted mt-3">
              Shared Main characters are temporarily unavailable.
            </p>
          )}
          <ul className="mt-5 space-y-3">
            {result.members.map((member) => {
              const main = result.mains.get(member.profile_id);
              return (
                <li key={member.profile_id} className="lodge-list-row p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-text-primary font-medium break-words">
                      {member.profiles?.display_name.trim() || 'Name unavailable'}
                      {member.profile_id === user.id ? ' (you)' : ''}
                    </h3>
                    <span className="text-text-muted text-sm capitalize">{member.role}</span>
                  </div>
                  {main ? (
                    <div className="mt-2 space-y-1">
                      <Link
                        href={`/travelers/${main.id}`}
                        className="text-accent hover:text-accent-hover focus-visible:outline-accent rounded break-words underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        {main.character_name} · {main.realm_slug} · {main.region.toUpperCase()}
                      </Link>
                      <p className="text-text-muted text-sm">Main shared with this Lodge</p>
                      <CharacterFreshness
                        refreshedAt={main.character_snapshots[0]?.last_refreshed_at}
                      />
                    </div>
                  ) : (
                    !result.charactersUnavailable && (
                      <p className="text-text-muted mt-2 text-sm">
                        No Main character shared with this Lodge.
                      </p>
                    )
                  )}
                </li>
              );
            })}
          </ul>
          {result.total > result.members.length && (
            <p className="text-text-muted mt-4 text-sm">
              Showing {result.members.length} of {result.total} members.
            </p>
          )}
        </>
      )}
    </section>
  );
}
