import 'server-only';

import { serverEnv } from '@/lib/env.server';
import { requestPublicLogReport } from '@/lib/warcraft-logs-request';

export async function fetchPublicLogReport(code: string) {
  return requestPublicLogReport(
    code,
    serverEnv.WARCRAFT_LOGS_CLIENT_ID,
    serverEnv.WARCRAFT_LOGS_CLIENT_SECRET,
  );
}
