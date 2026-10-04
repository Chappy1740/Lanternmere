import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  ExpeditionGoalForm,
  ExpeditionInterestForm,
  ExpeditionInterestRemoveButton,
  ExpeditionScoreClearButton,
  ExpeditionPostForm,
  ExpeditionPostDeleteButton,
  ExpeditionPostStatus,
} from '@/components/guild-expedition-board';
import { getGuildMemberships, isGuildLeadership } from '@/lib/guilds';
import { getViewer } from '@/lib/hearth/context';
import { loadMainCharacter } from '@/lib/hearth/main-character';
import { weeklyResetForRegion } from '@/lib/war-table';

const postSchema = z.array(
  z.object({
    id: z.uuid(),
    guild_id: z.uuid(),
    creator_name: z.string(),
    dungeon: z.string(),
    key_min: z.number(),
    key_max: z.number(),
    starts_at: z.string(),
    tank_slots: z.number(),
    healer_slots: z.number(),
    damage_slots: z.number(),
    note: z.string(),
    status: z.enum(['open', 'closed']),
  }),
);
const interestSchema = z.array(
  z.object({
    id: z.uuid(),
    post_id: z.uuid(),
    member_name: z.string(),
    character_label: z.string(),
    role: z.enum(['tank', 'healer', 'damage']),
    score: z.number().nullable(),
    score_source_url: z.string().nullable(),
    score_refreshed_at: z.string().nullable(),
  }),
);
const goalSchema = z.array(
  z.object({
    id: z.uuid(),
    target_runs: z.number(),
    target_key_level: z.number(),
    completed_runs: z.number(),
    note: z.string(),
    shared: z.boolean(),
  }),
);
const characterSchema = z.array(
  z
    .object({
      id: z.uuid(),
      character_name: z.string(),
      realm_slug: z.string(),
    })
    .passthrough(),
);
const calendarSchema = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    event_date: z.string(),
    event_time: z.string().nullable(),
  }),
);
const contextSchema = z.array(
  z.object({
    record_kind: z.enum(['post', 'interest', 'goal']),
    record_id: z.uuid(),
    is_mine: z.boolean(),
    own_character_id: z.uuid().nullable(),
    member_name: z.string().nullable(),
  }),
);
const pastInterestSchema = z.array(
  z.object({
    post_id: z.uuid(),
    dungeon: z.string(),
    starts_at: z.string(),
    score_shared: z.boolean(),
  }),
);

