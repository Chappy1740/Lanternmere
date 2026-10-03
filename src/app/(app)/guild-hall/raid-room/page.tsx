import { notFound } from 'next/navigation';
import { GuildRaidRoom } from '@/components/guild-raid-room';
import {
  getGuildMemberships,
  isGuildLeadership,
  loadGuildMembers,
  loadGuildRaidAudit,
  loadGuildRaidEncounters,
  loadGuildRaidLoot,
  loadGuildRaidOperations,
  loadGuildReadiness,
} from '@/lib/guilds';

export default async function RaidRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string; operation?: string }>;
}) {
  const [memberships, params] = await Promise.all([getGuildMemberships(), searchParams]);
  const membership = memberships.find((entry) => entry.guild_id === params.guild);
  if (
    !membership ||
    !params.operation ||
    !isGuildLeadership(membership.guild_member_roles.map((entry) => entry.role))
  )
    notFound();
  const canViewAudit = membership.guild_member_roles.some((entry) =>
    entry.role === 'guild_master' || entry.role === 'officer');
  const [operations, guildMembers, workspace, loot, readiness, auditEvents] = await Promise.all([
    loadGuildRaidOperations(membership.guild_id),
    loadGuildMembers(membership.guild_id),
    loadGuildRaidEncounters(params.operation),
    loadGuildRaidLoot(params.operation),
    loadGuildReadiness(membership.guild_id),
    canViewAudit ? loadGuildRaidAudit(membership.guild_id) : Promise.resolve(null),
  ]);
  if (!operations || !guildMembers || !workspace || !loot) notFound();
  const operation = operations?.operations.find((entry) => entry.id === params.operation);
  if (!operation) notFound();
  return (
    <GuildRaidRoom
      guildId={membership.guild_id}
      operation={operation}
      guildMembers={guildMembers}
      plannedMembers={operations.members.filter((entry) => entry.operation_id === operation.id)}
      attendance={operations.attendance.filter((entry) => entry.operation_id === operation.id)}
      readiness={readiness.map((character) => ({
        id: character.id,
        name: character.character_name,
        className: character.class,
        spec: character.character_snapshots[0]?.snapshot_data.active_spec?.name ?? null,
      }))}
      {...workspace}
      loot={loot}
      auditEvents={auditEvents}
    />
  );
}
