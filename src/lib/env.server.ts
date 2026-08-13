import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase secret key is required'),

  // Blizzard OAuth credentials — optional until OAuth integration begins.
  // Once the OAuth flow is implemented, remove .optional() to make these required.
  BLIZZARD_CLIENT_ID: z.string().min(1).optional(),
  BLIZZARD_CLIENT_SECRET: z.string().min(1).optional(),
  BLIZZARD_REDIRECT_URI: z.string().url().optional(),
  BLIZZARD_REGION: z.enum(['us', 'eu', 'kr', 'tw']).default('us'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function parseServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid server environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid server environment variables — see errors above.');
  }
  return parsed.data;
}

export const serverEnv = parseServerEnv();
