import { z } from 'zod';

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

// Credentials are supplied only by the server wrapper. A fetch argument keeps
// external failure paths testable without contacting Warcraft Logs.
export async function requestPublicLogReport(
  code: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicLogResult> {
  if (!clientId || !clientSecret)
    return {
      ok: false,
      message: 'Public Warcraft Logs reports are unavailable until this site is connected.',
    };
  if (!/^[A-Za-z0-9]{8,24}$/.test(code))
    return { ok: false, message: 'Enter a valid public Warcraft Logs report link.' };

  try {
    const tokenResponse = await fetchImpl('https://www.warcraftlogs.com/oauth/token', {
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
    let tokenBody: unknown;
    try {
      tokenBody = await tokenResponse.json();
    } catch {
      return { ok: false, message: 'Warcraft Logs returned an unexpected token response.' };
    }
    const token = z.object({ access_token: z.string().min(1) }).safeParse(tokenBody);
    if (!token.success)
      return { ok: false, message: 'Warcraft Logs returned an unexpected token response.' };

    const reportResponse = await fetchImpl('https://www.warcraftlogs.com/api/v2/client', {
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
    let reportBody: unknown;
    try {
      reportBody = await reportResponse.json();
    } catch {
      return { ok: false, message: 'Warcraft Logs returned an unexpected report response.' };
    }
    const payload = z
      .object({
        data: z.object({ reportData: z.object({ report: reportSchema.nullable() }) }),
      })
      .safeParse(reportBody);
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
