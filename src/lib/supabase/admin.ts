import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env.client';
import { serverEnv } from '@/lib/env.server';

export function createAdminClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
