import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ownerAccountReference, ownerMainIdentities } from '@/lib/owner-main-identities';

const reportSchema = z.object({
  id: z.uuid(),
  sender_id: z.uuid(),
  category: z.enum(['problem', 'idea']),
  title: z.string(),
  status: z.enum(['new', 'reviewing', 'planned', 'closed']),
  last_activity_at: z.string(),
});

export default async function SignalFireOwnerInbox({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await getViewer();
  if (!serverEnv.APP_OWNER_PROFILE_ID || user.id !== serverEnv.APP_OWNER_PROFILE_ID) notFound();
  const parsedPage = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse((await searchParams).page);
  const page = parsedPage.success ? parsedPage.data : 1;
  const { data, count, error } = await createAdminClient()
    .from('app_feedback_reports')
    .select('id,sender_id,category,title,status,last_activity_at', { count: 'exact' })
    .order('last_activity_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  const reports = z.array(reportSchema).safeParse(data);
  if (error || !reports.success) throw new Error('Unable to load the owner inbox.');
  const ids = [...new Set(reports.data.map((report) => report.sender_id))];
  const mainLabels = await ownerMainIdentities(user.id, ids);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Owner-only</p>
        <h1 className="font-display mt-2 text-3xl">Signal Fire inbox</h1>
        <p className="text-text-muted mt-3">
          Private reports and ideas from signed-in members. Reply inside a report; status labels are
          for review, not promises.
        </p>
      </header>
      {reports.data.length === 0 ? (
        <p className="lodge-panel p-5">No reports yet.</p>
      ) : (
        <ul className="space-y-3">
          {reports.data.map((report) => (
            <li key={report.id} className="lodge-panel p-5">
              <Link
                className="lodge-button-secondary inline-flex max-w-full px-4 py-2 break-words"
                href={`/signal-fire/${report.id}`}
              >
                {report.title}
              </Link>
              <p className="text-text-muted mt-2 text-sm">
                {mainLabels.get(report.sender_id) ?? ownerAccountReference(report.sender_id)} ·{' '}
                {report.category === 'problem' ? 'Problem' : 'Idea'} · {report.status} · Updated{' '}
                {new Date(report.last_activity_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}{' '}
                UTC
              </p>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-3" aria-label="Inbox pages">
        {page > 1 && (
          <Link
            className="lodge-button-secondary px-4 py-2"
            href={`/owner/signal-fire?page=${page - 1}`}
          >
            Previous
          </Link>
        )}
        {page * 50 < (count ?? 0) && (
          <Link
            className="lodge-button-secondary px-4 py-2"
            href={`/owner/signal-fire?page=${page + 1}`}
          >
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}
