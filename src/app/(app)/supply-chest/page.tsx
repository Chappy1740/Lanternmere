import Link from 'next/link';

const resources = [
  {
    title: 'Midnight Season 2 Mythic+ overview',
    source: 'World of Warcraft / Blizzard Entertainment',
    href: 'https://worldofwarcraft.blizzard.com/en-us/news/24294369',
    purpose: 'Official seasonal dungeon and reward information.',
  },
  {
    title: 'Browse dungeon routes',
    source: 'Keystone.guru / Raider.IO',
    href: 'https://keystone.guru/',
    purpose: 'Community route planning; check the season and key level before using a route.',
  },
  {
    title: 'Raider.IO character progress',
    source: 'Raider.IO',
    href: 'https://raider.io/',
    purpose:
      'External Mythic+ rankings and character profiles. Lanternmere shows only saved, consented snapshots.',
  },
];

export default function SupplyChestPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-7">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Selected external resources</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">The Supply Chest</h1>
        <p className="text-text-muted mt-3">
          A few source-attributed places to prepare a Mythic+ run. Links were checked October 3,
          2026; routes and seasonal details can change.
        </p>
      </header>
      <section className="lodge-panel p-6" aria-labelledby="mythic-resources-heading">
        <h2
          id="mythic-resources-heading"
          className="font-display text-text-primary text-2xl font-bold"
        >
          Mythic+ resources
        </h2>
        <ul className="mt-4 space-y-4">
          {resources.map((resource) => (
            <li
              key={resource.href}
              className="rounded-lg border border-[color:var(--border-ornate)] p-4"
            >
              <a
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent font-semibold underline"
              >
                {resource.title}
              </a>
              <p className="text-text-muted mt-1 text-sm">
                {resource.source} · {resource.purpose}
              </p>
            </li>
          ))}
        </ul>
        <Link href="/expedition-board" className="text-accent mt-5 inline-block underline">
          Return to the Expedition Board
        </Link>
      </section>
    </main>
  );
}
