import { bundledProjectTracker, trackerSchema } from '@/lib/project-status';

const publishedTrackerUrl =
  'https://raw.githubusercontent.com/Chappy1740/Lanternmere/main/docs/project-tracker.json';

export async function GET() {
  let tracker = bundledProjectTracker;
  let source: 'published main' | 'bundled snapshot' = 'bundled snapshot';

  try {
    const response = await fetch(publishedTrackerUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const result = trackerSchema.safeParse(await response.json());
      if (result.success && result.data.revision >= tracker.revision) {
        tracker = result.data;
        source = 'published main';
      }
    }
  } catch {
    // The bundled tracker remains available during a GitHub outage.
  }

  return Response.json(
    { tracker, source },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
