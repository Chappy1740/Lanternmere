import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteChronicleControl } from '@/components/delete-chronicle-control';
import { DeleteChronicleMediaControl } from '@/components/delete-chronicle-media-control';
import { chronicleDate, loadChronicle, loadChronicleMedia } from '@/lib/chronicles';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function ChronicleDetailPage({
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
  const [entry, media] = await Promise.all([
    loadChronicle(supabase, id, selected.lodge_id),
    loadChronicleMedia(supabase, id, selected.lodge_id),
  ]);
  if (!entry) notFound();
  const canManage =
    entry.author_id === user.id || selected.role === 'owner' || selected.role === 'caretaker';
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href={`/chronicles?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Chronicles
      </Link>
      <article className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">{chronicleDate(entry.created_at)}</p>
        <h1 className="font-display text-text-primary mt-3 text-4xl font-bold break-words">
          {entry.title?.trim() || 'Untitled Chronicle'}
        </h1>
        <p className="text-text-muted mt-3 text-sm">
          Recorded by {entry.profiles?.display_name?.trim() || 'a Lodge member'}
        </p>
        <div className="text-text-primary mt-8 leading-7 break-words whitespace-pre-line">
          {entry.body?.trim() || 'No story was recorded.'}
        </div>
        {media && media.length > 0 && (
          <section aria-labelledby="chronicle-images-heading" className="mt-8">
            <h2
              id="chronicle-images-heading"
              className="font-display text-text-primary text-xl font-bold"
            >
              Chronicle images
            </h2>
            <ul className="mt-4 grid gap-5 sm:grid-cols-2">
              {media.map((image) => (
                <li key={image.id} className="lodge-list-row overflow-hidden">
                  {image.url ? (
                    // Signed private URLs are created only after the Lodge-scoped media read.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt={image.caption || 'Chronicle image'}
                      className="h-auto w-full"
                    />
                  ) : (
                    <p className="text-text-muted p-4 text-sm">This image is unavailable.</p>
                  )}
                  <div className="p-4">
                    {image.caption && (
                      <p className="text-text-primary break-words">{image.caption}</p>
                    )}
                    {(image.uploaded_by === user.id ||
                      selected.role === 'owner' ||
                      selected.role === 'caretaker') && (
                      <div className="mt-3">
                        <DeleteChronicleMediaControl mediaId={image.id} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {canManage && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={`/chronicles/${entry.id}/edit?lodge=${selected.lodge_id}`}
              className="lodge-button px-4 py-2 font-medium"
            >
              Edit Chronicle
            </Link>
            <DeleteChronicleControl chronicleId={entry.id} />
          </div>
        )}
      </article>
    </div>
  );
}
