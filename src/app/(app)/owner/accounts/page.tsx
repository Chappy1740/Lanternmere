import { createHash } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AccountAccessControl } from '@/components/account-access-control';

export default async function OwnerAccounts({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await getViewer();
  if (!serverEnv.APP_OWNER_PROFILE_ID || user.id !== serverEnv.APP_OWNER_PROFILE_ID) notFound();
  const parsed = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse((await searchParams).page);
  const page = parsed.success ? parsed.data : 1;
  const admin = createAdminClient();
  // eslint-disable-next-line react-hooks/purity -- Request-time filter for an uncached server query.
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [
    { data: profiles, count: total, error },
    { count: active, error: activityError },
    { count: suspendedCount, error: suspendedError },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * 50, page * 50 - 1),
    admin
      .from('app_account_activity')
      .select('profile_id', { count: 'exact', head: true })
      .gte('last_seen_at', since),
    admin
      .from('app_account_access')
      .select('profile_id', { count: 'exact', head: true })
      .eq('suspended', true),
  ]);
  const members = z.array(z.object({ id: z.uuid(), created_at: z.string() })).safeParse(profiles);
  if (error || activityError || suspendedError || !members.success)
    throw new Error('Unable to load account management.');
  const ids = members.data.map((m) => m.id);
  const [
    { data: preferences, error: preferenceError },
    { data: access, error: accessError },
    { data: logins, error: loginError },
  ] = ids.length
    ? await Promise.all([
        admin
          .from('app_member_directory_preferences')
          .select('profile_id,alias,visible_to_owner')
          .in('profile_id', ids),
        admin.from('app_account_access').select('profile_id,suspended').in('profile_id', ids),
        admin.rpc('app_account_logins', { p_profile_ids: ids }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (preferenceError || accessError) throw new Error('Unable to load account privacy choices.');
  const parsedLogins = z
    .array(z.object({ profile_id: z.uuid(), login: z.string().nullable() }))
    .safeParse(logins);
  if (loginError || !parsedLogins.success) throw new Error('Unable to load account logins.');
  const loginById = new Map(parsedLogins.data.map((row) => [row.profile_id, row.login]));
  const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="lodge-panel p-6">
        <p className="lodge-kicker">Owner-only</p>
        <h1 className="font-display mt-2 text-3xl">Account management</h1>
        <p className="mt-3">
          {total ?? 0} registered · {active ?? 0} seen in the last 7 days · {suspendedCount ?? 0}{' '}
          suspended
        </p>
        <p className="text-text-muted mt-2 text-sm">
          Activity counts verified app visits since this feature was enabled, not historical usage.
          Sign-in emails identify accounts for owner administration. Nicknames remain opt-in.
          Suspension preserves account data and can be reversed.
        </p>
        <Link href="/owner/design-studio" className="text-accent mt-4 inline-block underline">
          Open private design studio
        </Link>
      </header>
      <ul className="space-y-3">
        {members.data.map((member) => {
          const pref = preferences?.find((p) => p.profile_id === member.id);
          const suspended = access?.find((a) => a.profile_id === member.id)?.suspended === true;
          const sharedNickname = pref?.visible_to_owner ? pref.alias : null;
          const login = loginById.get(member.id);
          const label =
            sharedNickname ||
            login ||
            `Member ${createHash('sha256').update(member.id).digest('hex').slice(0, 10).toUpperCase()}`;
          return (
            <li className="lodge-panel p-5" key={member.id}>
              <h2 className="break-all">
                {label}
                {member.id === user.id ? ' · App owner' : ''}
              </h2>
              {sharedNickname && login && (
                <p className="text-text-muted text-sm break-all">Sign-in email: {login}</p>
              )}
              <p className="text-text-muted text-sm">
                Registered {formatter.format(new Date(member.created_at))} UTC ·{' '}
                {suspended ? 'Suspended' : 'Access enabled'}
              </p>
              {member.id !== user.id && (
                <AccountAccessControl profileId={member.id} suspended={suspended} />
              )}
            </li>
          );
        })}
      </ul>
      <nav className="flex gap-4">
        {page > 1 && <Link href={`/owner/accounts?page=${page - 1}`}>Previous</Link>}
        {page * 50 < (total ?? 0) && <Link href={`/owner/accounts?page=${page + 1}`}>Next</Link>}
      </nav>
    </div>
  );
}
