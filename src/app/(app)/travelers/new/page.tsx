import Link from 'next/link';

export default function AddCharacterPage() {
  return (
    <section className="lodge-panel mx-auto max-w-xl p-6 sm:p-8">
      <p className="lodge-kicker">Travelers</p>
      <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Add your Traveler</h1>
      <p className="text-text-muted mt-4">
        Connect your Battle.net account, then choose a character from your private list. A public
        character name alone does not prove ownership.
      </p>
      <Link href="/account" className="lodge-button mt-6 inline-block px-5 py-2.5">
        Open your Battle.net characters
      </Link>
    </section>
  );
}
