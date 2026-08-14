import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Users,
  Swords,
  CalendarDays,
  Trophy,
  BookOpen,
  Package,
  Settings,
} from 'lucide-react';

export type NavItem = {
  label: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: 'The Hearth', subtitle: 'Dashboard', href: '/hearth', icon: Home },
  { label: 'Travelers', subtitle: 'Members', href: '/travelers', icon: Users },
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
];