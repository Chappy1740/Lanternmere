import 'server-only';

import { z } from 'zod';
import {
  getGuildMemberships,
  isGuildLeadership,
  isGuildRosterSnapshotFresh,
  loadGuildRaidOperations,
  loadGuildReadiness,
  loadGuildRoster,
} from '@/lib/guilds';
import { getViewer } from '@/lib/hearth/context';
import { canReadGuildAudit, recentChangesFact } from './recent-changes';

export type BriefingView = 'weekly' | 'raid' | 'changes';
export type BriefingFact = {
  id: string;
  text: string;
  source:
    'Lanternmere record' | 'External snapshot' | 'Player-entered information' | 'Missing data';
  href: string;
  modelValues?: number[];
  modelFreshness?: 'fresh' | 'stale';
};

const availabilitySchema = z.array(
  z.object({ availability_status: z.enum(['available', 'tentative', 'unavailable']) }),
);
const applicationSchema = z.array(
  z.object({
    status: z.enum(['submitted', 'reviewing', 'trial', 'accepted', 'declined', 'withdrawn']),
  }),
);
const auditSchema = z.array(z.object({ action: z.string(), created_at: z.string() }));

function utcDay(offset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function getLanternkeeperBrief(guildId: string, view: BriefingView) {
  const memberships = await getGuildMemberships();
  const membership = memberships.find((item) => item.guild_id === guildId);
  if (
    !membership?.verified ||
    !isGuildLeadership(membership.guild_member_roles.map((entry) => entry.role))
  ) {
    throw new Error('Guild leadership verification is required for this briefing.');
  }

  const { supabase } = await getViewer();
  const today = utcDay();
  const through = utcDay(7);
  const guildLink = `/guild-hall?guild=${guildId}`;
  const roles = membership.guild_member_roles.map((entry) => entry.role);
  const canRecruit = roles.some(
    (role) => role === 'guild_master' || role === 'officer' || role === 'recruiter',
  );
  const canReadAudit = canReadGuildAudit(roles);
  const [planning, readiness, roster, availabilityResult, applicationsResult, needsResult] =
    await Promise.all([
      loadGuildRaidOperations(guildId),
      loadGuildReadiness(guildId),
      loadGuildRoster(guildId),
      supabase
        .from('guild_member_availability')
        .select('availability_status')
        .eq('guild_id', guildId)
        .gte('ends_on', today)
        .lte('starts_on', through)
        .limit(200),
      canRecruit
        ? supabase
            .from('guild_applications')
            .select('status')
            .eq('guild_id', guildId)
            .in('status', ['submitted', 'reviewing', 'trial'])
            .limit(200)
        : Promise.resolve(null),
      canRecruit
        ? supabase
            .from('guild_recruitment_needs')
            .select('id')
            .eq('guild_id', guildId)
            .eq('active', true)
            .limit(200)
        : Promise.resolve(null),
    ]);

  const facts: BriefingFact[] = [];
  const lastRaid = planning
    ? [...planning.operations]
        .filter((operation) => operation.event_date < today)
        .sort((a, b) => b.event_date.localeCompare(a.event_date))[0]
    : undefined;
  const nextRaid = planning
    ? [...planning.operations]
        .filter((operation) => operation.event_date >= today && operation.event_date <= through)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))[0]
    : undefined;
  if (planning) {
    const upcoming = planning.operations
      .filter((operation) => operation.event_date >= today && operation.event_date <= through)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    if (view === 'raid') {
      const next = upcoming[0];
      const nextLink = next
        ? `/guild-hall/raid-room?guild=${guildId}&operation=${next.id}`
        : guildLink;
      facts.push(
        next
          ? {
              id: 'next-raid',
              text: `Next recorded raid: ${next.title} on ${next.event_date}${next.event_time ? ` at ${next.event_time}` : ''}. Times follow the event record.`,
              source: 'Lanternmere record',
              href: nextLink,
            }
          : {
              id: 'next-raid-missing',
              text: 'No raid operation is recorded in the next seven UTC dates.',
              source: 'Missing data',
              href: guildLink,
            },
      );
      if (next) {
        const planned = planning.members.filter((row) => row.operation_id === next.id);
        const confirmed = planning.attendance.filter(
          (row) => row.operation_id === next.id && row.attendance_status === 'confirmed',
        );
        facts.push({
          id: 'raid-confirmations',
          text: `${confirmed.length} confirmed attendance records and ${planned.length} roster planning entries for this raid. These are separate records.`,
          source: 'Lanternmere record',
          href: nextLink,
          modelValues: [confirmed.length, planned.length],
        });
      }
    } else {
      facts.push({
        id: 'weekly-raids',
        text: `${upcoming.length} raid operations recorded in the next seven UTC dates.`,
        source: 'Lanternmere record',
        href: guildLink,
        modelValues: [upcoming.length],
      });
      if (lastRaid && view === 'changes') {
        const attendance = planning.attendance.filter(
          (row) =>
            row.operation_id === lastRaid.id &&
            ['attended', 'late'].includes(row.attendance_status),
        );
        facts.push({
          id: 'last-raid',
          text: `Last recorded raid: ${lastRaid.title} on ${lastRaid.event_date}; ${attendance.length} attended or late attendance records. This is recorded attendance, not a player rating.`,
          source: 'Lanternmere record',
          href: `/guild-hall/raid-room?guild=${guildId}&operation=${lastRaid.id}`,
        });
      }
    }
  } else {
    facts.push({
      id: 'raid-unavailable',
      text: 'Raid planning records could not be loaded. Counts are withheld.',
      source: 'Missing data',
      href: guildLink,
    });
  }

  const availability = availabilityResult.error
    ? null
    : availabilitySchema.safeParse(availabilityResult.data);
  facts.push(
    availability?.success
      ? {
          id: 'availability',
          text: `${availability.data.filter((row) => row.availability_status === 'unavailable').length} unavailable and ${availability.data.filter((row) => row.availability_status === 'tentative').length} tentative entries overlap the next seven UTC dates${availability.data.length === 200 ? ' among the first 200 entries' : ''}. Entries are player-entered.`,
          source: 'Player-entered information',
          href: '/war-table',
          modelValues: [
            availability.data.filter((row) => row.availability_status === 'unavailable').length,
            availability.data.filter((row) => row.availability_status === 'tentative').length,
          ],
        }
      : {
          id: 'availability-unavailable',
          text: 'Availability could not be loaded.',
          source: 'Missing data',
          href: '/war-table',
        },
  );
  facts.push(
    readiness
      ? {
          id: 'readiness',
          text: `${readiness.length} explicitly Guild-shared character readiness records are visible to leadership. Unshared characters are excluded.`,
          source: 'Lanternmere record',
          href: guildLink,
          modelValues: [readiness.length],
        }
      : {
          id: 'readiness-unavailable',
          text: 'Shared readiness could not be loaded.',
          source: 'Missing data',
          href: guildLink,
        },
  );
  facts.push(
    roster?.snapshot
      ? {
          id: 'roster',
          text: `Official Blizzard roster snapshot: ${roster.total} entries, refreshed ${roster.snapshot.refreshed_at}. ${isGuildRosterSnapshotFresh(roster.snapshot.refreshed_at) ? 'Fresh by the 24-hour display rule.' : 'Stale by the 24-hour display rule.'}`,
          source: 'External snapshot',
          href: guildLink,
          modelValues: [roster.total],
          modelFreshness: isGuildRosterSnapshotFresh(roster.snapshot.refreshed_at)
            ? 'fresh'
            : 'stale',
        }
      : {
          id: 'roster-missing',
          text: 'No readable official roster snapshot is available.',
          source: 'Missing data',
          href: guildLink,
        },
  );
  if (canRecruit) {
    const applications = applicationsResult?.error
      ? null
      : applicationSchema.safeParse(applicationsResult?.data);
    facts.push(
      applications?.success
        ? {
            id: 'applications',
            text: `${applications.data.length} active applications or trials are visible${applications.data.length === 200 ? ' among the first 200 records' : ''}. Human review is required for decisions.`,
            source: 'Lanternmere record',
            href: `/muster?guild=${guildId}`,
            modelValues: [applications.data.length],
          }
        : {
            id: 'applications-unavailable',
            text: 'Recruitment applications could not be loaded.',
            source: 'Missing data',
            href: `/muster?guild=${guildId}`,
          },
    );
    facts.push(
      needsResult && !needsResult.error
        ? {
            id: 'recruitment',
            text: `${needsResult.data?.length ?? 0} active recruitment needs are recorded${needsResult.data?.length === 200 ? ' among the first 200 records' : ''}.`,
            source: 'Lanternmere record',
            href: `/muster?guild=${guildId}`,
            modelValues: [needsResult.data?.length ?? 0],
          }
        : {
            id: 'recruitment-unavailable',
            text: 'Recruitment needs could not be loaded.',
            source: 'Missing data',
            href: `/muster?guild=${guildId}`,
          },
    );
  }
  if (view === 'changes') {
    if (lastRaid) {
      const drops = await supabase
        .from('guild_raid_loot_drops')
        .select('id')
        .eq('operation_id', lastRaid.id)
        .limit(200);
      const awards = drops.error
        ? null
        : drops.data?.length
          ? await supabase
              .from('guild_raid_loot_awards')
              .select('id')
              .in(
                'loot_drop_id',
                drops.data.map((drop) => drop.id),
              )
              .limit(200)
          : { data: [], error: null };
      facts.push(
        !drops.error && awards && !awards.error
          ? {
              id: 'recent-loot',
              text: `${awards.data?.length ?? 0} recorded loot awards for the last raid${drops.data?.length === 200 || awards.data?.length === 200 ? ' among the first 200 drops or awards' : ''}. Awards are human decisions.`,
              source: 'Lanternmere record',
              href: `/guild-hall/raid-room?guild=${guildId}&operation=${lastRaid.id}`,
              modelValues: [awards.data?.length ?? 0],
            }
          : {
              id: 'recent-loot-unavailable',
              text: 'Last raid loot history could not be loaded.',
              source: 'Missing data',
              href: guildLink,
            },
      );
    }
    const cutoff = lastRaid?.event_date ?? utcDay(-7);
    const auditResult = canReadAudit
      ? await supabase
          .from('guild_audit_events')
          .select('action, created_at')
          .eq('guild_id', guildId)
          .gte('created_at', `${cutoff}T00:00:00Z`)
          .order('created_at', { ascending: false })
          .limit(50)
      : null;
    const audit =
      auditResult && !auditResult.error ? auditSchema.safeParse(auditResult.data) : null;
    const categories = audit?.success
      ? audit.data.reduce(
          (counts, event) => {
            const category = event.action.startsWith('guild.raid_')
              ? 'raid'
              : event.action.startsWith('guild.loot_')
                ? 'loot'
                : /recruitment|application|trial/.test(event.action)
                  ? 'recruitment'
                  : 'other';
            counts[category] += 1;
            return counts;
          },
          { raid: 0, loot: 0, recruitment: 0, other: 0 },
        )
      : null;
    facts.push(recentChangesFact(canReadAudit, categories, cutoff, Boolean(lastRaid), guildLink));
    facts.push({
      id: 'readiness-history-missing',
      text: 'Current Guild-shared readiness is shown above. Historical readiness changes are not available to this briefing, so no change is inferred.',
      source: 'Missing data',
      href: guildLink,
    });
  }
  if (view === 'raid') {
    facts.push({
      id: 'boss-kills',
      text: 'A public Warcraft Logs report can be reviewed in Chronicle Lens. Lanternmere does not claim Guild boss kills without a verified link to this raid.',
      source: 'Missing data',
      href: '/chronicle-lens',
    });
  }
  if (nextRaid && view === 'weekly') {
    facts.push({
      id: 'next-raid-link',
      text: `Next raid is ${nextRaid.title} on ${nextRaid.event_date}.`,
      source: 'Lanternmere record',
      href: `/guild-hall/raid-room?guild=${guildId}&operation=${nextRaid.id}`,
    });
  }
  return {
    guild: membership.guilds.name,
    guildId,
    view,
    facts,
    generatedAt: new Date().toISOString(),
  };
}
