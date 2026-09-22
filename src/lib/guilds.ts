import 'server-only';

import { cache } from 'react';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';

const roleSchema = z.enum(['guild_master', 'officer', 'raid_leader', 'loot_council']);
const membershipSchema = z.object({
  id: z.uuid(),
  guild_id: z.uuid(),
  guild_member_roles: z.array(z.object({ role: roleSchema })),
  guilds: z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    member_portal_enabled: z.boolean(),
  }),
});

export type GuildRole = z.infer<typeof roleSchema>;
export type GuildMembership = z.infer<typeof membershipSchema>;

export const getGuildMemberships = cache(async () => {
  const { supabase, user } = await getViewer();
  const { data, error } = await supabase
    .from('guild_members')
    .select(
      'id, guild_id, guilds!inner(id, name, description, member_portal_enabled), guild_member_roles(role)',
    )
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .order('id', { ascending: true });
  const parsed = z.array(membershipSchema).safeParse(data);
  if (error || !parsed.success) throw new Error('Unable to verify Guild membership.');
  return parsed.data;
});

export function isGuildLeadership(roles: GuildRole[]) {
  return roles.some((role) => ['guild_master', 'officer', 'raid_leader'].includes(role));
}

export function guildRoleLabel(role: GuildRole) {
  return {
    guild_master: 'Guild Master',
    officer: 'Officer',
    raid_leader: 'Raid Leader',
    loot_council: 'Loot Council',
  }[role];
}

const guildMemberSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  joined_at: z.string(),
  profiles: z.object({ display_name: z.string() }).nullable(),
  guild_member_roles: z.array(z.object({ role: roleSchema })),
});

export type GuildMember = z.infer<typeof guildMemberSchema>;

export async function loadGuildMembers(guildId: string) {
  const { supabase } = await getViewer();
  const { data, error } = await supabase
    .from('guild_members')
    .select('id, profile_id, joined_at, profiles(display_name), guild_member_roles(role)')
    .eq('guild_id', guildId)
    .order('joined_at', { ascending: true });
  const parsed = z.array(guildMemberSchema).safeParse(data);
  return error || !parsed.success ? null : parsed.data;
}

const ownershipTransferSchema = z.object({
  id: z.uuid(),
  from_member_id: z.uuid(),
  to_member_id: z.uuid(),
  expires_at: z.string(),
});

export async function loadPendingGuildOwnershipTransfer(guildId: string) {
  const { supabase } = await getViewer();
  const { data, error } = await supabase
    .from('guild_ownership_transfers')
    .select('id, from_member_id, to_member_id, expires_at')
    .eq('guild_id', guildId)
    .is('accepted_at', null)
    .is('canceled_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  const parsed = ownershipTransferSchema.safeParse(data);
  return error || !parsed.success ? null : parsed.data;
}

const ownGuildCharacterSchema = z.object({
  id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  class: z.string().nullable(),
  character_guild_sharing: z.array(
    z.object({ guild_id: z.uuid(), visibility: z.enum(['leadership', 'members']) }),
  ),
});
export async function loadOwnGuildCharacters(_guildId: string) {
  const { supabase, user } = await getViewer();
  const { data, error } = await supabase
    .from('characters')
    .select(
      'id, character_name, realm_slug, class, character_guild_sharing(visibility, guild_id), games!inner(slug)',
    )
    .eq('profile_id', user.id)
    .eq('games.slug', 'wow')
    .order('character_name');
  const parsed = z.array(ownGuildCharacterSchema).safeParse(data);
  return error || !parsed.success ? [] : parsed.data;
}

export async function loadGuildReadiness(guildId: string) {
  const { supabase } = await getViewer();
  const { data, error } = await supabase
    .from('characters')
    .select(
      'id, character_name, realm_slug, class, character_guild_sharing!inner(visibility, guild_id), character_snapshots(last_refreshed_at)',
    )
    .eq('character_guild_sharing.guild_id', guildId)
    .order('character_name');
  const parsed = z
    .array(
      z.object({
        id: z.uuid(),
        character_name: z.string(),
        realm_slug: z.string(),
        class: z.string().nullable(),
        character_guild_sharing: z.array(
          z.object({ visibility: z.enum(['leadership', 'members']), guild_id: z.uuid() }),
        ),
        character_snapshots: z.array(z.object({ last_refreshed_at: z.string() })),
      }),
    )
    .safeParse(data);
  return error || !parsed.success ? [] : parsed.data;
}

const rosterEntrySchema = z.object({
  character_name: z.string(),
  realm_slug: z.string(),
  class_name: z.string().nullable(),
  rank_index: z.number().int(),
  source_refreshed_at: z.string(),
});
const rosterSnapshotSchema = z.object({
  guild_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  refreshed_at: z.string(),
});

export async function loadGuildRoster(guildId: string, sort: 'rank' | 'name' | 'class' = 'rank') {
  const { supabase } = await getViewer();
  const [snapshot, entries] = await Promise.all([
    supabase
      .from('guild_blizzard_roster_snapshots')
      .select('guild_name, realm_slug, region, refreshed_at')
      .eq('guild_id', guildId)
      .maybeSingle(),
    (() => {
      const query = supabase
        .from('guild_roster_entries')
        .select('character_name, realm_slug, class_name, rank_index, source_refreshed_at')
        .eq('guild_id', guildId);
      return sort === 'name'
        ? query.order('character_name').limit(50)
        : sort === 'class'
          ? query.order('class_name').order('character_name').limit(50)
          : query.order('rank_index').order('character_name').limit(50);
    })(),
  ]);
  const parsedSnapshot = rosterSnapshotSchema.safeParse(snapshot.data);
  const parsedEntries = z.array(rosterEntrySchema).safeParse(entries.data);
  return snapshot.error || entries.error || !parsedSnapshot.success || !parsedEntries.success
    ? null
    : { snapshot: parsedSnapshot.data, entries: parsedEntries.data };
}

export async function loadGuildRankLabels(guildId: string) {
  const { supabase } = await getViewer();
  const { data } = await supabase
    .from('guild_rank_labels')
    .select('rank_index, label')
    .eq('guild_id', guildId);
  return new Map(
    z.array(z.object({ rank_index: z.number().int(), label: z.string() })).safeParse(data).success
      ? (data as { rank_index: number; label: string }[]).map((row) => [row.rank_index, row.label])
      : [],
  );
}
