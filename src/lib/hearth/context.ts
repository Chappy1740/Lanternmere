import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// React cache is scoped to the server render, never shared between users.
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');
  return { supabase, user };
});

const membershipSchema = z.object({
  lodge_id: z.uuid(),
  role: z.enum(['owner', 'caretaker', 'member', 'guest']),
  lodges: z.object({ id: z.uuid(), name: z.string(), description: z.string().nullable() }),
});

export const getLodgeMemberships = cache(async () => {
  const { supabase, user } = await getViewer();
  const { data, error } = await supabase
    .from('lodge_members')
    .select('lodge_id, role, lodges!inner(id, name, description)')
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: true })
    .order('id', { ascending: true });
  const parsed = z.array(membershipSchema).safeParse(data);
  if (error || !parsed.success) throw new Error('Unable to verify Lodge membership.');
  if (!parsed.data.length) redirect('/lodges/new');
  return parsed.data;
});
