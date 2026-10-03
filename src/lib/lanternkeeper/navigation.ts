export type LanternkeeperDestination = { label: string; href: string; explanation: string };

// Fixed, local destinations only. A question cannot turn into an arbitrary URL or database query.
export function findLanternkeeperDestination(
  question: string,
  guildId: string,
): LanternkeeperDestination | null {
  const words = question.toLowerCase().slice(0, 160);
  if (/boss|kill|progress|warcraft logs|raider\.io/.test(words))
    return {
      label: 'Chronicle Lens',
      href: `/chronicle-lens?guild=${guildId}`,
      explanation:
        'Review public report and progression context. A report is not automatically a Guild kill.',
    };
  if (/apply|applicant|recruit|trial|muster/.test(words))
    return {
      label: 'The Muster',
      href: `/muster?guild=${guildId}`,
      explanation: 'Open the recruitment and trial records you are allowed to see.',
    };
  if (/craft|profession|recipe|supply/.test(words))
    return {
      label: 'Artisan Hall',
      href: `/artisan-hall?guild=${guildId}`,
      explanation: 'Find published crafting offers and Guild supply goals.',
    };
  if (/guide|resource|strategy|website/.test(words))
    return {
      label: 'Supply Chest',
      href: '/supply-chest',
      explanation: 'Find a reviewed resource rather than a guessed external link.',
    };
  if (/loot|attendance|roster|raid|encounter/.test(words))
    return {
      label: 'Guild Hall',
      href: `/guild-hall?guild=${guildId}`,
      explanation: 'Open raid operations, attendance, roster, and linked Raid Room records.',
    };
  if (/vault|availability|calendar|week|confirm/.test(words))
    return {
      label: 'War Table',
      href: '/war-table',
      explanation: 'Check weekly plans, availability, and shared Vault context.',
    };
  return null;
}
