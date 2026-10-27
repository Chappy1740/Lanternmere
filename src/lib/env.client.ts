import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Supabase URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase publishable key is required'),
});

function parseClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    console.error('❌ Invalid client environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    // Name the failing variables in the thrown message itself: hosted deploy validation
    // (for example Cloudflare error 10021) shows only this message, not the console output.
    // Variable names only; values are never included.
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))].sort();
    throw new Error(
      `Invalid client environment variables: ${names.join(', ')}. Values are not logged.`,
    );
  }
  return parsed.data;
}

export const clientEnv = parseClientEnv();
