import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChronicleForm } from '@/components/chronicle-form';
import { createChronicle } from '../actions';
import { getLodgeMemberships } from '@/lib/hearth/context';

export default async function NewChroniclePage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [memberships, params] = await Promise.all([getLodgeMemberships(), searchParams]);
  const selected =
    typeof params.lodge === 'string'
      ? memberships.find((membership) => membership.lodge_id === params.lodge)
      : undefined;
  if (!selected) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/chronicles?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Chronicles
      </Link>
      <header className="lodge-panel mt-6 p-6 sm:p-8">
        <p className="lodge-kicker">Chronicles</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Record a memory</h1>
        <p className="text-text-muted mt-2">
          This story will be shared with members of {selected.lodges.name}.
        </p>
      </header>
      <div className="mt-8">
        <ChronicleForm action={createChronicle} lodgeId={selected.lodge_id} />
      </div>
    </div>
  );
}
