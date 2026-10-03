import 'server-only';

import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';

const reportSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{8,24}$/),
  title: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  fights: z
    .array(
      z
        .object({
          id: z.number().int(),
          name: z.string(),
          encounterID: z.number().int(),
          difficulty: z.number().int().nullable(),
          kill: z.boolean().nullable(),
          startTime: z.number(),
          endTime: z.number(),
        })
        .nullable(),
    )
    .nullable(),
});

export type PublicLogReport = z.infer<typeof reportSchema>;
export type PublicLogResult =
  { ok: true; report: PublicLogReport; fetchedAt: string } | { ok: false; message: string };

const query = `query PublicReport($code: String!) {
  reportData {
    report(code: $code, allowUnlisted: false) {
      code title startTime endTime
      fights { id name encounterID difficulty kill startTime endTime }
    }
  }
}`;

export async function fetchPublicLogReport(code: string): Promise<PublicLogResult> {
  const clientId = serverEnv.WARCRAFT_LOGS_CLIENT_ID;
  const clientSecret = serverEnv.WARCRAFT_LOGS_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return {
      ok: false,
      message: 'Public Warcraft Logs reports are unavailable until this site is connected.',
    };
  if (!/^[A-Za-z0-9]{8,24}$/.test(code))
    return { ok: false, message: 'Enter a valid public Warcraft Logs report link.' };

  try {
    const tokenResponse = await fetch('https://www.warcraftlogs.com/oauth/token', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok)
      return {
        ok: false,
        message: 'Warcraft Logs authentication is unavailable. Try again later.',
      };
    const token = z
      .object({ access_token: z.string().min(1) })
      .safeParse(await tokenResponse.json());
    if (!token.success)
      return { ok: false, message: 'Warcraft Logs returned an unexpected token response.' };

    const reportResponse = await fetch('https://www.warcraftlogs.com/api/v2/client', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token.data.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables: { code } }),
      signal: AbortSignal.timeout(12_000),
    });
    if (reportResponse.status === 429)
      return { ok: false, message: 'Warcraft Logs is busy. Please try again later.' };
    if (!reportResponse.ok)
      return { ok: false, message: 'The public report could not be loaded right now.' };
    const payload = z
      .object({ data: z.object({ reportData: z.object({ report: reportSchema.nullable() }) }) })
      .safeParse(await reportResponse.json());
    if (!payload.success)
      return { ok: false, message: 'Warcraft Logs returned an unexpected report response.' };
    if (!payload.data.data.reportData.report)
      return {
        ok: false,
        message: 'No public report was found. Private and unlisted reports are unavailable.',
      };
    if (payload.data.data.reportData.report.code !== code)
      return { ok: false, message: 'Warcraft Logs returned a different report than requested.' };
    return {
      ok: true,
      report: payload.data.data.reportData.report,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, message: 'Warcraft Logs could not be reached right now.' };
  }
}
