import Link from 'next/link';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { GameNicknameForm } from '@/components/game-nickname-form';
import { ownedWowCharacterSchema } from '@/lib/wow/guild-claim';
import { AddOwnedTravelerControl } from '@/components/add-owned-traveler-control';
import { WOW_MIN_TRAVELER_LEVEL, WOW_RETAIL_LEVEL_CAP } from '@/lib/wow/level';
import { MainIdentityConsentForm } from '@/components/main-identity-consent-form';
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ battleNet?: string; reason?: string }>;
}) {
  const { supabase, user } = await getViewer();
  const params = await searchParams;
  const failureMessages: Record<string, string> = {
    expired:
      'Battle.net authorization was cancelled or expired. Connect again and approve character access.',
    session:
      'Your Lanternmere sign-in changed or expired. Sign in again before connecting Battle.net.',
    authorization:
      'Battle.net did not accept the authorization. Connect again to start a fresh request.',
    token: 'Battle.net did not return valid authorization. Please connect again.',
    profile:
      'Battle.net could not provide your character list. Check that character access is approved, then try again.',
    format: 'Battle.net returned character details we could not read. This needs an app fix.',
    save: 'Your characters were retrieved, but could not be saved. Please try again.',
    unavailable: 'Battle.net connection could not be completed. Please try again.',
  };
  const [
    { data: profile, error: profileError },
    { data: snapshot, error: snapshotError },
    claimsResult,
    existingResult,
    acknowledgmentResult,
  ] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase
      .from('app_owned_wow_snapshots')
      .select('region,characters,refreshed_at')
      .eq('profile_id', user.id)
      .maybeSingle(),
    supabase.from('wow_character_claims').select('blizzard_character_id').eq('profile_id', user.id),
    supabase
      .from('characters')
      .select('region,realm_slug,character_name,games!inner(slug)')
      .eq('profile_id', user.id)
      .eq('games.slug', 'wow'),
    supabase
      .from('app_main_identity_acknowledgments')
      .select('profile_id')
      .eq('profile_id', user.id)
      .eq('policy_version', '2026-10')
      .maybeSingle(),
  ]);
  if (
    profileError ||
    snapshotError ||
    claimsResult.error ||
    existingResult.error ||
    acknowledgmentResult.error
  )
    throw new Error('Unable to load your account.');
  const characters = z.array(ownedWowCharacterSchema).safeParse(snapshot?.characters ?? []);
  if (!characters.success) throw new Error('Unable to load your character list.');
  const eligibleCharacters = characters.data.filter(
    (character) => character.level !== undefined && character.level >= WOW_MIN_TRAVELER_LEVEL,
  );
  const claimedIds = new Set(claimsResult.data.map((claim) => Number(claim.blizzard_character_id)));
  const existingCharacters = new Set(
    existingResult.data.map(
      (character) =>
        `${character.region}:${character.realm_slug.toLowerCase()}:${character.character_name.toLowerCase()}`,
    ),
  );
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="lodge-panel p-6">
        <p className="lodge-kicker">Your account</p>
        <h1 className="font-display mt-2 text-3xl">Nickname and characters</h1>
        <GameNicknameForm nickname={profile?.display_name ?? ''} />
        <Link href="/membership" className="text-accent mt-5 inline-block">
          Main identity sharing
        </Link>
      </section>
      <section className="lodge-panel p-6">
        <h2 className="font-display text-2xl">Before adding a Traveler</h2>
        <p className="text-text-muted mt-3 text-sm">
          Your selected Battle.net-verified Main’s name, realm, and region are shown to the app
          owner for account management after you acknowledge this policy. Existing Travelers stay
          private until you do. Your other character details and private Battle.net list are not
          shown.
        </p>
        <MainIdentityConsentForm acknowledged={Boolean(acknowledgmentResult.data)} />
      </section>
      <section className="lodge-panel p-6">
        <h2 className="font-display text-2xl">Your Battle.net characters</h2>
        <p className="text-text-muted mt-3 text-sm">
          Authorize your own Battle.net account to see available WoW characters in your selected
          region. Only level {WOW_MIN_TRAVELER_LEVEL}+ characters (within ten levels of the current{' '}
          {WOW_RETAIL_LEVEL_CAP} cap) appear here. This list is private to your Lanternmere account.
          Connecting does not grant Guild leadership or share characters with a Guild or Lodge.
        </p>
        <form
          action="/api/battle-net/start"
          method="get"
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <label>
            Region{' '}
            <select
              name="region"
              defaultValue={snapshot?.region ?? 'us'}
              className="lodge-field px-3 py-2"
            >
              <option value="us">US</option>
              <option value="eu">EU</option>
              <option value="kr">KR</option>
              <option value="tw">TW</option>
            </select>
          </label>
          <button className="lodge-button px-4 py-2">
            {snapshot ? 'Refresh Battle.net characters' : 'Connect Battle.net'}
          </button>
        </form>
        {params.battleNet === 'failed' && (
          <p role="alert" className="mt-3">
            {Object.hasOwn(failureMessages, params.reason ?? '')
              ? failureMessages[params.reason!]
              : failureMessages.unavailable}
          </p>
        )}
        {params.battleNet === 'connected' && (
          <p role="status" className="mt-3">
            Your character list is refreshed.
          </p>
        )}
        {snapshot && (
          <p className="text-text-muted mt-4 text-sm">
            {eligibleCharacters.length} eligible characters · {snapshot.region.toUpperCase()} ·
            updated {new Date(snapshot.refreshed_at).toISOString().slice(0, 10)}
          </p>
        )}
        {snapshot && (
          <p className="text-text-muted mt-2 text-sm">
            If a character was already saved from a public lookup, choose Verify ownership here to
            connect it to your Battle.net account.
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {eligibleCharacters.map((character) => (
            <li
              className="lodge-list-row flex min-w-0 flex-wrap items-center justify-between gap-3 p-3"
              key={`${character.realm.slug}:${character.id}`}
            >
              <span className="min-w-0 [overflow-wrap:anywhere] break-words">
                {character.name ?? `Character ${character.id}`} ·{' '}
                {character.realm.name ?? character.realm.slug}
                {character.level !== undefined ? ` · Level ${character.level}` : ''}
              </span>
              <AddOwnedTravelerControl
                characterId={character.id}
                added={claimedIds.has(character.id)}
                identityAcknowledged={Boolean(acknowledgmentResult.data)}
                previouslyImported={existingCharacters.has(
                  `${snapshot?.region}:${character.realm.slug.toLowerCase()}:${character.name?.toLowerCase()}`,
                )}
              />
            </li>
          ))}
        </ul>
        {snapshot && !eligibleCharacters.length && (
          <p className="mt-3">
            Battle.net returned no characters at level {WOW_MIN_TRAVELER_LEVEL} or higher in this
            region.
          </p>
        )}
      </section>
    </div>
  );
}
