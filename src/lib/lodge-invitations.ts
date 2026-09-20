import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const invitationSchema = z.object({
  id: z.uuid(),
  lodge_id: z.uuid(),
  created_by: z.uuid(),
  email: z.string().nullable(),
  role: z.enum(['member', 'guest']),
  expires_at: z.iso.datetime({ offset: true }),
  accepted_at: z.iso.datetime({ offset: true }).nullable(),
  accepted_by: z.uuid().nullable(),
  revoked_at: z.iso.datetime({ offset: true }).nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

export type LodgeInvitation = z.infer<typeof invitationSchema>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

export function createInvitationToken() {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function loadLodgeInvitations(supabase: Supabase, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('lodge_invitations')
      .select(
        'id, lodge_id, created_by, email, role, expires_at, accepted_at, accepted_by, revoked_at, created_at',
      )
      .eq('lodge_id', lodgeId)
      .order('created_at', { ascending: false })
      .limit(50);
    const parsed = z.array(invitationSchema).safeParse(data);
    return error || !parsed.success ? null : parsed.data;
  } catch {
    return null;
  }
}
