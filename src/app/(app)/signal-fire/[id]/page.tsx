import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FeedbackReplyForm, FeedbackStatusForm } from '@/components/signal-fire-forms';
import { ownerAccountReference, ownerMainIdentities } from '@/lib/owner-main-identities';

const reportSchema = z.object({
  id: z.uuid(),
  sender_id: z.uuid(),
  category: z.enum(['problem', 'idea']),
  title: z.string(),
  body: z.string(),
  page_context: z.string().nullable(),
  status: z.enum(['new', 'reviewing', 'planned', 'closed']),
  created_at: z.string(),
  closed_at: z.string().nullable(),
});
const replySchema = z.object({
  id: z.uuid(),
  author_kind: z.enum(['sender', 'owner']),
  body: z.string(),
  created_at: z.string(),
});

export default async function SignalFireDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await getViewer();
  const owner = Boolean(
    serverEnv.APP_OWNER_PROFILE_ID && user.id === serverEnv.APP_OWNER_PROFILE_ID,
  );
  const reader = owner ? createAdminClient() : supabase;
  const { data, error } = await reader
    .from('app_feedback_reports')
    .select('id,sender_id,category,title,body,page_context,status,created_at,closed_at')
    .eq('id', id)
    .maybeSingle();
  const report = reportSchema.safeParse(data);
  if (error || !report.success) notFound();
  if (!owner && report.data.sender_id !== user.id) notFound();
  const { data: replyData, error: replyError } = await reader
    .from('app_feedback_replies')
    .select('id,author_kind,body,created_at')
    .eq('report_id', id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200);
  const replies = z.array(replySchema).safeParse(replyData);
  if (replyError || !replies.success) throw new Error('Unable to load this conversation.');
  const senderLabel = owner
    ? ((await ownerMainIdentities(user.id, [report.data.sender_id])).get(report.data.sender_id) ??
      ownerAccountReference(report.data.sender_id))
    : 'You';
  const sent = (await searchParams).sent === '1';
  const formatDate = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={owner ? '/owner/signal-fire' : '/signal-fire'}
        className="lodge-button-secondary inline-flex px-4 py-2"
      >
        Back to {owner ? 'owner inbox' : 'The Signal Fire'}
      </Link>
      {sent && (
        <p role="status" className="lodge-panel p-4 text-green-300">
          Your report reached Lanternmere. You can return here to read a reply.
        </p>
      )}
      <article className="lodge-panel p-5 sm:p-8">
        <p className="lodge-kicker">
          {report.data.category === 'problem' ? 'Problem report' : 'Idea or request'} ·{' '}
          {report.data.status}
        </p>
        <h1 className="font-display mt-2 text-3xl break-words">{report.data.title}</h1>
        <p className="text-text-muted mt-2 text-sm">
          From {senderLabel} · {formatDate(report.data.created_at)} UTC
        </p>
        {report.data.page_context && (
          <p className="text-text-muted mt-4 text-sm">
            Page or feature: {report.data.page_context}
          </p>
        )}
        <p className="mt-5 break-words whitespace-pre-wrap">{report.data.body}</p>
        {owner && <FeedbackStatusForm reportId={id} status={report.data.status} />}
        {report.data.status === 'closed' && (
          <p className="text-text-muted mt-5 text-sm">
            This conversation is closed. It will be removed 180 days after closing. Open a new
            report if you need more help.
          </p>
        )}
      </article>
      <section className="lodge-panel p-5 sm:p-8" aria-labelledby="conversation-title">
        <h2 id="conversation-title" className="font-display text-2xl">
          Conversation
        </h2>
        {replies.data.length === 0 ? (
          <p className="text-text-muted mt-3">No replies yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {replies.data.map((reply) => (
              <li key={reply.id} className="border-border rounded-lg border p-4">
                <p className="text-text-muted text-sm">
                  {reply.author_kind === 'sender'
                    ? owner
                      ? senderLabel
                      : 'You'
                    : owner
                      ? 'You'
                      : 'Lanternmere'}{' '}
                  · {formatDate(reply.created_at)} UTC
                </p>
                <p className="mt-2 break-words whitespace-pre-wrap">{reply.body}</p>
              </li>
            ))}
          </ol>
        )}
        {report.data.status !== 'closed' && <FeedbackReplyForm reportId={id} />}
      </section>
    </div>
  );
}
