import Link from 'next/link';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { serverEnv } from '@/lib/env.server';
import { NewFeedbackForm } from '@/components/signal-fire-forms';

const reportSchema = z.object({
  id: z.uuid(),
  category: z.enum(['problem', 'idea']),
  title: z.string(),
  status: z.enum(['new', 'reviewing', 'planned', 'closed']),
  last_activity_at: z.string(),
});

export default async function SignalFirePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase, user } = await getViewer();
  const parsedPage = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse((await searchParams).page);
  const page = parsedPage.success ? parsedPage.data : 1;
  const { data, count, error } = await supabase
    .from('app_feedback_reports')
    .select('id,category,title,status,last_activity_at', { count: 'exact' })
    .eq('sender_id', user.id)
    .order('last_activity_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  const reports = z.array(reportSchema).safeParse(data);
  if (error || !reports.success) throw new Error('Unable to load your reports.');
  const owner = Boolean(
    serverEnv.APP_OWNER_PROFILE_ID && user.id === serverEnv.APP_OWNER_PROFILE_ID,
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">A note to Lanternmere</p>
        <h1 className="font-display mt-2 text-3xl">The Signal Fire</h1>
        <p className="text-text-muted mt-3">
          Something broken? Have an idea? Send it privately to the Lanternmere owner. You can return
          here to read a reply.
        </p>
        {owner && (
          <Link
            href="/owner/signal-fire"
            className="lodge-button-secondary mt-4 inline-flex px-4 py-2"
          >
            Open owner inbox
          </Link>
        )}
      </header>
      <NewFeedbackForm />
      <section className="lodge-panel p-5 sm:p-7" aria-labelledby="your-reports">
        <h2 id="your-reports" className="font-display text-2xl">
          Your reports and ideas
        </h2>
        {reports.data.length === 0 ? (
          <p className="text-text-muted mt-3">You have not sent anything yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reports.data.map((report) => (
              <li key={report.id} className="border-border rounded-lg border p-4">
                <Link
                  className="lodge-button-secondary inline-flex max-w-full px-4 py-2 break-words"
                  href={`/signal-fire/${report.id}`}
                >
                  {report.title}
                </Link>
                <p className="text-text-muted mt-2 text-sm">
                  {report.category === 'problem' ? 'Problem' : 'Idea'} · {report.status} · Updated{' '}
                  {new Date(report.last_activity_at).toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                  })}{' '}
                  UTC
                </p>
              </li>
            ))}
          </ul>
        )}
        <nav className="mt-5 flex gap-3" aria-label="Your report pages">
          {page > 1 && (
            <Link
              className="lodge-button-secondary px-4 py-2"
              href={`/signal-fire?page=${page - 1}`}
            >
              Previous
            </Link>
          )}
          {page * 50 < (count ?? 0) && (
            <Link
              className="lodge-button-secondary px-4 py-2"
              href={`/signal-fire?page=${page + 1}`}
            >
              Next
            </Link>
          )}
        </nav>
      </section>
    </div>
  );
}
