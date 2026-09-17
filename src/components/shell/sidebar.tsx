'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navItems } from '@/lib/navigation';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 motion-reduce:transition-none lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`border-border bg-background fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-accent text-xl font-bold">Lanternmere</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded p-1 focus-visible:outline-2 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={onClose}
                  className={`focus-visible:outline-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-muted hover:bg-surface-raised hover:text-text-primary'
                  }`}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-text-muted text-xs">{item.subtitle}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
