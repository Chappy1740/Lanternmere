'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { navItems } from '@/lib/navigation';

const mobileItems = navItems.slice(0, 4);

export function MobileNavigation({ onMoreClick }: { onMoreClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--border-ornate)] bg-[rgba(8,15,24,0.96)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.32)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`focus-visible:outline-accent flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 py-1 text-[0.65rem] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isActive ? 'bg-accent/12 text-accent' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMoreClick} className="focus-visible:outline-accent flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-md px-1 py-1 text-[0.65rem] font-medium text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2">
            <MoreHorizontal size={19} aria-hidden="true" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
