import Link from 'next/link';
import { DoorOpen } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AcceptGuildInvitationForm } from '@/components/accept-guild-invitation-form';
import { createClient } from '@/lib/supabase/server';
export default async function GuildInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (
    !z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,128}$/)
      .safeParse(token).success
  )
    notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = encodeURIComponent(`/guild-invitations/${token}`);
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="lodge-panel w-full max-w-lg p-7 sm:p-10">
        <DoorOpen className="text-accent" size={30} aria-hidden="true" />
        <p className="lodge-kicker mt-6">An invitation awaits</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Join a Guild</h1>
        <p className="text-text-muted mt-4 leading-7">
          This invitation is single-use and expires after seven days.
        </p>
        {user ? (
          <AcceptGuildInvitationForm token={token} />
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/sign-in?next=${next}`} className="lodge-button px-5 py-2.5 font-medium">
              Sign in to join
            </Link>
            <Link
              href={`/sign-up?next=${next}`}
              className="lodge-button-secondary px-5 py-2.5 font-medium"
            >
              Create an account
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
