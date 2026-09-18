'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
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
          className="fixed inset-0 z-40 bg-black/60 motion-reduce:transition-none md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`border-r border-[color:var(--border-ornate)] bg-[linear-gradient(180deg,rgba(11,22,33,0.98),rgba(8,15,24,0.99))] fixed inset-y-0 left-0 z-50 flex w-60 flex-col shadow-[var(--shadow-panel)] transition-transform duration-200 motion-reduce:transition-none md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border-ornate)] px-5 py-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/brand/lanternmere-master-crest.png"
              alt=""
              width={42}
              height={42}
              className="h-10 w-10 shrink-0 rounded-full border border-[color:var(--border-ornate)] object-cover"
            />
            <div>
            <span className="font-display block text-lg font-bold tracking-[0.12em] text-accent">
              Lanternmere
            </span>
            <span className="mt-1 block text-[0.65rem] tracking-[0.2em] text-text-muted uppercase">
              The Lodge Awaits
            </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded p-1 focus-visible:outline-2 md:hidden"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={onClose}
                  className={`focus-visible:outline-accent flex items-center gap-3 rounded-lg border px-2.5 py-2.5 text-sm transition-colors focus-visible:outline-2 ${
                    isActive
                      ? 'border-[color:var(--border-ornate)] bg-accent/12 text-accent shadow-[inset_0_0_24px_rgba(242,177,61,0.05)]'
                      : 'border-transparent text-text-muted hover:border-border hover:bg-surface-raised hover:text-text-primary'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${isActive ? 'border-[color:var(--border-ornate)] bg-accent/10' : 'border-border/70 bg-surface-sunken/50'}`}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
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
