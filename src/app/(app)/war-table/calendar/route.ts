import { getGuildMemberships } from '@/lib/guilds';
import { getOptionalLodgeMemberships, getViewer } from '@/lib/hearth/context';
import { loadQuestBoard } from '@/lib/quest-board/events';
import { warTableCalendarIcs, type CalendarItem } from '@/lib/war-table-calendar';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lodgeId = url.searchParams.get('lodge');
  const guildId = url.searchParams.get('guild');
  if (Boolean(lodgeId) === Boolean(guildId))
    return new Response('Choose one calendar.', { status: 400 });
  const { supabase } = await getViewer();
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  const endDate = end.toISOString().slice(0, 10);
  let events: CalendarItem[];
  let name: string;
  if (lodgeId) {
    const memberships = await getOptionalLodgeMemberships();
    const selected = memberships.find((membership) => membership.lodge_id === lodgeId);
    if (!selected) return new Response('Lodge access required.', { status: 403 });
    const board = await loadQuestBoard(supabase, lodgeId, today);
    if (!board.upcoming) return new Response('Calendar unavailable.', { status: 503 });
    events = board.upcoming
      .filter((event) => event.event_date <= endDate)
      .slice(0, 500)
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: event.event_date,
        time: event.event_time,
        description: [event.activity_type, event.notes].filter(Boolean).join(' — '),
        url: `${url.origin}/quest-board/${event.id}?lodge=${lodgeId}`,
      }));
    name = `${selected.lodges.name} · Lodge events`;
  } else {
    const memberships = await getGuildMemberships();
    const selected = memberships.find((membership) => membership.guild_id === guildId);
    if (!selected) return new Response('Guild access required.', { status: 403 });
    const result = await supabase
      .from('guild_calendar_entries')
      .select('id, title, category, event_date, event_time, details')
      .eq('guild_id', selected.guild_id)
      .gte('event_date', today)
      .lte('event_date', endDate)
      .order('event_date')
      .order('event_time', { nullsFirst: false })
      .limit(500);
    if (result.error || !result.data) return new Response('Calendar unavailable.', { status: 503 });
    events = result.data.map((entry) => ({
      id: entry.id,
      title: entry.title,
      date: entry.event_date,
      time: entry.event_time,
      description: [entry.category.replaceAll('_', ' '), entry.details].filter(Boolean).join(' — '),
      url: `${url.origin}/war-table#guild-calendar`,
    }));
    name = `${selected.guilds.name} · Guild plans`;
  }
  return new Response(warTableCalendarIcs(events, name), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lanternmere-calendar.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
