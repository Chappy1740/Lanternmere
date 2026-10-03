export function parsePublicReportCode(input: string) {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9]{8,24}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (
      url.protocol !== 'https:' ||
      !['warcraftlogs.com', 'www.warcraftlogs.com'].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const match = /^\/reports\/([A-Za-z0-9]{8,24})\/?$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
