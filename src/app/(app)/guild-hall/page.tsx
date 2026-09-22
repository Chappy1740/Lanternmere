import { Building2, Crown, ShieldCheck, Swords } from 'lucide-react';
import { notFound } from 'next/navigation';
import { GuildCreationForm } from '@/components/guild-creation-form';
import { GuildMemberPortalControl } from '@/components/guild-member-portal-control';
import { GuildMemberRemovalControl } from '@/components/guild-member-removal-control';
import { GuildLeaveControl } from '@/components/guild-leave-control';
import { GuildCharacterSharingControl } from '@/components/guild-character-sharing-control';
import { GuildMemberRoleControl } from '@/components/guild-member-role-control';
import {
  GuildOwnershipTransferAccept,
  GuildOwnershipTransferCancel,
  GuildOwnershipTransferRequest,
} from '@/components/guild-ownership-transfer-controls';
import { GuildInvitationForm } from '@/components/guild-invitation-form';
import { GuildRosterImportForm } from '@/components/guild-roster-import-form';
import { GuildRankLabelForm } from '@/components/guild-rank-label-form';
import {
  getGuildMemberships,
  loadGuildMembers,
  loadGuildReadiness,
  loadOwnGuildCharacters,
  loadPendingGuildOwnershipTransfer,
  loadGuildRoster,
  loadGuildRankLabels,
  guildRoleLabel,
  isGuildLeadership,
  type GuildRole,
} from '@/lib/guilds';

