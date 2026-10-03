import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Compass,
  Users,
  Swords,
  CalendarDays,
  Trophy,
  BookOpen,
  ChartNoAxesCombined,
  Building2,
  ClipboardList,
  Hammer,
  Package,
  Settings,
  PlusCircle,
} from 'lucide-react';

export type NavItem = {
  label: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: 'The Hearth', subtitle: 'Dashboard', href: '/hearth', icon: Home },
  { label: 'War Table', subtitle: 'Weekly Command', href: '/war-table', icon: Compass },
  { label: 'Travelers', subtitle: 'Members', href: '/travelers', icon: Users },
  { label: 'Guild Hall', subtitle: 'Guild Operations', href: '/guild-hall', icon: Building2 },
  { label: 'The Muster', subtitle: 'Recruitment & Trials', href: '/muster', icon: ClipboardList },
  { label: 'Artisan Hall', subtitle: 'Crafting & Supplies', href: '/artisan-hall', icon: Hammer },
  {
    label: 'Expedition Board',
    subtitle: 'Mythic+ Groups',
    href: '/expedition-board',
    icon: Swords,
  },
  {
    label: 'Chronicle Lens',
    subtitle: 'Progression Review',
    href: '/chronicle-lens',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Adventures',
    subtitle: 'Raids · Mythic+ · PvP',
    href: '/adventures',
    icon: Swords,
  },
  {
    label: 'Quest Board',
    subtitle: 'Upcoming Events',
    href: '/quest-board',
    icon: CalendarDays,
  },
  {
    label: 'Hall of Legends',
    subtitle: 'Achievements',
    href: '/hall-of-legends',
    icon: Trophy,
  },
  {
    label: 'Chronicles',
    subtitle: 'Stories & Memories',
    href: '/chronicles',
    icon: BookOpen,
  },
  {
    label: 'Supply Chest',
    subtitle: 'Resources & Guides',
    href: '/supply-chest',
    icon: Package,
  },
  {
    label: "Caretaker's Office",
    subtitle: 'Settings',
    href: '/caretakers-office',
    icon: Settings,
  },
  {
    label: 'Create Lodge',
    subtitle: 'Start a new gathering',
    href: '/lodges/new',
    icon: PlusCircle,
  },
  { label: 'Membership', subtitle: 'Your directory privacy', href: '/membership', icon: Users },
  { label: 'Your account', subtitle: 'Nickname & Battle.net', href: '/account', icon: Users },
];
