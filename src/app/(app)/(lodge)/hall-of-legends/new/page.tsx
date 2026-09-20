import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AchievementForm } from '@/components/achievement-form';
import { createAchievement } from '../actions';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

const characterSchema = z.object({
  id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
});

export default async function NewAchievementPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [params, memberships, { supabase, user }] = await Promise.all([
    searchParams,
    getLodgeMemberships(),
    getViewer(),
  ]);
  const selected =
    typeof params.lodge === 'string'
      ? memberships.find((member) => member.lodge_id === params.lodge)
      : undefined;
  if (!selected) notFound();
  const { data, error } = await supabase
    .from('characters')
    .select('id, character_name, realm_slug')
    .eq('profile_id', user.id)
    .order('character_name')
    .limit(100);
  const characters = error ? [] : (z.array(characterSchema).safeParse(data).data ?? []);
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/hall-of-legends?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Hall of Legends
      </Link>
      <header className="lodge-panel mt-6 p-6 sm:p-8">
        <p className="lodge-kicker">Hall of Legends</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          Record an achievement
        </h1>
        <p className="text-text-muted mt-3">
          Honor a Traveler&apos;s triumph or a Lodge milestone.
        </p>
      </header>
      <div className="mt-8">
        <AchievementForm
          action={createAchievement}
          lodgeId={selected.lodge_id}
          characters={characters}
        />
      </div>
    </div>
  );
}
