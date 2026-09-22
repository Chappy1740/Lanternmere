import Link from 'next/link';
import { CalendarDays, Map, Plus, Repeat2, Swords } from 'lucide-react';
import { notFound } from 'next/navigation';
import { templateSchedule, loadEventTemplates } from '@/lib/adventures/event-templates';
import { campaignProgress, loadLodgeCampaigns } from '@/lib/adventures/campaigns';
import { CampaignForm, CampaignProgressControl } from '@/components/campaign-controls';
import { DeleteEventTemplateControl, EventTemplateForm } from '@/components/event-template-form';
import { eventDateTime, loadQuestBoard } from '@/lib/quest-board/events';
import { loadLodgeRoster } from '@/lib/hearth/roster';
import { isRaiderIoSnapshotFresh, loadRaidbotsReadiness, loadRaiderIoReadiness } from '@/lib/adventures/raiderio-readiness';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function AdventuresPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [memberships, params, viewer] = await Promise.all([
    getLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : typeof params.lodge === 'string'
        ? memberships.find((membership) => membership.lodge_id === params.lodge)
        : undefined;
  if (!selected) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const isLeader = selected.role === 'owner' || selected.role === 'caretaker';
  const [{ upcoming }, templates, campaigns, roster, raiderIoReadiness, raidbotsReadiness] = await Promise.all([
    loadQuestBoard(viewer.supabase, selected.lodge_id, today),
    loadEventTemplates(viewer.supabase, selected.lodge_id),
    loadLodgeCampaigns(viewer.supabase, selected.lodge_id),
    isLeader ? loadLodgeRoster(viewer.supabase, selected.lodge_id) : Promise.resolve(null),
    isLeader
      ? loadRaiderIoReadiness(viewer.supabase, selected.lodge_id)
      : Promise.resolve(null),
    isLeader ? loadRaidbotsReadiness(viewer.supabase, selected.lodge_id) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="lodge-panel flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-accent mb-3 flex items-center gap-2 text-sm">
            <Swords size={18} aria-hidden="true" /> The road ahead
          </p>
          <h1 className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
            Adventures
          </h1>
          <p className="text-text-muted mt-3">
            Gather the next expedition for {selected.lodges.name}.
          </p>
        </div>
        <Link
          href={`/quest-board/new?lodge=${selected.lodge_id}`}
          className="lodge-button inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium"
        >
          <Plus size={18} aria-hidden="true" /> Plan an adventure
        </Link>
      </header>

      <section aria-labelledby="next-adventures-heading" className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">On the horizon</p>
        <h2
          id="next-adventures-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          Next adventures
        </h2>
        {upcoming === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Upcoming adventures could not be loaded. Please try again later.
          </p>
        ) : upcoming.length === 0 ? (
          <div className="lodge-empty mt-5 p-6">
            <p className="text-text-primary font-medium">The map is open.</p>
            <p className="text-text-muted mt-2 text-sm">
              Start with a Quest Board event to give the Lodge a destination and a time to gather.
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {upcoming.slice(0, 6).map((event) => (
              <li key={event.id} className="lodge-list-row p-5">
                <p className="text-accent flex items-center gap-2 text-sm">
                  <Map size={16} aria-hidden="true" />{' '}
                  {event.activity_type?.trim() || 'Lodge event'}
                </p>
                <Link
                  href={`/quest-board/${event.id}?lodge=${selected.lodge_id}`}
                  className="font-display text-text-primary hover:text-accent mt-3 block text-xl font-bold underline-offset-4 hover:underline"
                >
                  {event.title}
                </Link>
                <p className="text-text-muted mt-2 text-sm">{eventDateTime(event)} UTC</p>
                {event.difficulty?.trim() && (
                  <p className="text-text-primary mt-3 text-sm">{event.difficulty}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isLeader && (
        <section aria-labelledby="readiness-heading" className="lodge-panel p-6 sm:p-8">
          <p className="lodge-kicker">Leader&apos;s lantern</p>
          <h2
            id="readiness-heading"
            className="font-display text-text-primary mt-2 text-2xl font-bold"
          >
            Readiness at a glance
          </h2>
          {roster?.state === 'ready' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <p className="lodge-data-cell text-text-muted text-sm">
                <span className="text-text-primary block text-2xl font-bold">{roster.total}</span>
                Lodge members
              </p>
              <p className="lodge-data-cell text-text-muted text-sm">
                <span className="text-text-primary block text-2xl font-bold">
                  {roster.mains.size}
                </span>
                Shared Main Travelers
              </p>
              <p className="lodge-data-cell text-text-muted text-sm">
                <span className="text-text-primary block text-2xl font-bold">
                  {upcoming?.length ?? 0}
                </span>
                Upcoming Quest Board events
              </p>
            </div>
          ) : (
            <p role="alert" className="text-text-muted mt-5">
              Readiness details could not be loaded. Please try again later.
            </p>
          )}
          {raiderIoReadiness?.state === 'ready' && (
            <div className="border-border mt-6 border-t pt-6">
              <p className="text-text-primary font-medium">Opted-in Raider.IO readiness</p>
              {raiderIoReadiness.snapshots.length === 0 ? (
                <p className="text-text-muted mt-2 text-sm">
                  No member has shared a Raider.IO snapshot with this Lodge yet.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {raiderIoReadiness.snapshots.slice(0, 6).map((snapshot) => {
                    const fresh = isRaiderIoSnapshotFresh(snapshot.refreshed_at);
                    return (
                      <li key={snapshot.source_url} className="lodge-list-row p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-text-primary font-medium">
                            {snapshot.character_name}{' '}
                            <span className="text-text-muted font-normal">
                              · {snapshot.realm_slug} ({snapshot.region.toUpperCase()})
                            </span>
                          </p>
                          <a
                            href={snapshot.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent shrink-0 text-sm underline underline-offset-4"
                          >
                            Raider.IO
                          </a>
                        </div>
                        <p className="text-text-muted mt-2 text-sm">
                          Mythic+ score: {snapshot.mythic_plus_score ?? 'Unavailable'} ·{' '}
                          {fresh ? 'Updated within 24 hours' : 'Update is older than 24 hours'}
                        </p>
                        {snapshot.failure_message && (
                          <p className="text-text-muted mt-2 text-sm">
                            Latest refresh: {snapshot.failure_message}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {raiderIoReadiness?.state === 'error' && (
            <p role="alert" className="text-text-muted mt-5 text-sm">
              Raider.IO readiness could not be loaded. Please try again later.
            </p>
          )}
          {raidbotsReadiness?.state === 'ready' && (
            <div className="border-border mt-6 border-t pt-6">
              <p className="text-text-primary font-medium">Player-submitted Raidbots plans</p>
              {raidbotsReadiness.reports.length === 0 ? <p className="text-text-muted mt-2 text-sm">No Raidbots report has been shared with this Lodge yet.</p> : <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {raidbotsReadiness.reports.map((report) => <li key={report.report_url} className="lodge-list-row p-4">
                  <p className="text-text-primary font-medium">{report.character_name} <span className="text-text-muted font-normal">· {report.realm_slug} ({report.region.toUpperCase()})</span></p>
                  {report.upgrade_targets && <p className="text-text-muted mt-2 text-sm">{report.upgrade_targets}</p>}
                  <a href={report.report_url} target="_blank" rel="noreferrer" className="text-accent mt-3 inline-block text-sm underline underline-offset-4">Open Raidbots report</a>
                </li>)}
              </ul>}
            </div>
          )}
          <p className="text-text-muted mt-5 text-sm">
            Use the Quest Board for confirmed attendance and party roles; this view does not create
            a second source of truth.
          </p>
          <Link
            href={`/quest-board?lodge=${selected.lodge_id}`}
            className="text-accent hover:text-accent-hover mt-4 inline-block text-sm underline underline-offset-4"
          >
            Review party plans
          </Link>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-2">
        <article className="lodge-panel p-6">
          <CalendarDays className="text-accent" size={22} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-xl font-bold">Build the party</h2>
          <p className="text-text-muted mt-2 text-sm leading-6">
            Quest Board RSVPs keep attendance, Traveler choices, and group roles together for each
            outing.
          </p>
          <Link
            href={`/quest-board?lodge=${selected.lodge_id}`}
            className="text-accent hover:text-accent-hover mt-5 inline-block text-sm underline underline-offset-4"
          >
            Open Quest Board
          </Link>
        </article>
        <article className="lodge-panel p-6">
          <Map className="text-accent" size={22} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-xl font-bold">
            More roads ahead
          </h2>
          <p className="text-text-muted mt-2 text-sm leading-6">
            Strategy and preparation live with each Quest Board event. Future progression context
            belongs in the Chronicle Lens after the Guild Hall foundation is in place.
          </p>
        </article>
      </section>

      <section aria-labelledby="campaigns-heading" className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">A shared horizon</p>
        <h2
          id="campaigns-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          Campaigns and goals
        </h2>
        <p className="text-text-muted mt-2 text-sm">
          Keep the Lodge&apos;s larger aim visible without turning it into a task board.
        </p>
        {campaigns === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Campaigns could not be loaded. Please try again later.
          </p>
        ) : campaigns.length === 0 ? (
          <p className="text-text-muted mt-5 text-sm">No campaign is underway yet.</p>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {campaigns.map((campaign) => {
              const canManage =
                campaign.created_by === viewer.user.id ||
                selected.role === 'owner' ||
                selected.role === 'caretaker';
              return (
                <li key={campaign.id} className="lodge-list-row p-5">
                  <p className="text-accent text-sm capitalize">{campaign.status}</p>
                  <h3 className="font-display text-text-primary mt-2 text-xl font-bold">
                    {campaign.title}
                  </h3>
                  {campaign.goal && <p className="text-text-muted mt-2 text-sm">{campaign.goal}</p>}
                  <p className="text-text-primary mt-3 text-sm">{campaignProgress(campaign)}</p>
                  {canManage && <CampaignProgressControl campaign={campaign} />}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-border mt-8 border-t pt-8">
          <h3 className="font-display text-text-primary text-xl font-bold">Begin a campaign</h3>
          <div className="mt-5">
            <CampaignForm lodgeId={selected.lodge_id} />
          </div>
        </div>
      </section>

      <section aria-labelledby="recurring-plans-heading" className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">A steady cadence</p>
        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2
              id="recurring-plans-heading"
              className="font-display text-text-primary text-2xl font-bold"
            >
              Recurring plans
            </h2>
            <p className="text-text-muted mt-2 text-sm">
              Reusable weekly plans keep a familiar gathering easy to post without creating events
              automatically.
            </p>
          </div>
          <Repeat2 className="text-accent" size={24} aria-hidden="true" />
        </div>
        {templates === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Recurring plans could not be loaded. Please try again later.
          </p>
        ) : templates.length === 0 ? (
          <p className="text-text-muted mt-5 text-sm">
            No recurring plans have been saved for this Lodge.
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {templates.map((template) => {
              const canManage =
                template.created_by === viewer.user.id ||
                selected.role === 'owner' ||
                selected.role === 'caretaker';
              return (
                <li key={template.id} className="lodge-list-row p-5">
                  <p className="text-accent text-sm">{templateSchedule(template)}</p>
                  <h3 className="font-display text-text-primary mt-2 text-xl font-bold">
                    {template.title}
                  </h3>
                  {[template.activity_type, template.difficulty].filter(Boolean).length > 0 && (
                    <p className="text-text-muted mt-2 text-sm">
                      {[template.activity_type, template.difficulty].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {template.notes && (
                    <p className="text-text-primary mt-3 text-sm">{template.notes}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <Link
                      href={`/quest-board/new?lodge=${selected.lodge_id}&template=${template.id}`}
                      className="text-accent hover:text-accent-hover text-sm underline underline-offset-4"
                    >
                      Post this outing
                    </Link>
                    {canManage && <DeleteEventTemplateControl templateId={template.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-border mt-8 border-t pt-8">
          <h3 className="font-display text-text-primary text-xl font-bold">Add a recurring plan</h3>
          <p className="text-text-muted mt-2 text-sm">
            Members can save a shared weekly rhythm for {selected.lodges.name}.
          </p>
          <div className="mt-5">
            <EventTemplateForm lodgeId={selected.lodge_id} />
          </div>
        </div>
      </section>
    </div>
  );
}
