'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  generateLanternkeeperSummary,
  type LanternkeeperState,
} from '@/app/(app)/lanternkeeper/actions';
import type { BriefingView } from '@/lib/lanternkeeper/briefing';

const initial: LanternkeeperState = { message: '', summary: null, suggestions: [] };

export function LanternkeeperSummary({
  guildId,
  view,
  enabled,
}: {
  guildId: string;
  view: BriefingView;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(generateLanternkeeperSummary, initial);
  return (
    <section aria-labelledby="lanternkeeper-ai-heading" className="lodge-panel p-6 sm:p-8">
      <h2
        id="lanternkeeper-ai-heading"
        className="font-display text-text-primary text-2xl font-bold"
      >
        Optional AI summary
      </h2>
      <p className="text-text-muted mt-2 text-sm">
        When enabled, this sends only aggregate counts and freshness notes to OpenAI. Names, raid
        titles, applicant answers, private notes, and links stay in Lanternmere. The records below
        remain the source of truth.
      </p>
      {enabled ? (
        <form action={action} className="mt-4">
          <input type="hidden" name="guildId" value={guildId} />
          <input type="hidden" name="view" value={view} />
          <button
            type="submit"
            disabled={pending}
            className="lodge-button-primary px-4 py-2 text-sm"
          >
            {pending ? 'Preparing summary…' : 'Summarize these facts'}
          </button>
        </form>
      ) : (
        <p className="text-text-muted mt-4 text-sm">
          AI wording is not configured. The factual briefing is ready to use.
        </p>
      )}
      {state.message && (
        <p role="status" aria-live="polite" className="text-text-muted mt-3 text-sm">
          {state.message}
        </p>
      )}
      {state.summary && (
        <div className="mt-4 space-y-3">
          <p className="text-text-primary">{state.summary}</p>
          {state.suggestions.length > 0 && (
            <ul className="list-inside list-disc space-y-2 text-sm">
              {state.suggestions.map((item, index) => (
                <li key={`${item.href}-${index}`} className="text-text-primary">
                  {item.text}{' '}
                  <Link href={item.href} className="text-accent underline">
                    Check source
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
