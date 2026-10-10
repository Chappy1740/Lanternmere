import Link from 'next/link';

export default function SignalFireUnavailable() {
  return (
    <section className="lodge-panel mx-auto max-w-3xl space-y-4 p-5 sm:p-8">
      <h1 className="font-display text-2xl">Conversation unavailable</h1>
      <p>Sorry, this conversation isn’t available to this account.</p>
      <p className="text-text-muted text-sm">
        Signal Fire conversations are private to the person who sent them and the Lanternmere owner.
        The link may also be incorrect, or the conversation may have been removed.
      </p>
      <Link href="/signal-fire" className="lodge-button-secondary inline-flex px-4 py-2">
        Back to The Signal Fire
      </Link>
    </section>
  );
}
