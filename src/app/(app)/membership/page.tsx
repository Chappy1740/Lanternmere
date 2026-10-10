import Link from 'next/link';
import { z } from 'zod';
import { MainIdentityConsentForm } from '@/components/main-identity-consent-form';
import { serverEnv } from '@/lib/env.server';
import { getViewer } from '@/lib/hearth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { ownerAccountReference, ownerMainIdentities } from '@/lib/owner-main-identities';

const pageSize = 50;

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ supabase, user }, params] = await Promise.all([getViewer(), searchParams]);
  const { data: acknowledgment, error: acknowledgmentError } = await supabase
    .from('app_main_identity_acknowledgments')
    .select('profile_id')
    .eq('profile_id', user.id)
    .eq('policy_version', '2026-10')
    .maybeSingle();
  if (acknowledgmentError) throw new Error('Unable to load your Main identity choice.');

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
    const labels = await ownerMainIdentities(user.id, ids);
    const signupDateFormatter = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
    memberRows = parsedProfiles.data.map((profile) => {
      return {
        label:
          labels.get(profile.id) ?? `${ownerAccountReference(profile.id)} · Main identity pending`,
        signedUpOn: signupDateFormatter.format(new Date(profile.created_at)),
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="lodge-panel p-6 sm:p-8">
        <Link href="/account" className="text-accent text-sm">
          Your account and Battle.net characters
        </Link>
        <p className="lodge-kicker">Application membership</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          Main identity sharing
        </h1>
        <p className="text-text-muted mt-3 text-sm">
          This is separate from Guild and Lodge membership. After you acknowledge the policy, the
          app owner can see only your selected Battle.net-verified Main’s name, realm, and region
          for account management. Existing Main identities remain hidden until acknowledgment. Your
          sign-in email and alternate characters are not shown in the owner account lists.
        </p>
        <MainIdentityConsentForm acknowledged={Boolean(acknowledgment)} />
        <p className="text-text-muted mt-6 text-xs">
          Your Lanternmere account reference (visible only to you):{' '}
          <code className="text-text-primary break-all">{user.id}</code>
        </p>
      </header>
      {isOwner && (
        <section className="lodge-panel p-6 sm:p-8">
          <p className="lodge-kicker">Owner-only</p>
          <Link href="/owner/accounts" className="text-accent text-sm">
            Manage accounts and usage
          </Link>
          <h2 className="font-display text-text-primary mt-2 text-2xl font-bold">
            Registered members · {total}
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Signup dates and acknowledged, verified Main identities only. A numbered label means
            that no Main identity can be shown yet. This list does not measure active users.
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
