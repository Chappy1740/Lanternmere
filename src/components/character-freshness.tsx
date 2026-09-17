import { characterFreshness } from '@/lib/wow/character-display';

export function CharacterFreshness({
  refreshedAt,
  failedAt,
  statusUnavailable = false,
}: {
  refreshedAt?: string;
  failedAt?: string;
  statusUnavailable?: boolean;
}) {
  const status = characterFreshness(refreshedAt, failedAt);
  const validDate = refreshedAt && Number.isFinite(Date.parse(refreshedAt));
  return (
    <div className="text-text-muted space-y-1 text-sm">
      <p>
        {validDate ? (
          <time dateTime={refreshedAt} title={new Date(refreshedAt).toUTCString()}>
            {status.label}
          </time>
        ) : (
          status.label
        )}
      </p>
      {status.lastRefreshFailed && (
        <p className="text-accent">Last refresh failed. Showing the last saved profile.</p>
      )}
      {statusUnavailable && <p>Refresh attempt status is unavailable.</p>}
      {status.refreshSuggested && <p>Refresh suggested — this import is at least 24 hours old.</p>}
    </div>
  );
}
