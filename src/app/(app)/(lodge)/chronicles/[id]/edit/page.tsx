import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChronicleForm } from '@/components/chronicle-form';
import { updateChronicle } from '../../actions';
import { loadChronicle } from '@/lib/chronicles';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function EditChroniclePage({
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
      ? memberships.find((membership) => membership.lodge_id === query.lodge)
      : undefined;
  if (!selected) notFound();
  const entry = await loadChronicle(supabase, id, selected.lodge_id);
  const canManage =
    entry &&
    (entry.author_id === user.id || selected.role === 'owner' || selected.role === 'caretaker');
  if (!entry || !canManage) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/chronicles/${entry.id}?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Chronicle
      </Link>
      <header className="lodge-panel mt-6 p-6 sm:p-8">
        <p className="lodge-kicker">Chronicles</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Edit a memory</h1>
      </header>
      <div className="mt-8">
        <ChronicleForm action={updateChronicle} lodgeId={selected.lodge_id} entry={entry} />
      </div>
    </div>
  );
}
