import { notFound } from 'next/navigation';
import { GuildRaidRoom } from '@/components/guild-raid-room';
import {
  getGuildMemberships,
  isGuildLeadership,
  loadGuildMembers,
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
  const [operations, guildMembers, workspace, loot, readiness] = await Promise.all([
    loadGuildRaidOperations(membership.guild_id),
    loadGuildMembers(membership.guild_id),
    loadGuildRaidEncounters(params.operation),
    loadGuildRaidLoot(params.operation),
    loadGuildReadiness(membership.guild_id),
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
    />
  );
}
