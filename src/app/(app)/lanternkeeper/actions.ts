'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getViewer } from '@/lib/hearth/context';
import { getLanternkeeperBrief } from '@/lib/lanternkeeper/briefing';
import { getLanternkeeperProvider } from '@/lib/lanternkeeper/provider';

export type LanternkeeperState = {
  message: string;
  summary: string | null;
  suggestions: { text: string; href: string }[];
};

const input = z.object({ guildId: z.uuid(), view: z.enum(['weekly', 'raid', 'changes']) });
const unavailable = (message: string): LanternkeeperState => ({
  message,
  summary: null,
  suggestions: [],
});

export async function generateLanternkeeperSummary(
  _previous: LanternkeeperState,
  formData: FormData,
): Promise<LanternkeeperState> {
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return unavailable('Choose a valid Guild briefing.');
  const provider = getLanternkeeperProvider();
  if (!provider)
    return unavailable('AI wording is not configured. The source facts remain available below.');

  // Authentication, verified leadership, and RLS are rechecked on every request.
  const { supabase } = await getViewer();
  let brief;
  try {
    brief = await getLanternkeeperBrief(parsed.data.guildId, parsed.data.view);
  } catch {
    return unavailable('This Guild briefing is unavailable or you no longer have access.');
  }

  const claim = await supabase.rpc('claim_lanternkeeper_request', {
    p_guild_id: parsed.data.guildId,
    p_view: parsed.data.view,
  });
  if (claim.error)
    return unavailable('AI wording is unavailable. The factual briefing still works.');
  if (typeof claim.data !== 'string')
    return unavailable('This Guild has reached its AI briefing budget. Try again later.');

  const started = Date.now();
  let result = null;
  try {
    result = await provider.summarize(parsed.data.view, brief.facts);
  } catch {
    // Provider errors are intentionally not echoed to the browser or logged with private context.
  }
  const { error: auditError } = await createAdminClient().rpc('finish_lanternkeeper_request', {
    p_id: claim.data,
    p_status: result ? 'success' : 'failed',
    p_provider: provider.name,
    p_model: provider.model,
    p_latency_ms: Math.min(Date.now() - started, 120000),
    p_input_tokens: result?.inputTokens ?? null,
    p_output_tokens: result?.outputTokens ?? null,
  });
  if (auditError)
    return unavailable('AI wording could not be completed. The factual briefing still works.');
  if (!result)
    return unavailable('AI wording is temporarily unavailable. The factual briefing still works.');

  const links = new Map(brief.facts.map((fact) => [fact.id, fact.href]));
  return {
    message: 'AI suggestions based on the listed facts. Check the source before acting.',
    summary: result.summary,
    suggestions: result.suggestions.map((item) => ({
      text: item.text,
      href: links.get(item.fact_id) ?? '/lanternkeeper',
    })),
  };
}
