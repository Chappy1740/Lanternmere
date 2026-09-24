'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const input = z.object({ guildId: z.uuid(), startsOn: z.iso.date(), endsOn: z.iso.date(), status: z.enum(['available', 'tentative', 'unavailable']), note: z.string().trim().max(500) });

export async function createAvailability(formData: FormData) {
  const parsed = input.safeParse({ guildId: formData.get('guildId'), startsOn: formData.get('startsOn'), endsOn: formData.get('endsOn'), status: formData.get('status'), note: formData.get('note') });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_member_availability', { p_guild_id: parsed.data.guildId, p_starts_on: parsed.data.startsOn, p_ends_on: parsed.data.endsOn, p_availability_status: parsed.data.status, p_note: parsed.data.note || null });
  if (!error) revalidatePath('/war-table');
}
