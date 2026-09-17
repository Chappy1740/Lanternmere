import Link from 'next/link';
import { getViewer } from '@/lib/hearth/context';
import { loadMainCharacter } from '@/lib/hearth/main-character';
import { CharacterPortrait } from '@/components/character-portrait';
import { CharacterFreshness } from '@/components/character-freshness';

const linkClass =
  'text-accent hover:text-accent-hover focus-visible:outline-accent inline-block rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4';

export async function MainCharacterHighlight() {
  const { supabase, user } = await getViewer();
  const result = await loadMainCharacter(supabase, user.id);
  const ready = result.state === 'ready' ? result : null;
  const name = ready?.profile?.name || ready?.character.character_name;
  const details = ready
    ? [
        ['Level', ready.character.level],
        ['Class', ready.character.class],
        ['Specialization', ready.profile?.active_spec?.name],
        ['Race', ready.profile?.race?.name],
        ['Faction', ready.character.faction],
        ['Equipped item level', ready.profile?.equipped_item_level],
      ].filter(([, value]) => value !== undefined && value !== null && value !== '')
    : [];

  return (
    <section
      aria-labelledby="main-character-heading"
      className="border-border rounded-lg border p-6 sm:p-8"
    >
      <h2 id="main-character-heading" className="font-display text-text-primary text-xl font-bold">
        Your Main character
      </h2>
      {ready && name ? (
        <>
          <div className="mt-5 flex items-center gap-4">
            <CharacterPortrait src={ready.profile?.portrait_url} name={name} />
            <div className="min-w-0">
              <h3 className="font-display text-text-primary text-2xl font-bold break-words">
                {name}
              </h3>
              <p className="text-text-muted mt-1 break-words">
                {ready.profile?.realm?.name || ready.character.realm_slug} ·{' '}
                {ready.character.region.toUpperCase()}
              </p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-text-muted text-sm">{label}</dt>
                <dd className="text-text-primary mt-1 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-border mt-6 space-y-2 border-t pt-4">
            <p className="text-text-muted text-sm">
              Source:{' '}
              {ready.snapshot?.source === 'blizzard'
                ? 'Blizzard'
                : ready.snapshot?.source || 'Unavailable'}
            </p>
            <CharacterFreshness
              refreshedAt={ready.snapshot?.last_refreshed_at}
              failedAt={ready.failedAt}
              statusUnavailable={ready.statusUnavailable}
            />
            {ready.snapshotUnavailable && (
              <p className="text-text-muted text-sm">
                Imported details are temporarily unavailable. Your saved character is still here.
              </p>
            )}
          </div>
          <Link href={`/travelers/${ready.character.id}`} className={`${linkClass} mt-5`}>
            View {name} and refresh options
          </Link>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-text-muted">
            {result.state === 'empty'
              ? 'A place is waiting for your Main. Add a World of Warcraft character or choose a Main in Travelers.'
              : 'Your Main character could not be loaded right now. You can still visit Travelers and try again.'}
          </p>
          <Link href="/travelers" className={linkClass}>
            Visit Travelers
          </Link>
        </div>
      )}
    </section>
  );
}
