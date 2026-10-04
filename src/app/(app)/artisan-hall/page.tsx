import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  ArtisanOfferingForm,
  CraftingRequestForm,
  OfferingDeleteButton,
  RequestDeleteButton,
  RequestStatusButton,
  SupplyGoalForm,
} from '@/components/guild-artisan-hall';
import { getGuildMemberships } from '@/lib/guilds';
import { getViewer } from '@/lib/hearth/context';

const offeringSchema = z.array(
  z.object({
    id: z.uuid(),
    character_label: z.string(),
    profession: z.string(),
    specialization: z.string(),
    recipe_name: z.string(),
    service_note: z.string(),
  }),
);
const requestSchema = z.array(
  z.object({
    id: z.uuid(),
    requester_name: z.string(),
    request_kind: z.enum(['craft', 'consumable', 'material']),
    item_name: z.string(),
    quantity: z.number(),
    details: z.string(),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
    volunteer_name: z.string().nullable(),
    created_at: z.string(),
  }),
);
const goalSchema = z.array(
  z.object({
    id: z.uuid(),
    item_name: z.string(),
    target_quantity: z.number(),
    current_quantity: z.number(),
    note: z.string(),
    active: z.boolean(),
  }),
);
const characterSchema = z.array(
  z.object({ id: z.uuid(), character_name: z.string(), realm_slug: z.string() }).passthrough(),
);
const actionFlagSchema = z.array(
  z.object({
    item_type: z.enum(['offering', 'request']),
    item_id: z.uuid(),
    is_owner: z.boolean(),
    is_volunteer: z.boolean(),
  }),
);

