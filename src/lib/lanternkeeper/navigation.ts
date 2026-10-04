export type LanternkeeperDestination = { label: string; href: string; explanation: string };

// Fixed, local destinations only. A question cannot turn into an arbitrary URL or database query.
export function findLanternkeeperDestination(
  question: string,
  guildId: string,
): LanternkeeperDestination | null {
  const words = question.toLowerCase().slice(0, 160);
  const destinations: Record<string, LanternkeeperDestination> = {
    'chronicle lens': {
      label: 'Chronicle Lens',
      href: `/chronicle-lens?guild=${guildId}`,
      explanation:
        'Review public report and progression context. A report is not automatically a Guild kill.',
    },
    muster: {
      label: 'The Muster',
      href: `/muster?guild=${guildId}`,
      explanation: 'Open the recruitment and trial records you are allowed to see.',
    },
    'artisan hall': {
      label: 'Artisan Hall',
      href: `/artisan-hall?guild=${guildId}`,
      explanation: 'Find published crafting offers and Guild supply goals.',
    },
    'supply chest': {
      label: 'Supply Chest',
      href: '/supply-chest',
      explanation: 'Find a reviewed resource rather than a guessed external link.',
    },
    'guild hall': {
      label: 'Guild Hall',
      href: `/guild-hall?guild=${guildId}`,
      explanation: 'Open raid operations, attendance, roster, and linked Raid Room records.',
    },
    'war table': {
      label: 'War Table',
      href: '/war-table',
      explanation: 'Check weekly plans, availability, and shared Vault context.',
    },
  };
  const exact = words
    .trim()
    .replace(/[?.!]$/, '')
    .replace(/^the /, '');
  if (Object.hasOwn(destinations, exact)) return destinations[exact];
  if (/supply chest|guide|resource|strategy|website/.test(words))
    return destinations['supply chest'];
  if (/boss|kill|progress|warcraft logs|raider\.io/.test(words))
    return destinations['chronicle lens'];
  if (/apply|applicant|recruit|trial|muster/.test(words)) return destinations.muster;
  if (/craft|profession|recipe|supply/.test(words)) return destinations['artisan hall'];
  if (/loot|attendance|roster|raid|encounter/.test(words)) return destinations['guild hall'];
  if (/vault|availability|calendar|week|confirm/.test(words)) return destinations['war table'];
  return null;
}