export default async function ExpeditionBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string | string[]; reset?: string | string[] }>;
}) {
  const [params, memberships, { supabase, user }] = await Promise.all([
    searchParams,
    getGuildMemberships(),
    getViewer(),
  ]);
  if (!memberships.length)
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-display text-text-primary text-3xl font-bold">The Expedition Board</h1>
        <p className="text-text-muted">Join a Guild to plan Mythic+ groups.</p>
        <Link href="/guild-hall" className="text-accent underline">
          Visit the Guild Hall
        </Link>
      </main>
    );
  const selected =
    params.guild === undefined
      ? memberships[0]
      : typeof params.guild === 'string'
        ? memberships.find((membership) => membership.guild_id === params.guild)
        : undefined;
  if (!selected) notFound();
  const roles = selected.guild_member_roles.map(({ role }) => role);
  const canLead = isGuildLeadership(roles);
  const main = await loadMainCharacter(supabase, user.id);
  const now = new Date();
  const reset = weeklyResetForRegion(main.state === 'ready' ? main.character.region : null);
  const suggestedReset = reset?.isoDate ?? new Date().toISOString().slice(0, 10);
  const requestedReset = typeof params.reset === 'string' ? params.reset : '';
  const resetOn =
    z.iso.date().safeParse(requestedReset).success &&
    Math.abs(Date.parse(requestedReset) - now.getTime()) <= 15 * 86400000
      ? requestedReset
      : suggestedReset;
  const today = now.toISOString().slice(0, 10);
  const through = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const [postResult, goalResult, characterResult, calendarResult] = await Promise.all([
    selected.verified
      ? supabase
          .from('guild_mythic_posts')
          .select(
            'id, guild_id, creator_name, dungeon, key_min, key_max, starts_at, tank_slots, healer_slots, damage_slots, note, status',
          )
          .eq('guild_id', selected.guild_id)
          .gte('starts_at', now.toISOString())
          .order('starts_at')
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
    selected.verified
      ? supabase
          .from('guild_mythic_goals')
          .select('id, target_runs, target_key_level, completed_runs, note, shared')
          .eq('guild_id', selected.guild_id)
          .eq('reset_on', resetOn)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    selected.verified
      ? supabase
          .from('characters')
          .select('id, character_name, realm_slug, games!inner(slug)')
          .eq('profile_id', user.id)
          .eq('games.slug', 'wow')
          .order('character_name')
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    selected.verified
      ? supabase
          .from('guild_calendar_entries')
          .select('id, title, event_date, event_time')
          .eq('guild_id', selected.guild_id)
          .eq('category', 'mythic_plus')
          .gte('event_date', today)
          .lte('event_date', through)
          .order('event_date')
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const postsParsed = postResult.error ? null : postSchema.safeParse(postResult.data);
  const goalsParsed = goalResult.error ? null : goalSchema.safeParse(goalResult.data);
  const charactersParsed = characterResult.error
    ? null
    : characterSchema.safeParse(characterResult.data);
  const calendarParsed = calendarResult.error
    ? null
    : calendarSchema.safeParse(calendarResult.data);
  const posts = postsParsed?.success ? postsParsed.data : null;
  const goals = goalsParsed?.success ? goalsParsed.data : null;
  const characters = charactersParsed?.success ? charactersParsed.data : null;
  const calendar = calendarParsed?.success ? calendarParsed.data : null;
  const interestResult = posts?.length
    ? await supabase
        .from('guild_mythic_interests')
        .select(
          'id, post_id, member_name, character_label, role, score, score_source_url, score_refreshed_at',
        )
        .eq('guild_id', selected.guild_id)
        .in(
          'post_id',
          posts.map(({ id }) => id),
        )
        .limit(300)
    : { data: [], error: null };
  const interestsParsed = interestResult.error
    ? null
    : interestSchema.safeParse(interestResult.data);
  const interests = interestsParsed?.success ? interestsParsed.data : null;
  const [contextResult, pastInterestResult] = selected.verified
    ? await Promise.all([
        supabase.rpc('guild_mythic_viewer_context', {
          p_guild_id: selected.guild_id,
          p_post_ids: posts?.map(({ id }) => id) ?? [],
          p_interest_ids: interests?.map(({ id }) => id) ?? [],
          p_goal_ids: goals?.map(({ id }) => id) ?? [],
        }),
        supabase.rpc('guild_mythic_my_past_interests', { p_guild_id: selected.guild_id }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  const contextParsed = contextResult.error ? null : contextSchema.safeParse(contextResult.data);
  const context = contextParsed?.success ? contextParsed.data : null;
  const actionFlags = new Map(
    context?.map((item) => [`${item.record_kind}:${item.record_id}`, item]),
  );
  const pastParsed = pastInterestResult.error
    ? null
    : pastInterestSchema.safeParse(pastInterestResult.data);
  const pastPosts = pastParsed?.success
    ? pastParsed.data.filter(({ post_id }) => !posts?.some((post) => post.id === post_id))
    : null;
  const ownGoal =
    (context && goals?.find((goal) => actionFlags.get(`goal:${goal.id}`)?.is_mine)) || null;
  const sharedGoals =
    (context &&
      goals?.filter((goal) => goal.shared && !actionFlags.get(`goal:${goal.id}`)?.is_mine)) ||
    null;

  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Mythic+ operations</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          The Expedition Board · {selected.guilds.name}
        </h1>
        <p className="text-text-muted mt-3">
          Plan key runs, find members who chose a role, and track your own weekly goal. Players
          decide who joins each group.
        </p>
        <Link
          href={`/guild-hall?guild=${selected.guild_id}`}
          className="text-accent mt-3 inline-block underline"
        >
          Back to Guild Hall
        </Link>
      </header>
      {!selected.verified ? (
        <section className="lodge-panel p-6" role="status">
          <p className="text-amber-200">
            This Guild needs a current Battle.net rank-zero claim before its Expedition Board opens.
          </p>
        </section>
      ) : (
        <>
          <form method="get" className="lodge-panel flex flex-wrap items-end gap-3 p-5">
            <label className="text-text-muted grid gap-1 text-sm">
              Guild
              <select
                name="guild"
                defaultValue={selected.guild_id}
                className="lodge-field px-3 py-2"
              >
                {memberships.map((membership) => (
                  <option key={membership.guild_id} value={membership.guild_id}>
                    {membership.guilds.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="lodge-button-secondary px-4 py-2 text-sm">Switch Guild</button>
          </form>
          <section className="lodge-panel p-6" aria-labelledby="groups-heading">
            <h2 id="groups-heading" className="font-display text-text-primary text-2xl font-bold">
              Upcoming group plans
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Requested roles show what the organizer is looking for. Interest is not an invitation
              or automatic match. Listed times use UTC after your local time is converted when
              posted.
            </p>
            {posts === null || interests === null || characters === null || context === null ? (
              <p role="alert" className="mt-4 text-amber-200">
                Group plans could not be loaded. Please try again.
              </p>
            ) : posts.length === 0 ? (
              <p className="text-text-muted mt-4">No upcoming group plans yet.</p>
            ) : (
              <div className="mt-5 space-y-5">
                {posts.map((post) => {
                  const people = interests.filter((interest) => interest.post_id === post.id);
                  const ownInterest =
                    people.find(
                      (interest) => actionFlags.get(`interest:${interest.id}`)?.is_mine,
                    ) ?? null;
                  const ownCharacterId = ownInterest
                    ? actionFlags.get(`interest:${ownInterest.id}`)?.own_character_id
                    : null;
                  const requestedRoles = [
                    ...(post.tank_slots ? ['tank' as const] : []),
                    ...(post.healer_slots ? ['healer' as const] : []),
                    ...(post.damage_slots ? ['damage' as const] : []),
                  ];
                  return (
                    <article
                      key={post.id}
                      className="rounded-lg border border-[color:var(--border-ornate)] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-text-primary text-lg font-semibold">
                            {post.dungeon} · +{post.key_min} to +{post.key_max}
                          </h3>
                          <p className="text-text-muted text-sm">
                            {new Date(post.starts_at).toLocaleString('en-US', { timeZone: 'UTC' })}{' '}
                            UTC · posted by {post.creator_name} · {post.status}
                          </p>
                        </div>
                        <p className="text-text-muted text-sm">
                          Seeking {post.tank_slots} tank · {post.healer_slots} healer ·{' '}
                          {post.damage_slots} damage
                        </p>
                      </div>
                      {post.note && (
                        <p className="text-text-muted mt-3 text-sm whitespace-pre-wrap">
                          {post.note}
                        </p>
                      )}
                      <h4 className="text-text-primary mt-4 font-semibold">
                        Members interested ({people.length})
                      </h4>
                      {people.length ? (
                        <ul className="text-text-muted mt-2 space-y-2 text-sm">
                          {people.map((person) => (
                            <li
                              key={person.id}
                              className="rounded border border-[color:var(--border-ornate)] p-3"
                            >
                              {person.member_name} · {person.character_label} · {person.role}
                              {person.score_source_url && person.score_refreshed_at && (
                                <span className="block">
                                  Shared cached Raider.IO score: {person.score ?? 'unavailable'} ·
                                  saved{' '}
                                  {new Date(person.score_refreshed_at).toLocaleString('en-US', {
                                    timeZone: 'UTC',
                                  })}{' '}
                                  UTC ·{' '}
                                  <a
                                    href={person.score_source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent underline"
                                  >
                                    source
                                  </a>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-text-muted mt-2 text-sm">
                          No one has expressed interest yet.
                        </p>
                      )}
                      {(post.status === 'open' || ownInterest) && (
                        <ExpeditionInterestForm
                          postId={post.id}
                          characters={characters}
                          roles={requestedRoles}
                          current={
                            ownInterest && ownCharacterId
                              ? {
                                  character_id: ownCharacterId,
                                  role: ownInterest.role,
                                  score_shared: ownInterest.score_source_url !== null,
                                }
                              : null
                          }
                          open={post.status === 'open'}
                        />
                      )}
                      {(actionFlags.get(`post:${post.id}`)?.is_mine || canLead) && (
                        <div>
                          <ExpeditionPostStatus id={post.id} status={post.status} />
                          <ExpeditionPostDeleteButton id={post.id} />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {posts?.length === 30 && (
              <p className="text-text-muted mt-4 text-sm">Showing the next 30 group plans.</p>
            )}
          </section>
          {pastPosts === null && (
            <p role="alert" className="lodge-panel p-5 text-amber-200">
              Your earlier interests could not be loaded. Please try again.
            </p>
          )}
          {pastPosts?.length ? (
            <section className="lodge-panel p-6" aria-labelledby="past-interest-heading">
              <h2
                id="past-interest-heading"
                className="font-display text-text-primary text-xl font-bold"
              >
                Your earlier group interests
              </h2>
              <p className="text-text-muted mt-2 text-sm">
                You can remove your shared Traveler and score after a run. Old posts and interests
                are deleted after 30 days.
              </p>
              <ul className="mt-4 space-y-3">
                {pastPosts.map((post) => (
                  <li
                    key={post.post_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border-ornate)] p-3"
                  >
                    <span className="text-text-muted text-sm">
                      {post.dungeon} ·{' '}
                      {new Date(post.starts_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {post.score_shared && <ExpeditionScoreClearButton postId={post.post_id} />}
                      <ExpeditionInterestRemoveButton postId={post.post_id} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="lodge-panel p-6" aria-labelledby="post-heading">
            <h2 id="post-heading" className="font-display text-text-primary text-2xl font-bold">
              Plan a group
            </h2>
            <ExpeditionPostForm guildId={selected.guild_id} />
          </section>
          <section className="lodge-panel p-6" aria-labelledby="goal-heading">
            <h2 id="goal-heading" className="font-display text-text-primary text-2xl font-bold">
              Your weekly goal
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Week ending {resetOn}
              {reset ? ` · ${reset.label}` : ' · choose the correct reset date for your region'}.
              Progress is entered by you. Your private Vault notes stay in the{' '}
              <Link href="/war-table" className="text-accent underline">
                War Table
              </Link>
              .
            </p>
            <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="guild" value={selected.guild_id} />
              <label className="text-text-muted grid gap-1 text-sm">
                Week ending
                <input
                  type="date"
                  name="reset"
                  defaultValue={resetOn}
                  required
                  className="lodge-field px-3 py-2"
                />
              </label>
              <button className="lodge-button-secondary px-4 py-2 text-sm">Show week</button>
            </form>
            {goals === null || context === null ? (
              <p role="alert" className="mt-3 text-amber-200">
                Weekly goals could not be loaded.
              </p>
            ) : (
              <>
                <ExpeditionGoalForm guildId={selected.guild_id} resetOn={resetOn} goal={ownGoal} />
                {sharedGoals?.length ? (
                  <div className="mt-6">
                    <h3 className="text-text-primary font-semibold">
                      Goals members chose to share
                    </h3>
                    <ul className="text-text-muted mt-2 space-y-2 text-sm">
                      {sharedGoals.map((goal) => (
                        <li key={goal.id}>
                          {actionFlags.get(`goal:${goal.id}`)?.member_name ?? 'Guild member'}:{' '}
                          {goal.completed_runs}/{goal.target_runs} runs · target +
                          {goal.target_key_level}
                          {goal.note ? ` · ${goal.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </section>
          <section className="lodge-panel p-6" aria-labelledby="keynight-heading">
            <h2 id="keynight-heading" className="font-display text-text-primary text-2xl font-bold">
              Guild key nights
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Guild leaders can add Mythic+ nights to the existing Guild calendar in the War Table.
              A calendar plan and a group post are separate; coordinate them with your Guild.
            </p>
            {calendar === null ? (
              <p role="alert" className="mt-3 text-amber-200">
                Key-night plans could not be loaded.
              </p>
            ) : calendar.length ? (
              <ul className="text-text-muted mt-3 space-y-2 text-sm">
                {calendar.map((entry) => (
                  <li key={entry.id}>
                    {entry.event_date}
                    {entry.event_time
                      ? ` at ${entry.event_time.slice(0, 5)} Guild-planned time`
                      : ''}{' '}
                    · {entry.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted mt-3 text-sm">
                No Guild key night is on the calendar yet.
              </p>
            )}
            <Link href="/war-table" className="text-accent mt-3 inline-block underline">
              Open the War Table calendar
            </Link>
          </section>
          <section className="lodge-panel p-6" aria-labelledby="resources-heading">
            <h2
              id="resources-heading"
              className="font-display text-text-primary text-2xl font-bold"
            >
              Dungeon and route resources
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Use the{' '}
              <Link href="/supply-chest" className="text-accent underline">
                Supply Chest
              </Link>{' '}
              for source-attributed Mythic+ links. External routes are advice from their publishers,
              not Guild assignments.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
