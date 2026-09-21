'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type CampaignState = { error: string | null; success: string | null };

const createSchema = z.object({
  lodgeId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().max(500),
  targetCount: z.coerce.number().int().positive().or(z.literal('')),
});
const updateSchema = z.object({
  campaignId: z.uuid(),
  progressCount: z.coerce.number().int().nonnegative(),
  status: z.enum(['active', 'completed', 'archived']),
});

async function session() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return error || !user ? null : { supabase, user };
  } catch {
    return null;
  }
}

function refresh() {
  revalidatePath('/adventures');
}

export async function createCampaign(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const parsed = createSchema.safeParse({
    lodgeId: formData.get('lodgeId'),
    title: formData.get('title'),
    goal: formData.get('goal') ?? '',
    targetCount: formData.get('targetCount') ?? '',
  });
  if (!parsed.success) return { error: 'Check the campaign details and try again.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before saving a campaign.', success: null };
  const { error } = await current.supabase.from('lodge_campaigns').insert({
    lodge_id: parsed.data.lodgeId,
    created_by: current.user.id,
    title: parsed.data.title,
    goal: parsed.data.goal || null,
    target_count: parsed.data.targetCount || null,
  });
  if (error)
    return {
      error: 'The campaign could not be saved. Check your Lodge access and try again.',
      success: null,
    };
  refresh();
  return { error: null, success: 'Campaign saved.' };
}

export async function updateCampaignProgress(
  _previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const parsed = updateSchema.safeParse({
    campaignId: formData.get('campaignId'),
    progressCount: formData.get('progressCount'),
    status: formData.get('status'),
  });
  if (!parsed.success)
    return { error: 'Check the campaign progress and try again.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before updating a campaign.', success: null };
  const { data: campaign, error: readError } = await current.supabase
    .from('lodge_campaigns')
    .select('id, target_count')
    .eq('id', parsed.data.campaignId)
    .maybeSingle();
  if (readError || !campaign)
    return { error: 'This campaign is not available to your Lodge.', success: null };
  if (campaign.target_count !== null && parsed.data.progressCount > campaign.target_count)
    return { error: 'Progress cannot exceed the campaign goal.', success: null };
  const { error } = await current.supabase
    .from('lodge_campaigns')
    .update({ progress_count: parsed.data.progressCount, status: parsed.data.status })
    .eq('id', campaign.id);
  if (error)
    return { error: 'The campaign could not be updated. Please check your access.', success: null };
  refresh();
  return { error: null, success: 'Campaign progress updated.' };
}
