import 'server-only';

import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  expires_in: z.number().int().positive(),
});

let cachedToken: { value: string; expiresAt: number } | null = null;
let pendingRequest: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  const id = serverEnv.BLIZZARD_CLIENT_ID;
  const secret = serverEnv.BLIZZARD_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error('Blizzard integration is not configured.');
  }

  const requestedAt = Date.now();
  let response: Response;

  try {
    response = await fetch('https://oauth.battle.net/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('Unable to reach Blizzard authentication. Try again later.');
  }

  if (response.status === 429) {
    throw new Error('Blizzard is limiting requests. Try again later.');
  }

  if (!response.ok) {
    throw new Error(`Blizzard authentication failed (HTTP ${response.status}).`);
  }

  const body: unknown = await response.json().catch(() => null);
  const parsed = tokenSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error('Blizzard returned an unexpected authentication response.');
  }

  cachedToken = {
    value: parsed.data.access_token,
    expiresAt: requestedAt + Math.max(0, parsed.data.expires_in - 60) * 1_000,
  };

  return cachedToken.value;
}

export async function getBlizzardToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  if (!pendingRequest) {
    pendingRequest = requestToken().finally(() => {
      pendingRequest = null;
    });
  }

  return pendingRequest;
}