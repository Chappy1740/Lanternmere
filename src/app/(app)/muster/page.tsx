import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  RecruitmentApplicationForm,
  RecruitmentDeleteButton,
  RecruitmentNeedForm,
  RecruitmentNeedToggle,
  RecruitmentNoteForm,
  RecruitmentReviewForm,
} from '@/components/guild-recruitment';
import { getGuildMemberships } from '@/lib/guilds';
import { getViewer } from '@/lib/hearth/context';

const needSchema = z.array(
  z.object({
    id: z.uuid(),
    guild_id: z.uuid(),
    raid_role: z.string(),
    class_name: z.string().nullable(),
    spec_name: z.string().nullable(),
    slots: z.number(),
    description: z.string(),
    active: z.boolean(),
  }),
);
const applicationSchema = z.array(
  z.object({
    id: z.uuid(),
    guild_id: z.uuid(),
    applicant_profile_id: z.uuid(),
    applicant_name: z.string(),
    character_label: z.string().nullable(),
    raid_role: z.string(),
    class_name: z.string().nullable(),
    spec_name: z.string().nullable(),
    availability: z.string(),
    experience: z.string(),
    profile_url: z.string().nullable(),
    log_url: z.string().nullable(),
    status: z.string(),
    trial_starts_on: z.string().nullable(),
    trial_ends_on: z.string().nullable(),
    trial_attendance_context: z.string(),
    created_at: z.string(),
    retention_expires_at: z.string(),
  }),
);
const noteSchema = z.array(
  z.object({
    id: z.uuid(),
    application_id: z.uuid(),
    note: z.string(),
    created_at: z.string(),
  }),
);
const historySchema = z.array(
  z.object({
    id: z.uuid(),
    application_id: z.uuid(),
    from_status: z.string().nullable(),
    to_status: z.string(),
    decision_note: z.string(),
    created_at: z.string(),
  }),
);

function safeLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function MusterPage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string | string[]; page?: string | string[] }>;
}) {
  const [params, memberships, { supabase, user }] = await Promise.all([
    searchParams,
    getGuildMemberships(),
    getViewer(),
  ]);
  if (
    params.guild !== undefined &&
    (typeof params.guild !== 'string' || !z.uuid().safeParse(params.guild).success)
  )
    notFound();
  const guildId = typeof params.guild === 'string' ? params.guild : memberships[0]?.guild_id;
  if (!guildId) {
    return (
      <main className="mx-auto max-w-3xl space-y-5">
        <h1 className="font-display text-text-primary text-3xl font-bold">The Muster</h1>
        <p className="text-text-muted">
          Open a Guild’s recruitment link to see its needs and apply. Your application is visible
          only to you and its verified recruiters.
        </p>
        <Link href="/guild-hall" className="text-accent underline">
          Visit the Guild Hall
        </Link>
      </main>
    );
  }
  const requestedPage = typeof params.page === 'string' ? Number(params.page) : 1;
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000
      ? requestedPage
      : 1;
  const ownMembership = memberships.find((membership) => membership.guild_id === guildId);
  const roles = ownMembership?.guild_member_roles.map((entry) => entry.role) ?? [];
  const canRecruit = roles.some((role) => ['guild_master', 'officer', 'recruiter'].includes(role));
  const canDecide = roles.some((role) => ['guild_master', 'officer'].includes(role));
  const guildNameResult = ownMembership
    ? { data: ownMembership.guilds.name, error: null }
    : await supabase.rpc('recruiting_guild_name', { p_guild_id: guildId });
  if (guildNameResult.error || !guildNameResult.data) notFound();
  const [needResult, applicationResult, characterResult, activeResult] = await Promise.all([
    supabase
      .from('guild_recruitment_needs')
      .select('id, guild_id, raid_role, class_name, spec_name, slots, description, active')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false }),
    supabase
      .from('guild_applications')
      .select(
        'id, guild_id, applicant_profile_id, applicant_name, character_label, raid_role, class_name, spec_name, availability, experience, profile_url, log_url, status, trial_starts_on, trial_ends_on, trial_attendance_context, created_at, retention_expires_at',
        { count: 'exact' },
      )
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .range((page - 1) * 50, page * 50 - 1),
    supabase
      .from('characters')
      .select('id, character_name, realm_slug, games!inner(slug)')
      .eq('profile_id', user.id)
      .eq('games.slug', 'wow')
      .order('character_name'),
    supabase
      .from('guild_applications')
      .select('id')
      .eq('guild_id', guildId)
      .eq('applicant_profile_id', user.id)
      .in('status', ['submitted', 'reviewing', 'trial'])
      .limit(1),
  ]);
  const needs = needResult.error ? null : needSchema.safeParse(needResult.data);
  const applications = applicationResult.error
    ? null
    : applicationSchema.safeParse(applicationResult.data);
  const characters = characterResult.error
    ? null
    : z
        .array(
          z
            .object({
              id: z.uuid(),
              character_name: z.string(),
              realm_slug: z.string(),
            })
            .passthrough(),
        )
        .safeParse(characterResult.data);
  const visibleNeeds = needs?.success ? needs.data : null;
  const visibleApplications = applications?.success ? applications.data : null;
  const applicationIds = visibleApplications?.map((application) => application.id) ?? [];
  const [noteResult, historyResult] =
    canRecruit && applicationIds.length
      ? await Promise.all([
          supabase
            .from('guild_application_notes')
            .select('id, application_id, note, created_at')
            .in('application_id', applicationIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('guild_application_history')
            .select('id, application_id, from_status, to_status, decision_note, created_at')
            .in('application_id', applicationIds)
            .order('created_at', { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  const notes = noteResult.error ? null : noteSchema.safeParse(noteResult.data);
  const history = historyResult.error ? null : historySchema.safeParse(historyResult.data);
  const hasActiveApplication = (activeResult.data?.length ?? 0) > 0;
  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Guild recruitment</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          The Muster · {guildNameResult.data}
        </h1>
        <p className="text-text-muted mt-3">
          Human-led recruitment and trials. Applications are private; no score decides who belongs
          here.
        </p>
        {ownMembership && (
          <Link
            className="text-accent mt-4 inline-block text-sm underline"
            href={`/guild-hall?guild=${guildId}`}
          >
            Back to Guild Hall
          </Link>
        )}
      </header>

      <section className="lodge-panel p-6" aria-labelledby="recruitment-needs-heading">
        <h2
          id="recruitment-needs-heading"
          className="font-display text-text-primary text-2xl font-bold"
        >
          Current needs
        </h2>
        {visibleNeeds === null ? (
          <p role="alert" className="text-text-muted mt-3">
            Recruitment needs could not be loaded.
          </p>
        ) : visibleNeeds.length === 0 ? (
          <p className="text-text-muted mt-3">No recruitment needs are posted.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {visibleNeeds.map((need) => (
              <li key={need.id} className="lodge-list-row p-4">
                <p className="text-text-primary font-medium">
                  {need.slots} {need.raid_role} spot{need.slots === 1 ? '' : 's'} ·{' '}
                  {need.class_name ?? 'Any class'}
                  {need.spec_name ? ` / ${need.spec_name}` : ''}
                </p>
                <p className="text-text-muted mt-1 text-sm">
                  {need.description || 'Ask the recruiters for details.'}
                </p>
                {!need.active && <p className="text-text-muted mt-1 text-xs">Closed</p>}
                {canRecruit && <RecruitmentNeedToggle need={need} />}
              </li>
            ))}
          </ul>
        )}
        {canRecruit && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-text-primary text-lg font-semibold">Post a recruitment need</h3>
            <RecruitmentNeedForm guildId={guildId} />
          </div>
        )}
      </section>

      {!ownMembership && visibleNeeds?.some((need) => need.active) && (
        <section className="lodge-panel p-6" aria-labelledby="apply-heading">
          <h2 id="apply-heading" className="font-display text-text-primary text-2xl font-bold">
            Apply to this Guild
          </h2>
          {visibleApplications === null || activeResult.error ? (
            <p role="alert" className="text-text-muted mt-3">
              Your application status could not be loaded. Try again before applying.
            </p>
          ) : hasActiveApplication ? (
            <p className="text-text-muted mt-3">
              Your application is active. You can see its current stage below.
            </p>
          ) : (
            <RecruitmentApplicationForm
              guildId={guildId}
              characters={characters?.success ? characters.data : []}
            />
          )}
        </section>
      )}

      <section className="lodge-panel p-6" aria-labelledby="applications-heading">
        <h2 id="applications-heading" className="font-display text-text-primary text-2xl font-bold">
          {canRecruit ? 'Applications and trials' : 'Your application'}
        </h2>
        {canRecruit && (
          <p className="text-text-muted mt-2 text-sm">
            Accepting an applicant records a human decision. Send a Guild invitation from the Guild
            Hall separately.
          </p>
        )}
        {visibleApplications !== null && (applicationResult.count ?? 0) > 50 && (
          <nav aria-label="Application pages" className="text-text-muted mt-3 flex gap-4 text-sm">
            {page > 1 && (
              <Link
                className="text-accent underline"
                href={`/muster?guild=${guildId}&page=${page - 1}`}
              >
                Previous
              </Link>
            )}
            <span>Page {page}</span>
            {page * 50 < (applicationResult.count ?? 0) && (
              <Link
                className="text-accent underline"
                href={`/muster?guild=${guildId}&page=${page + 1}`}
              >
                Next
              </Link>
            )}
          </nav>
        )}
        {visibleApplications === null ? (
          <p role="alert" className="text-text-muted mt-3">
            Applications could not be loaded.
          </p>
        ) : visibleApplications.length === 0 ? (
          <p className="text-text-muted mt-3">No applications to show.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {visibleApplications.map((application) => (
              <li key={application.id} className="lodge-list-row space-y-3 p-4">
                <div>
                  <p className="text-text-primary font-semibold">
                    {application.applicant_name} · {application.status}
                  </p>
                  <p className="text-text-muted text-sm">
                    {application.raid_role} · {application.class_name ?? 'Class not specified'}
                    {application.spec_name ? ` / ${application.spec_name}` : ''} · applied{' '}
                    {application.created_at.slice(0, 10)}
                  </p>
                </div>
                <p className="text-text-muted text-sm">
                  <strong>Availability:</strong> {application.availability || 'Not provided'}
                </p>
                {application.character_label && (
                  <p className="text-text-muted text-sm">
                    <strong>Linked Traveler:</strong> {application.character_label} · Lanternmere
                    import, not Battle.net ownership proof
                  </p>
                )}
                <p className="text-text-muted text-sm whitespace-pre-wrap">
                  <strong>Experience:</strong> {application.experience}
                </p>
                {(safeLink(application.profile_url) || safeLink(application.log_url)) && (
                  <p className="flex flex-wrap gap-4 text-sm">
                    {safeLink(application.profile_url) && (
                      <a
                        href={safeLink(application.profile_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline"
                      >
                        Applicant profile ↗
                      </a>
                    )}
                    {safeLink(application.log_url) && (
                      <a
                        href={safeLink(application.log_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline"
                      >
                        Applicant log ↗
                      </a>
                    )}
                  </p>
                )}
                {application.trial_starts_on && (
                  <p className="text-text-muted text-sm">
                    Trial: {application.trial_starts_on} to {application.trial_ends_on}.{' '}
                    {canRecruit && application.trial_attendance_context
                      ? `Officer-entered attendance context: ${application.trial_attendance_context}`
                      : ''}
                  </p>
                )}
                {canRecruit && (
                  <>
                    {['submitted', 'reviewing', 'trial'].includes(application.status) && (
                      <RecruitmentReviewForm
                        id={application.id}
                        currentStatus={application.status as 'submitted' | 'reviewing' | 'trial'}
                        canDecide={canDecide}
                        trialStartsOn={application.trial_starts_on}
                        trialEndsOn={application.trial_ends_on}
                      />
                    )}
                    <RecruitmentNoteForm id={application.id} />
                    {!notes?.success || !history?.success ? (
                      <p role="alert" className="text-text-muted text-sm">
                        Private review history could not be loaded.
                      </p>
                    ) : (
                      <>
                        {notes.success &&
                          notes.data
                            .filter((note) => note.application_id === application.id)
                            .map((note) => (
                              <p key={note.id} className="text-text-muted text-sm">
                                Private note · {note.created_at.slice(0, 10)}: {note.note}
                              </p>
                            ))}
                        {history.success &&
                          history.data
                            .filter((event) => event.application_id === application.id)
                            .map((event) => (
                              <p key={event.id} className="text-text-muted text-sm">
                                {event.created_at.slice(0, 10)} · {event.from_status ?? 'New'} →{' '}
                                {event.to_status}
                                {event.decision_note ? ` · ${event.decision_note}` : ''}
                              </p>
                            ))}
                      </>
                    )}
                  </>
                )}
                {(application.applicant_profile_id === user.id ||
                  roles.includes('guild_master')) && (
                  <RecruitmentDeleteButton id={application.id} />
                )}
                <p className="text-text-muted text-xs">
                  Private application data is removed after{' '}
                  {application.retention_expires_at.slice(0, 10)} or when you delete it.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
