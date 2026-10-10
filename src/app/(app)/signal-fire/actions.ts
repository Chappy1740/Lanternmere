'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';

const reportSchema = z.object({
  category: z.enum(['problem', 'idea']),
  title: z.string().trim().min(5).max(100),
  body: z.string().trim().min(20).max(4000),
  pageContext: z.string().trim().max(200),
});
const replySchema = z.object({ reportId: z.uuid(), body: z.string().trim().min(1).max(2000) });
const statusSchema = z.object({
  reportId: z.uuid(),
  status: z.enum(['new', 'reviewing', 'planned', 'closed']),
});

export type FeedbackFormState = {
  error: string | null;
  success?: boolean;
  savedStatus?: 'new' | 'reviewing' | 'planned' | 'closed';
};

export async function submitFeedback(
  _previous: FeedbackFormState,
  form: FormData,
): Promise<FeedbackFormState> {
  const parsed = reportSchema.safeParse({
    category: form.get('category'),
    title: form.get('title'),
    body: form.get('body'),
    pageContext: form.get('pageContext'),
  });
  if (!parsed.success)
    return {
      error:
        'Choose a type, add a title of 5–100 characters, and describe it in 20–4,000 characters.',
    };
  const { user } = await getViewer();
  const { data, error } = await createAdminClient()
    .from('app_feedback_reports')
    .insert({
      sender_id: user.id,
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      page_context: parsed.data.pageContext || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return {
      error:
        error?.code === '23514'
          ? 'You have reached the report limit. Please try again later.'
          : 'Your report could not be sent. Your text is still here; please try again.',
    };
  }
  revalidatePath('/signal-fire');
  redirect(`/signal-fire/${data.id}?sent=1`);
}

export async function replyToFeedback(
  _previous: FeedbackFormState,
  form: FormData,
): Promise<FeedbackFormState> {
  const parsed = replySchema.safeParse({ reportId: form.get('reportId'), body: form.get('body') });
  if (!parsed.success) return { error: 'Write a reply of 1–2,000 characters.' };
  const { supabase, user } = await getViewer();
  const owner = Boolean(
    serverEnv.APP_OWNER_PROFILE_ID && user.id === serverEnv.APP_OWNER_PROFILE_ID,
  );
  const reader = owner ? createAdminClient() : supabase;
  const { data: report, error: lookupError } = await reader
    .from('app_feedback_reports')
    .select('id,status,sender_id')
    .eq('id', parsed.data.reportId)
    .maybeSingle();
  if (lookupError || !report || (!owner && report.sender_id !== user.id))
    return { error: 'This report is unavailable.' };
  if (report.status === 'closed') return { error: 'This report is closed.' };
  const { error } = await createAdminClient().from('app_feedback_replies').insert({
    report_id: parsed.data.reportId,
    author_id: user.id,
    body: parsed.data.body,
  });
  if (error)
    return {
      error:
        error.code === '23514'
          ? 'This conversation is closed or has reached its reply limit. Please try later.'
          : 'Your reply could not be sent. Please try again.',
    };
  revalidatePath(`/signal-fire/${parsed.data.reportId}`);
  revalidatePath('/owner/signal-fire');
  return { error: null, success: true };
}

export async function setFeedbackStatus(
  _previous: FeedbackFormState,
  form: FormData,
): Promise<FeedbackFormState> {
  const parsed = statusSchema.safeParse({
    reportId: form.get('reportId'),
    status: form.get('status'),
  });
  if (!parsed.success) return { error: 'Choose a valid report status.' };
  const { user } = await getViewer();
  if (!serverEnv.APP_OWNER_PROFILE_ID || user.id !== serverEnv.APP_OWNER_PROFILE_ID)
    return { error: 'Owner access is required.' };
  const { data, error } = await createAdminClient()
    .from('app_feedback_reports')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.reportId)
    .select('id,status')
    .maybeSingle();
  if (error || !data || data.status !== parsed.data.status)
    return { error: 'The report status could not be changed.' };
  revalidatePath(`/signal-fire/${parsed.data.reportId}`);
  revalidatePath('/owner/signal-fire');
  return { error: null, success: true, savedStatus: data.status };
}
