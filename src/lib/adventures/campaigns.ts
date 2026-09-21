import 'server-only';

import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const campaignSchema = z.object({
  id: z.uuid(),
  lodge_id: z.uuid(),
  created_by: z.uuid(),
  title: z.string(),
  goal: z.string().nullable(),
  target_count: z.number().int().positive().nullable(),
  progress_count: z.number().int().nonnegative(),
  status: z.enum(['active', 'completed', 'archived']),
});

export type LodgeCampaign = z.infer<typeof campaignSchema>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadLodgeCampaigns(supabase: Supabase, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('lodge_campaigns')
      .select('id, lodge_id, created_by, title, goal, target_count, progress_count, status')
      .eq('lodge_id', lodgeId)
      .order('status')
      .order('created_at', { ascending: false })
      .limit(30);
    const parsed = z.array(campaignSchema).safeParse(data);
    return error || !parsed.success ? null : parsed.data;
  } catch {
    return null;
  }
}

export function campaignProgress(campaign: Pick<LodgeCampaign, 'progress_count' | 'target_count'>) {
  return campaign.target_count === null
    ? 'Progress is tracked in the campaign notes.'
    : `${campaign.progress_count} of ${campaign.target_count}`;
}
