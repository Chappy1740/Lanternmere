import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, Package, Settings, Swords, Trophy } from 'lucide-react';

const rooms = {
  adventures: {
    title: 'Adventures',
    eyebrow: 'The road ahead',
    description: 'Raids, Mythic+, and PvP plans will gather here when this Lodge is ready to set out.',
    icon: Swords,
  },
  'hall-of-legends': {
    title: 'Hall of Legends',
    eyebrow: 'The records endure',
    description: 'A permanent home for Lodge achievements and the stories behind them.',
    icon: Trophy,
  },
  chronicles: {
    title: 'Chronicles',
    eyebrow: 'Stories & memories',
    description: 'Shared memories will be gathered here as the Chronicle opens to the Lodge.',
    icon: BookOpen,
  },
  'supply-chest': {
    title: 'Supply Chest',
    eyebrow: 'Resources & guides',
    description: 'Guides and useful resources will have a home here when the Supply Chest is stocked.',
    icon: Package,
  },
  'caretakers-office': {
    title: "Caretaker's Office",
    eyebrow: 'Lodge settings',
    description: 'Lodge management tools will appear here in a future milestone.',
    icon: Settings,
  },
} as const;

export default async function LodgeRoomPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const room = rooms[section as keyof typeof rooms];

  if (!room) notFound();

  const Icon = room.icon;

  return (
    <div className="mx-auto max-w-3xl">
      <section className="lodge-panel overflow-hidden p-7 sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[color:var(--border-ornate)] bg-accent/10 text-accent shadow-[inset_0_0_22px_rgba(242,177,61,0.08)]">
          <Icon size={27} aria-hidden="true" />
        </div>
        <p className="lodge-kicker mt-7">{room.eyebrow}</p>
        <h1 className="font-display text-text-primary mt-2 text-4xl font-bold">{room.title}</h1>
        <p className="text-text-muted mt-4 max-w-xl leading-7">{room.description}</p>

        <div className="mt-8 rounded-lg border border-[color:var(--border-ornate)] bg-surface-sunken/45 p-5">
          <p className="text-text-primary text-base font-semibold">This room is being prepared.</p>
          <p className="text-text-muted mt-2 text-sm leading-6">
            It is intentionally not available yet. The active Lodge tools are ready on the Hearth,
            Travelers, and Quest Board.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/hearth" className="lodge-button px-5 py-2.5 font-medium">
            Return to the Hearth
          </Link>
          <Link href="/quest-board" className="lodge-button-secondary px-5 py-2.5 font-medium">
            Visit the Quest Board
          </Link>
        </div>
      </section>
    </div>
  );
}
