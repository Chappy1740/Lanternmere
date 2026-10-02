import { createHash } from 'node:crypto';
import Link from 'next/link';
import { z } from 'zod';
import { AppDirectoryPreferenceForm } from '@/components/app-directory-preference-form';
import { serverEnv } from '@/lib/env.server';
import { getViewer } from '@/lib/hearth/context';
import { createAdminClient } from '@/lib/supabase/admin';

const pageSize = 50;

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ supabase, user }, params] = await Promise.all([getViewer(), searchParams]);
  const { data: preference, error: preferenceError } = await supabase
    .from('app_member_directory_preferences')
    .select('alias, visible_to_owner')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (preferenceError) throw new Error('Unable to load your directory preference.');

  const isOwner = serverEnv.APP_OWNER_PROFILE_ID === user.id;
  const parsedPage = z.coerce.number().int().min(1).max(10_000).safeParse(params.page);
  const page = parsedPage.success ? parsedPage.data : 1;
  let memberRows: { label: string; signedUpOn: string }[] = [];
  let total = 0;
  if (isOwner) {
    const admin = createAdminClient();
    const {
      data: profiles,
      count,
      error,
    } = await admin
      .from('profiles')
      .select('id, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    const parsedProfiles = z
      .array(z.object({ id: z.uuid(), created_at: z.string() }))
      .safeParse(profiles);
    if (error || !parsedProfiles.success) throw new Error('Unable to load app membership.');
    total = count ?? 0;
    const ids = parsedProfiles.data.map(({ id }) => id);
    const { data: preferences, error: directoryError } = ids.length
      ? await admin
          .from('app_member_directory_preferences')
          .select('profile_id, alias, visible_to_owner')
          .in('profile_id', ids)
      : { data: [], error: null };
    const parsedPreferences = z
      .array(
        z.object({
          profile_id: z.uuid(),
          alias: z.string().nullable(),
          visible_to_owner: z.boolean(),
        }),
      )
      .safeParse(preferences);
    if (directoryError || !parsedPreferences.success)
      throw new Error('Unable to load app membership preferences.');
    const aliasById = new Map(parsedPreferences.data.map((entry) => [entry.profile_id, entry]));
    memberRows = parsedProfiles.data.map((profile) => {
      const choice = aliasById.get(profile.id);
      return {
        label:
          choice?.visible_to_owner && choice.alias
            ? choice.alias
            : `Member ${createHash('sha256').update(profile.id).digest('hex').slice(0, 10).toUpperCase()}`,
        signedUpOn: new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeZone: 'UTC',
        }).format(new Date(profile.created_at)),
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Application membership</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          Directory privacy
        </h1>
        <p className="text-text-muted mt-3 text-sm">
          This is separate from Guild and Lodge membership. The owner directory never reads your
          email, credentials, or game data. It shows a nickname only if you explicitly opt in, so
          please avoid real-life details in that nickname.
        </p>
        <AppDirectoryPreferenceForm
          alias={preference?.alias ?? null}
          visible={preference?.visible_to_owner ?? false}
        />
        <p className="text-text-muted mt-6 text-xs">
          Your Lanternmere account reference (visible only to you):{' '}
          <code className="text-text-primary break-all">{user.id}</code>
        </p>
      </header>
      {isOwner && (
        <section className="lodge-panel p-6 sm:p-8">
          <p className="lodge-kicker">Owner-only</p>
          <h2 className="font-display text-text-primary mt-2 text-2xl font-bold">
            Registered members · {total}
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Signup dates and opt-in aliases only. A numbered label means that member has not chosen
            to share an alias. This list does not measure active users.
          </p>
          <ul className="mt-5 space-y-2">
            {memberRows.map((member, index) => (
              <li
                key={`${page}-${index}`}
                className="lodge-list-row flex flex-wrap justify-between gap-2 p-3 text-sm"
              >
                <span className="text-text-primary">{member.label} signed up</span>
                <time className="text-text-muted">{member.signedUpOn} UTC</time>
              </li>
            ))}
          </ul>
          <nav aria-label="Membership pages" className="mt-5 flex gap-3 text-sm">
            {page > 1 && (
              <Link
                className="lodge-button-secondary px-3 py-2"
                href={`/membership?page=${page - 1}`}
              >
                Previous
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                className="lodge-button-secondary px-3 py-2"
                href={`/membership?page=${page + 1}`}
              >
                Next
              </Link>
            )}
          </nav>
        </section>
      )}
    </div>
  );
}
