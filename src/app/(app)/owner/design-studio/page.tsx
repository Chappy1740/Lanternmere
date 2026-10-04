import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  ChartNoAxesCombined,
  Crown,
  Gem,
  Hammer,
  Shield,
  Sparkles,
  Swords,
  Target,
} from 'lucide-react';
import { serverEnv } from '@/lib/env.server';
import { getViewer } from '@/lib/hearth/context';

export const metadata: Metadata = {
  title: 'Owner design studio | Lanternmere',
  robots: { index: false, follow: false },
};

type Concept = 'guild' | 'wishlist' | 'profile';

const concepts: { id: Concept; label: string; description: string }[] = [
  { id: 'guild', label: 'Guild front page', description: 'Progress, plans, and open roles' },
  { id: 'wishlist', label: 'Gear wishlists', description: 'Player wants and item context' },
  { id: 'profile', label: 'Main profile', description: 'Character progress at a glance' },
];

function ConceptCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1724]/80 p-4">
      <p className="text-text-muted text-xs tracking-[0.16em] uppercase">{label}</p>
      <p className="text-text-primary mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-text-muted mt-1 text-sm">{detail}</p>
    </div>
  );
}

function GuildConcept() {
  const bosses = [
    'Ashkeeper',
    'The Hollow',
    'Veyra',
    'Iron Wake',
    'Starfall',
    'The Crown',
    'The Gate',
    'The Last Flame',
  ];
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-[radial-gradient(circle_at_85%_15%,rgba(242,177,61,0.24),transparent_28%),linear-gradient(120deg,#172b35,#0b1725_65%)] p-6 sm:p-8">
        <p className="text-accent text-xs font-semibold tracking-[0.22em] uppercase">
          Guild hall concept
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-text-primary text-3xl sm:text-4xl">The Emberwatch</h2>
            <p className="text-text-muted mt-2">Stormrage · US · A home for steady progress</p>
          </div>
          <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            Recruiting healers
          </span>
        </div>
        <p className="text-text-muted mt-6 max-w-2xl text-sm leading-relaxed">
          A clear first stop for members and applicants: recent kills, the next raid, and what the
          Guild needs. Each number would link to its source when this becomes a real feature.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <ConceptCard label="Raid progress" value="5 / 8" detail="Heroic · sample season" />
        <ConceptCard label="Next gathering" value="Thursday" detail="8:00 PM · sample schedule" />
        <ConceptCard label="Open roles" value="2" detail="Healer and ranged DPS" />
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="lodge-panel p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Crown className="text-accent size-5" aria-hidden="true" />
            <h3 className="font-display text-text-primary text-xl">The current raid</h3>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            A readable boss trail, with the source and date beside each verified result.
          </p>
          <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {bosses.map((boss, index) => (
              <li
                key={boss}
                className={`rounded-lg border p-3 text-sm ${index < 5 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'text-text-muted border-white/10 bg-black/15'}`}
              >
                <span className="block text-xs opacity-70">{index < 5 ? 'Defeated' : 'Ahead'}</span>
                <span className="mt-1 block font-medium">{boss}</span>
              </li>
            ))}
          </ol>
          <p className="text-text-muted mt-4 text-xs">
            Sample encounters and results for layout review only.
          </p>
        </div>
        <div className="space-y-5">
          <div className="lodge-panel p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-accent size-5" aria-hidden="true" />
              <h3 className="font-display text-text-primary text-lg">Next on the calendar</h3>
            </div>
            <p className="text-text-primary mt-4 font-semibold">Citadel progression</p>
            <p className="text-text-muted mt-1 text-sm">Thursday · 8:00–11:00 PM Central</p>
            <p className="text-text-muted mt-3 text-sm">18 ready · 2 tentative · 3 open spots</p>
          </div>
          <div className="lodge-panel p-5">
            <div className="flex items-center gap-2">
              <Target className="text-accent size-5" aria-hidden="true" />
              <h3 className="font-display text-text-primary text-lg">The Muster</h3>
            </div>
            <p className="text-text-muted mt-3 text-sm">
              One healer and one ranged damage slot are open.
            </p>
            <p className="text-accent mt-3 text-sm">View needs and application status →</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function WishlistConcept() {
  const items = [
    {
      name: 'Lanternforged Band',
      slot: 'Ring',
      source: 'The Crown',
      priority: 'First choice',
      demand: '4 interested',
      icon: Gem,
    },
    {
      name: 'Bulwark of the Vale',
      slot: 'Shield',
      source: 'Iron Wake',
      priority: 'Second choice',
      demand: '2 interested',
      icon: Shield,
    },
    {
      name: 'Emberglass Scepter',
      slot: 'Weapon',
      source: 'Starfall',
      priority: 'Third choice',
      demand: '3 interested',
      icon: Swords,
    },
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-300/25 bg-[linear-gradient(120deg,#261f20,#101e2a_70%)] p-6 sm:p-8">
        <p className="text-accent text-xs font-semibold tracking-[0.22em] uppercase">
          Gear planning concept
        </p>
        <h2 className="font-display text-text-primary mt-3 text-3xl">A wishlist with context</h2>
        <p className="text-text-muted mt-3 max-w-2xl text-sm leading-relaxed">
          A player can see what they want and where it comes from. Leadership can compare demand
          alongside recorded loot, without treating a wishlist as an automatic award decision.
        </p>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="lodge-panel p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Gem className="text-accent size-5" aria-hidden="true" />
            <h3 className="font-display text-text-primary text-xl">My ranked wishes</h3>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            A proposed personal list. Nothing here is a loot promise.
          </p>
          <ol className="mt-5 space-y-3">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.name}
                  className="flex gap-4 rounded-xl border border-white/10 bg-[#0b1724]/75 p-4"
                >
                  <span className="text-accent text-lg font-semibold">{index + 1}</span>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10">
                    <Icon className="text-accent size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary font-semibold">{item.name}</p>
                    <p className="text-text-muted text-sm">
                      {item.slot} · {item.source}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-200">
                        {item.priority}
                      </span>
                      <span className="text-text-muted rounded-full bg-white/5 px-2 py-1">
                        {item.demand}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <div className="space-y-5">
          <section className="lodge-panel p-5">
            <div className="flex items-center gap-2">
              <Hammer className="text-accent size-5" aria-hidden="true" />
              <h3 className="font-display text-text-primary text-lg">Selected item</h3>
            </div>
            <p className="text-text-primary mt-4 font-semibold">Lanternforged Band</p>
            <p className="text-text-muted mt-1 text-sm">Ring · The Crown · Heroic</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ConceptCard label="Wishes" value="4" detail="Player-entered" />
              <ConceptCard label="Received" value="1" detail="Recorded award" />
            </div>
            <p className="text-text-muted mt-4 text-sm">
              Officer guidance would appear only to people with the right Guild permission.
            </p>
          </section>
          <section className="lodge-panel p-5">
            <h3 className="font-display text-text-primary text-lg">Clear record types</h3>
            <ul className="text-text-muted mt-3 space-y-2 text-sm">
              <li>Wishlisted: what a player hopes to get.</li>
              <li>Priority: a separate Guild decision.</li>
              <li>Received: an item recorded as awarded.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileConcept() {
  const gear = [
    { slot: 'Weapon', item: 'Emberglass Scepter', level: '328', detail: 'Upgrade available' },
    { slot: 'Helm', item: 'Helm of Quiet Stars', level: '324', detail: 'Enchanted' },
    { slot: 'Ring', item: 'Lanternforged Band', level: '321', detail: 'Wishlisted upgrade' },
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-300/25 bg-[radial-gradient(circle_at_15%_10%,rgba(30,61,69,0.8),transparent_32%),linear-gradient(115deg,#112232,#221d20)] p-6 sm:p-8">
        <p className="text-accent text-xs font-semibold tracking-[0.22em] uppercase">
          Main Hearth concept
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="flex size-20 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10">
            <Sparkles className="text-accent size-9" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-text-primary text-3xl">Aurell</h2>
            <p className="text-text-muted mt-1">Stormrage · Mage · Sample character</p>
          </div>
          <div className="ml-auto rounded-xl border border-amber-300/25 bg-black/20 px-5 py-3 text-center">
            <p className="text-text-muted text-xs tracking-widest uppercase">Item level</p>
            <p className="text-accent text-2xl font-semibold">324.8</p>
          </div>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        <ConceptCard label="Mythic+ score" value="2,840" detail="External snapshot · sample" />
        <ConceptCard label="Raid progress" value="5 / 8 H" detail="Source-linked when available" />
        <ConceptCard label="Vault notes" value="2 plans" detail="Entered by this player" />
      </div>
      <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="lodge-panel p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined className="text-accent size-5" aria-hidden="true" />
            <h3 className="font-display text-text-primary text-xl">Season rhythm</h3>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            Weekly score snapshots, with dates and source labels.
          </p>
          <div
            className="mt-6 flex h-28 items-end gap-2"
            aria-label="Sample score trend rises over six weeks"
          >
            {[35, 42, 58, 72, 68, 86].map((height, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-teal-800 to-amber-300/85"
                  style={{ height: `${height}%` }}
                />
                <span className="text-text-muted text-xs">{index + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-text-muted mt-4 text-xs">Weeks 1–6 · illustrative data</p>
        </div>
        <div className="lodge-panel p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Swords className="text-accent size-5" aria-hidden="true" />
            <h3 className="font-display text-text-primary text-xl">Gear with next steps</h3>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            A scan-friendly list of equipped gear and player goals.
          </p>
          <ul className="mt-4 divide-y divide-white/10">
            {gear.map((piece) => (
              <li key={piece.slot} className="grid grid-cols-[4rem_1fr_auto] gap-3 py-3 text-sm">
                <span className="text-text-muted">{piece.slot}</span>
                <span className="text-text-primary">
                  {piece.item}
                  <span className="text-text-muted block text-xs">{piece.detail}</span>
                </span>
                <span className="text-accent font-semibold">{piece.level}</span>
              </li>
            ))}
          </ul>
          <p className="text-text-muted mt-3 text-xs">
            A live version needs verified item imports before showing real equipment or enchants.
          </p>
        </div>
      </section>
    </div>
  );
}

export default async function OwnerDesignStudio({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string | string[] }>;
}) {
  const { user } = await getViewer();
  if (!serverEnv.APP_OWNER_PROFILE_ID || user.id !== serverEnv.APP_OWNER_PROFILE_ID) notFound();
  const selected = (await searchParams).concept;
  const concept: Concept = selected === 'wishlist' || selected === 'profile' ? selected : 'guild';

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Owner-only · design concepts</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl sm:text-4xl">
          Lanternmere design studio
        </h1>
        <p className="text-text-muted mt-3 max-w-3xl text-sm leading-relaxed">
          Three early layouts for Guild progress, gear wishes, and your Main Hearth profile. All
          names, items, scores, and events below are fictional samples. These screens do not read
          member data or change Guild records.
        </p>
      </header>

      <nav aria-label="Design concepts" className="grid gap-2 sm:grid-cols-3">
        {concepts.map((item) => (
          <Link
            key={item.id}
            href={`/owner/design-studio?concept=${item.id}`}
            aria-current={concept === item.id ? 'page' : undefined}
            className={`focus-visible:outline-accent rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${concept === item.id ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/10 bg-[#101d2a] hover:border-amber-300/35'}`}
          >
            <span className="text-text-primary block font-semibold">{item.label}</span>
            <span className="text-text-muted mt-1 block text-sm">{item.description}</span>
          </Link>
        ))}
      </nav>

      {concept === 'guild' ? (
        <GuildConcept />
      ) : concept === 'wishlist' ? (
        <WishlistConcept />
      ) : (
        <ProfileConcept />
      )}

      <aside className="lodge-panel p-5 text-sm">
        <h2 className="font-display text-text-primary text-lg">What informed these layouts</h2>
        <p className="text-text-muted mt-2 leading-relaxed">
          WoWAudit’s compact progress overview, Guilds of WoW’s guild home and recruitment grouping,
          and That’s My BIS’s separation of wishes, priority, and recorded loot. The screens above
          are original Lanternmere concepts and use no copied site assets.
        </p>
        <div className="text-accent mt-3 flex flex-wrap gap-x-5 gap-y-2 underline">
          <a href="https://wowaudit.com/" target="_blank" rel="noopener noreferrer">
            WoWAudit
          </a>
          <a href="https://guildsofwow.com/features" target="_blank" rel="noopener noreferrer">
            Guilds of WoW
          </a>
          <a
            href="https://thatsmybis.com/wiki/item-details"
            target="_blank"
            rel="noopener noreferrer"
          >
            That’s My BIS
          </a>
        </div>
      </aside>
    </main>
  );
}