export default async function GuildHallPage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string | string[]; sort?: string | string[] }>;
}) {
  const [memberships, params] = await Promise.all([getGuildMemberships(), searchParams]);
  if (!memberships.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="lodge-panel p-7 sm:p-10">
          <Building2 className="text-accent" size={30} aria-hidden="true" />
          <p className="lodge-kicker mt-6">The Guild Hall</p>
          <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
            Establish a Guild workspace
          </h1>
          <p className="text-text-muted mt-4 leading-7">
            Guilds are independent of Lodges. Creating one makes you its Guild Master; character and
            external-data sharing remain opt-in for every member.
          </p>
          <GuildCreationForm />
        </section>
      </div>
    );
  }

  const selected =
    params.guild === undefined
      ? memberships[0]
      : typeof params.guild === 'string'
        ? memberships.find((membership) => membership.guild_id === params.guild)
        : undefined;
  if (!selected) notFound();
  const roles = selected.guild_member_roles.map((entry) => entry.role as GuildRole);
  const leadership = isGuildLeadership(roles);
  const canManage = roles.includes('guild_master') || roles.includes('officer');
  const sort = params.sort === 'name' || params.sort === 'class' ? params.sort : 'rank';
  const [roster, rankLabels, guildMembers, ownershipTransfer, ownCharacters, readiness] =
    await Promise.all([
      leadership || selected.guilds.member_portal_enabled
        ? await loadGuildRoster(selected.guild_id, sort)
        : null,
      loadGuildRankLabels(selected.guild_id),
      leadership ? loadGuildMembers(selected.guild_id) : null,
      loadPendingGuildOwnershipTransfer(selected.guild_id),
      loadOwnGuildCharacters(selected.guild_id),
      leadership ? loadGuildReadiness(selected.guild_id) : Promise.resolve([]),
    ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="text-accent flex items-center gap-2 text-sm">
          <Building2 size={18} aria-hidden="true" /> The Guild Hall
        </p>
        <h1 className="font-display text-text-primary mt-3 text-3xl font-bold sm:text-4xl">
          {selected.guilds.name}
        </h1>
        <p className="text-text-muted mt-3">
          {selected.guilds.description || 'A Guild workspace, separate from every Lodge.'}
        </p>
        <p className="text-text-muted mt-4 text-sm">
          Your role{roles.length === 1 ? '' : 's'}:{' '}
          {roles.map(guildRoleLabel).join(' · ') || 'Member'}
        </p>
      </header>

      {memberships.length > 1 && (
        <nav aria-label="Your Guilds" className="flex flex-wrap gap-3">
          {memberships.map((membership) => (
            <a
              key={membership.guild_id}
              href={`/guild-hall?guild=${membership.guild_id}`}
              className="lodge-button-secondary px-4 py-2 text-sm font-medium"
            >
              {membership.guilds.name}
            </a>
          ))}
        </nav>
      )}

      <section className="lodge-panel p-6">
        <p className="lodge-kicker">Membership</p>
        <h2 className="font-display text-text-primary mt-2 text-xl font-bold">Leave this Guild</h2>
        <p className="text-text-muted mt-2 text-sm">
          Leaving revokes any Guild-specific character sharing. Your Travelers and Lodge memberships
          are unchanged.
        </p>
        <GuildLeaveControl
          guildId={selected.guild_id}
          isGuildMaster={roles.includes('guild_master')}
        />
      </section>

      <section className="lodge-panel p-6">
        <p className="lodge-kicker">Traveler consent</p>
        <h2 className="font-display text-text-primary mt-2 text-xl font-bold">
          Share your Travelers
        </h2>
        <p className="text-text-muted mt-2 text-sm">
          This is Guild-only consent and does not alter Lodge sharing or the official roster.
        </p>
        <div className="mt-4 space-y-3">
          {ownCharacters.map((character) => (
            <div
              key={character.id}
              className="lodge-list-row flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <p className="text-sm">
                {character.character_name} · {character.class ?? 'Unknown class'}
              </p>
              <GuildCharacterSharingControl
                guildId={selected.guild_id}
                characterId={character.id}
                visibility={
                  character.character_guild_sharing.find(
                    (sharing) => sharing.guild_id === selected.guild_id,
                  )?.visibility
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="lodge-panel p-6">
          <Swords className="text-accent" size={24} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-xl font-bold">Raid operations</h2>
          <p className="text-text-muted mt-3 leading-6">
            Raid planning, attendance, assignments, and Loot Council workflows will appear here in
            their own Guild-owned records.
          </p>
        </div>
        <div className="lodge-panel p-6">
          <ShieldCheck className="text-accent" size={24} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-xl font-bold">Access boundary</h2>
          <p className="text-text-muted mt-3 leading-6">
            {leadership
              ? 'Leadership access is active. Guild settings and invitations are the next foundation surface.'
              : selected.guilds.member_portal_enabled
                ? 'The member portal is enabled. Leadership-only operational information remains private.'
                : 'This Guild currently uses leadership-only access.'}
          </p>
        </div>
      </section>

      {leadership && (
        <section className="lodge-panel p-6">
          <p className="lodge-kicker">Guild readiness</p>
          <h2 className="font-display text-text-primary mt-2 text-2xl font-bold">
            Consented Travelers
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Only explicitly Guild-shared Travelers appear here. Snapshot freshness is shown without
            changing the source record.
          </p>
          {readiness.length ? (
            <ul className="mt-4 space-y-2">
              {readiness.map((character) => (
                <li key={character.id} className="lodge-list-row p-3 text-sm">
                  {character.character_name} · {character.class ?? 'Unknown class'} ·{' '}
                  {character.character_guild_sharing[0]?.visibility === 'members'
                    ? 'Shared with members'
                    : 'Leadership-only'}{' '}
                  ·{' '}
                  {character.character_snapshots[0]?.last_refreshed_at
                    ? `Snapshot ${new Date(character.character_snapshots[0].last_refreshed_at).toLocaleDateString('en-US', { timeZone: 'UTC' })} UTC`
                    : 'No saved snapshot'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted mt-4 text-sm">
              No Travelers have been shared with this Guild yet.
            </p>
          )}
        </section>
      )}

      {roster && (
        <section className="lodge-panel p-6 sm:p-8" aria-labelledby="roster-heading">
          <p className="lodge-kicker">Official Blizzard roster</p>
          <h2
            id="roster-heading"
            className="font-display text-text-primary mt-2 text-2xl font-bold"
          >
            {roster.snapshot.guild_name} · {roster.snapshot.realm_slug}
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Imported{' '}
            {new Intl.DateTimeFormat('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
            }).format(new Date(roster.snapshot.refreshed_at))}{' '}
            UTC. Showing the first {roster.entries.length} entries.
          </p>
          <nav aria-label="Roster sorting" className="mt-4 flex gap-2 text-sm">
            {(['rank', 'name', 'class'] as const).map((option) => (
              <a
                key={option}
                href={`/guild-hall?guild=${selected.guild_id}&sort=${option}`}
                className="lodge-button-secondary px-3 py-1.5 capitalize"
              >
                Sort: {option}
              </a>
            ))}
          </nav>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {roster.entries.map((entry) => (
              <li
                key={`${entry.character_name}-${entry.realm_slug}`}
                className="lodge-list-row p-4"
              >
                <p className="text-text-primary font-medium">{entry.character_name}</p>
                <p className="text-text-muted mt-1 text-sm">
                  {entry.class_name ?? 'Class unavailable'} ·{' '}
                  {rankLabels.get(entry.rank_index) ?? `Guild rank ${entry.rank_index}`}
                </p>
                <p className="text-text-muted mt-1 text-xs">Unclaimed roster entry</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guildMembers && (
        <section className="lodge-panel p-6 sm:p-8" aria-labelledby="guild-members-heading">
          <p className="lodge-kicker">Guild members</p>
          <h2
            id="guild-members-heading"
            className="font-display text-text-primary mt-2 text-2xl font-bold"
          >
            Member operations
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Membership is separate from the Blizzard roster. Roles are additive and enforced on the
            server.
          </p>
          <ul className="mt-5 space-y-3">
            {guildMembers.map((member) => {
              const memberRoles = member.guild_member_roles.map((entry) => entry.role);
              const isMemberMaster = memberRoles.includes('guild_master');
              return (
                <li
                  key={member.id}
                  className="lodge-list-row flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div>
                    <p className="text-text-primary font-medium">
                      {member.profiles?.display_name ?? 'Guild member'}
                    </p>
                    <p className="text-text-muted mt-1 text-sm">
                      {memberRoles.length
                        ? memberRoles.map(guildRoleLabel).join(' · ')
                        : 'Guild Member'}
                    </p>
                  </div>
                  {!isMemberMaster && (
                    <div className="flex flex-wrap gap-2">
                      {(['officer', 'raid_leader', 'loot_council'] as const).map((role) => (
                        <GuildMemberRoleControl
                          key={role}
                          membershipId={member.id}
                          role={role}
                          enabled={memberRoles.includes(role)}
                          editable={
                            roles.includes('guild_master') ||
                            (roles.includes('officer') && role !== 'officer')
                          }
                        />
                      ))}
                      {roles.includes('guild_master') && (
                        <GuildMemberRemovalControl membershipId={member.id} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(roles.includes('guild_master') || ownershipTransfer?.to_member_id === selected.id) && (
        <section className="lodge-panel p-6" aria-labelledby="ownership-heading">
          <p className="lodge-kicker">Guild stewardship</p>
          <h2
            id="ownership-heading"
            className="font-display text-text-primary mt-2 text-2xl font-bold"
          >
            Guild Master ownership
          </h2>
          {ownershipTransfer ? (
            <>
              <p className="text-text-muted mt-3 text-sm">
                {ownershipTransfer.to_member_id === selected.id
                  ? 'You have a pending Guild Master ownership transfer. Accepting it is permanent until you explicitly transfer ownership again.'
                  : `A Guild Master transfer is awaiting the recipient’s acceptance until ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(ownershipTransfer.expires_at))} UTC.`}
              </p>
              {ownershipTransfer.to_member_id === selected.id ? (
                <GuildOwnershipTransferAccept transferId={ownershipTransfer.id} />
              ) : (
                <GuildOwnershipTransferCancel transferId={ownershipTransfer.id} />
              )}
            </>
          ) : (
            <>
              <p className="text-text-muted mt-3 text-sm">
                Transfer ownership only to a current Guild member. They must explicitly accept
                within seven days.
              </p>
              {roles.includes('guild_master') && guildMembers && (
                <GuildOwnershipTransferRequest
                  members={guildMembers
                    .filter(
                      (member) =>
                        !member.guild_member_roles.some((entry) => entry.role === 'guild_master'),
                    )
                    .map((member) => ({
                      id: member.id,
                      name: member.profiles?.display_name ?? 'Guild member',
                    }))}
                />
              )}
            </>
          )}
        </section>
      )}

      {canManage && (
        <section className="lodge-panel p-6">
          <p className="text-text-muted flex items-center gap-2 text-sm">
            <Crown size={16} className="text-accent" aria-hidden="true" />
            {roles.includes('guild_master')
              ? 'You are the sole Guild Master. Ownership transfer will require an explicit acceptance flow.'
              : 'Officers can configure member-facing Guild access.'}
          </p>
          <GuildMemberPortalControl
            guildId={selected.guild_id}
            enabled={selected.guilds.member_portal_enabled}
          />
          <GuildInvitationForm guildId={selected.guild_id} />
          <GuildRosterImportForm guildId={selected.guild_id} />
          {roster && (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium">Guild rank labels</p>
              {[...new Set(roster.entries.map((entry) => entry.rank_index))].map((rank) => (
                <GuildRankLabelForm
                  key={rank}
                  guildId={selected.guild_id}
                  rank={rank}
                  label={rankLabels.get(rank)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
