import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AchievementForm } from '@/components/achievement-form';
import { updateAchievement } from '../../actions';
import { loadAchievement } from '@/lib/achievements';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

const characterSchema = z.object({
  id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
});

export default async function EditAchievementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [{ id }, query, memberships, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    getLodgeMemberships(),
    getViewer(),
  ]);
  const selected =
    typeof query.lodge === 'string'
      ? memberships.find((member) => member.lodge_id === query.lodge)
      : undefined;
  if (!selected) notFound();
  const achievement = await loadAchievement(supabase, id, selected.lodge_id);
  const canManage =
    achievement &&
    (achievement.created_by === user.id ||
      selected.role === 'owner' ||
      selected.role === 'caretaker');
  if (!achievement || !canManage) notFound();
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
        href={`/hall-of-legends/${achievement.id}?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to achievement
      </Link>
      <header className="lodge-panel mt-6 p-6 sm:p-8">
        <p className="lodge-kicker">Hall of Legends</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          Edit an achievement
        </h1>
      </header>
      <div className="mt-8">
        <AchievementForm
          action={updateAchievement}
          lodgeId={selected.lodge_id}
          entry={achievement}
          characters={characters}
        />
      </div>
    </div>
  );
}
