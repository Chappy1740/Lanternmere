import { createServerClient } from '@supabase/ssr';
import { AuthError } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env.client';

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware refreshes the session on every request anyway.
          }
        },
      },
    },
  );
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (...args) => {
    const result = await getUser(...args);
    if (result.data.user && !result.error) {
      const { error } = await client.rpc('record_app_activity');
      if (error)
        return {
          data: { user: null },
          error: new AuthError('Application access is unavailable.', 403),
        };
    }
    return result;
  };
  return client;
}