export default async function ArtisanHallPage({
  searchParams,
}: {
  searchParams: Promise<{
    guild?: string | string[];
    recipe?: string | string[];
    profession?: string | string[];
    page?: string | string[];
    requestPage?: string | string[];
    goalPage?: string | string[];
  }>;
}) {
  const [params, memberships, { supabase, user }] = await Promise.all([
    searchParams,
    getGuildMemberships(),
    getViewer(),
  ]);
  if (!memberships.length) {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-display text-text-primary text-3xl font-bold">The Artisan Hall</h1>
        <p className="text-text-muted">Join a Guild to share crafting capabilities and requests.</p>
        <Link href="/guild-hall" className="text-accent underline">
          Visit the Guild Hall
        </Link>
      </main>
    );
  }
  const selected =
    params.guild === undefined
      ? memberships[0]
      : typeof params.guild === 'string'
        ? memberships.find((membership) => membership.guild_id === params.guild)
        : undefined;
  if (!selected) notFound();
  const guildId = selected.guild_id;
  const roles = selected.guild_member_roles.map((entry) => entry.role);
  const canManage = roles.includes('guild_master') || roles.includes('officer');
  const recipe = typeof params.recipe === 'string' ? params.recipe.trim().slice(0, 80) : '';
  const profession =
    typeof params.profession === 'string' ? params.profession.trim().slice(0, 60) : '';
  const requestedPage = typeof params.page === 'string' ? Number(params.page) : 1;
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000
      ? requestedPage
      : 1;
  const requestedRequestPage =
    typeof params.requestPage === 'string' ? Number(params.requestPage) : 1;
  const requestPage =
    Number.isSafeInteger(requestedRequestPage) &&
    requestedRequestPage > 0 &&
    requestedRequestPage <= 1000
      ? requestedRequestPage
      : 1;
  const requestedGoalPage = typeof params.goalPage === 'string' ? Number(params.goalPage) : 1;
  const goalPage =
    Number.isSafeInteger(requestedGoalPage) && requestedGoalPage > 0 && requestedGoalPage <= 1000
      ? requestedGoalPage
      : 1;
  let offeringQuery = supabase
    .from('guild_artisan_offerings')
    .select('id, character_label, profession, specialization, recipe_name, service_note', {
      count: 'exact',
    })
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (recipe) offeringQuery = offeringQuery.ilike('recipe_name', `%${recipe}%`);
  if (profession) offeringQuery = offeringQuery.ilike('profession', profession);
  const requestQuery = supabase
    .from('guild_crafting_requests')
    .select(
      'id, requester_name, request_kind, item_name, quantity, details, status, volunteer_name, created_at',
      { count: 'exact' },
    )
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .range((requestPage - 1) * 50, requestPage * 50 - 1);
  let goalQuery = supabase
    .from('guild_supply_goals')
    .select('id, item_name, target_quantity, current_quantity, note, active', { count: 'exact' })
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .range((goalPage - 1) * 50, goalPage * 50 - 1);
  if (!canManage) goalQuery = goalQuery.eq('active', true);
  const [offeringResult, requestResult, goalResult, characterResult] = await Promise.all([
    offeringQuery,
    requestQuery,
    selected.verified ? goalQuery : Promise.resolve({ data: [], error: null, count: 0 }),
    selected.verified
      ? supabase
          .from('characters')
          .select('id, character_name, realm_slug, games!inner(slug)')
          .eq('profile_id', user.id)
          .eq('games.slug', 'wow')
          .order('character_name')
      : Promise.resolve({ data: [], error: null }),
  ]);
  const offerings = offeringResult.error ? null : offeringSchema.safeParse(offeringResult.data);
  const requests = requestResult.error ? null : requestSchema.safeParse(requestResult.data);
  const goals = goalResult.error ? null : goalSchema.safeParse(goalResult.data);
  const characters = characterResult.error ? null : characterSchema.safeParse(characterResult.data);
  const list = offerings?.success ? offerings.data : null;
  const requestList = requests?.success ? requests.data : null;
  const flagResult =
    list !== null && requestList !== null
      ? await supabase.rpc('guild_artisan_action_flags', {
          p_guild_id: guildId,
          p_offering_ids: list.map((offering) => offering.id),
          p_request_ids: requestList.map((request) => request.id),
        })
      : null;
  const parsedFlags = flagResult?.error ? null : actionFlagSchema.safeParse(flagResult?.data ?? []);
  const flags = new Map(
    parsedFlags?.success
      ? parsedFlags.data.map((flag) => [`${flag.item_type}:${flag.item_id}`, flag] as const)
      : [],
  );
  const goalList = goals?.success ? goals.data : null;
  const visibleGoals = goalList?.filter((goal) => goal.active || canManage) ?? null;
  const search = new URLSearchParams({ guild: guildId });
  if (recipe) search.set('recipe', recipe);
  if (profession) search.set('profession', profession);
  const requestSearch = new URLSearchParams(search);
  if (page > 1) requestSearch.set('page', String(page));
  const goalSearch = new URLSearchParams(requestSearch);
  if (requestPage > 1) goalSearch.set('requestPage', String(requestPage));
  if (requestPage > 1) search.set('requestPage', String(requestPage));
  if (goalPage > 1) {
    search.set('goalPage', String(goalPage));
    requestSearch.set('goalPage', String(goalPage));
  }
  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Guild services</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          The Artisan Hall · {selected.guilds.name}
        </h1>
        <p className="text-text-muted mt-3">
          Crafting knowledge and requests shared by your Guild members. Capabilities, progress, and
          availability are entered by people; they are not live Blizzard or Guild-bank data.
          Character ownership is not verified by Blizzard.
        </p>
        <Link
          href={`/guild-hall?guild=${guildId}`}
          className="text-accent mt-3 inline-block underline"
        >
          Back to Guild Hall
        </Link>
      </header>
      {!selected.verified && (
        <p
          role="status"
          className="rounded-lg border border-amber-400/40 p-4 text-sm text-amber-200"
        >
          Guild verification is inactive. Existing items you posted remain visible to you for
          removal. New Guild-wide crafting activity is locked until a verified Guild Master renews
          the claim.
        </p>
      )}
      {list !== null && requestList !== null && !parsedFlags?.success && (
        <p role="alert" className="rounded-lg border border-amber-400/40 p-4 text-sm text-amber-200">
          Item actions could not be loaded. Refresh this page before changing a request or listing.
        </p>
      )}
      <section className="lodge-panel p-6" aria-labelledby="artisan-offerings-heading">
        <h2
          id="artisan-offerings-heading"
          className="font-display text-text-primary text-2xl font-bold"
        >
          Who can craft this?
        </h2>
        {selected.verified && (
          <form method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="guild" value={guildId} />
            <label className="text-text-muted grid gap-1 text-sm">
              Search notable recipe
              <input
                name="recipe"
                defaultValue={recipe}
                maxLength={80}
                className="lodge-field px-3 py-2"
              />
            </label>
            <label className="text-text-muted grid gap-1 text-sm">
              Profession
              <input
                name="profession"
                defaultValue={profession}
                maxLength={60}
                className="lodge-field px-3 py-2"
              />
            </label>
            <button className="lodge-button-secondary self-end px-4 py-2">Find</button>
          </form>
        )}
        {list === null ? (
          <p role="alert" className="text-text-muted mt-4">
            Crafting listings could not be loaded.
          </p>
        ) : list.length === 0 ? (
          <p className="text-text-muted mt-4">No matching capabilities are posted.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {list.map((offering) => (
              <li key={offering.id} className="lodge-list-row space-y-2 p-4">
                <p className="text-text-primary font-semibold">
                  {offering.character_label} · {offering.profession}
                  {offering.specialization ? ` / ${offering.specialization}` : ''}
                </p>
                <p className="text-text-muted text-sm">
                  {offering.recipe_name || 'General crafting capability'}
                </p>
                {offering.service_note && (
                  <p className="text-text-muted text-sm whitespace-pre-wrap">
                    {offering.service_note}
                  </p>
                )}
                {flags.get(`offering:${offering.id}`)?.is_owner && (
                  <OfferingDeleteButton id={offering.id} />
                )}
              </li>
            ))}
          </ul>
        )}
        {(offeringResult.count ?? 0) > 50 && (
          <nav
            aria-label="Crafting listing pages"
            className="text-text-muted mt-4 flex gap-4 text-sm"
          >
            {page > 1 && (
              <Link
                href={`/artisan-hall?${search}&page=${page - 1}`}
                className="text-accent underline"
              >
                Previous
              </Link>
            )}
            <span>Page {page}</span>
            {page * 50 < (offeringResult.count ?? 0) && (
              <Link
                href={`/artisan-hall?${search}&page=${page + 1}`}
                className="text-accent underline"
              >
                Next
              </Link>
            )}
          </nav>
        )}
        {selected.verified && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-text-primary text-lg font-semibold">
              Publish your crafting capability
            </h3>
            {!characters?.success ? (
              <p role="alert" className="text-text-muted mt-3 text-sm">
                Your Travelers could not be loaded. Try again before posting a capability.
              </p>
            ) : characters.data.length > 0 ? (
              <ArtisanOfferingForm guildId={guildId} characters={characters.data} />
            ) : (
              <p className="text-text-muted mt-3 text-sm">
                Add a World of Warcraft Traveler before posting a capability.
              </p>
            )}
          </div>
        )}
      </section>
      <section className="lodge-panel p-6" aria-labelledby="crafting-requests-heading">
        <h2
          id="crafting-requests-heading"
          className="font-display text-text-primary text-2xl font-bold"
        >
          Guild crafting requests
        </h2>
        <p className="text-text-muted mt-2 text-sm">
          Requests and volunteer game nicknames are visible to this verified Guild. Status changes
          are entered by members, not inferred from inventory. Nicknames are saved when posted or
          volunteered; changing a nickname later does not update an older request.
        </p>
        {requestList === null ? (
          <p role="alert" className="text-text-muted mt-4">
            Requests could not be loaded.
          </p>
        ) : requestList.length === 0 ? (
          <p className="text-text-muted mt-4">No requests are posted.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {requestList.map((request) => {
              const flag = flags.get(`request:${request.id}`);
              const isRequester = flag?.is_owner ?? false;
              const isVolunteer = flag?.is_volunteer ?? false;
              const mayChange = isRequester || isVolunteer || canManage;
              return (
                <li key={request.id} className="lodge-list-row space-y-2 p-4">
                  <p className="text-text-primary font-semibold">
                    {request.quantity} × {request.item_name}
                  </p>
                  <p className="text-text-muted text-sm">
                    {request.request_kind} · {request.status.replace('_', ' ')} · requested by{' '}
                    {request.requester_name} on {request.created_at.slice(0, 10)}
                    {request.volunteer_name ? ` · volunteer: ${request.volunteer_name}` : ''}
                  </p>
                  {request.details && (
                    <p className="text-text-muted text-sm whitespace-pre-wrap">{request.details}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selected.verified && request.status === 'open' && (
                      <RequestStatusButton id={request.id} status="in_progress" label="Volunteer" />
                    )}
                    {selected.verified && request.status === 'in_progress' && mayChange && (
                      <>
                        <RequestStatusButton
                          id={request.id}
                          status="completed"
                          label="Mark complete"
                        />
                        <RequestStatusButton id={request.id} status="open" label="Return to open" />
                      </>
                    )}
                    {selected.verified &&
                      ['open', 'in_progress'].includes(request.status) &&
                      (isRequester || canManage) && (
                        <RequestStatusButton id={request.id} status="cancelled" label="Cancel" />
                      )}
                    {(isRequester || canManage) && <RequestDeleteButton id={request.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {(requestResult.count ?? 0) > 50 && (
          <nav
            aria-label="Crafting request pages"
            className="text-text-muted mt-4 flex gap-4 text-sm"
          >
            {requestPage > 1 && (
              <Link
                href={`/artisan-hall?${requestSearch}&requestPage=${requestPage - 1}`}
                className="text-accent underline"
              >
                Previous
              </Link>
            )}
            <span>Page {requestPage}</span>
            {requestPage * 50 < (requestResult.count ?? 0) && (
              <Link
                href={`/artisan-hall?${requestSearch}&requestPage=${requestPage + 1}`}
                className="text-accent underline"
              >
                Next
              </Link>
            )}
          </nav>
        )}
        {selected.verified && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-text-primary text-lg font-semibold">Ask your Guild</h3>
            <CraftingRequestForm guildId={guildId} />
          </div>
        )}
      </section>
      {selected.verified && (
        <section className="lodge-panel p-6" aria-labelledby="supply-goals-heading">
          <h2
            id="supply-goals-heading"
            className="font-display text-text-primary text-2xl font-bold"
          >
            Supply goals
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Leadership enters these numbers manually. They do not reflect Guild-bank holdings.
          </p>
          {goalList === null ? (
            <p role="alert" className="text-text-muted mt-4">
              Supply goals could not be loaded.
            </p>
          ) : visibleGoals?.length === 0 ? (
            <p className="text-text-muted mt-4">No active supply goals are posted.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {visibleGoals?.map((goal) => (
                <li key={goal.id} className="lodge-list-row p-4">
                  <p className="text-text-primary font-semibold">
                    {goal.item_name} · {goal.current_quantity} / {goal.target_quantity}
                  </p>
                  {!goal.active && <p className="text-text-muted text-xs">Closed</p>}
                  {goal.note && (
                    <p className="text-text-muted mt-2 text-sm whitespace-pre-wrap">{goal.note}</p>
                  )}
                  {canManage && <SupplyGoalForm guildId={guildId} goal={goal} />}
                </li>
              ))}
            </ul>
          )}
          {(goalResult.count ?? 0) > 50 && (
            <nav aria-label="Supply goal pages" className="text-text-muted mt-4 flex gap-4 text-sm">
              {goalPage > 1 && (
                <Link
                  href={`/artisan-hall?${goalSearch}&goalPage=${goalPage - 1}`}
                  className="text-accent underline"
                >
                  Previous
                </Link>
              )}
              <span>Page {goalPage}</span>
              {goalPage * 50 < (goalResult.count ?? 0) && (
                <Link
                  href={`/artisan-hall?${goalSearch}&goalPage=${goalPage + 1}`}
                  className="text-accent underline"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
          {canManage && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="text-text-primary text-lg font-semibold">Add a supply goal</h3>
              <SupplyGoalForm guildId={guildId} />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
