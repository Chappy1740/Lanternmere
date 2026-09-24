import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Compass,
  Users,
  Swords,
  CalendarDays,
  Trophy,
  BookOpen,
  Building2,
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
  { label: 'Create Lodge', subtitle: 'Start a new gathering', href: '/lodges/new', icon: PlusCircle },
];
