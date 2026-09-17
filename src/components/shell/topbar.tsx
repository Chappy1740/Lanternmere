'use client';

import { Menu, Search, Bell } from 'lucide-react';

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="border-border bg-surface flex items-center justify-between border-b px-4 py-3 lg:px-6">
      <button
        onClick={onMenuClick}
        aria-expanded={false}
        aria-controls="primary-navigation"
        aria-label="Open navigation"
        className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded p-2 focus-visible:outline-2 lg:hidden"
      >
        <Menu size={22} />
      </button>

      <div className="border-border bg-surface-raised text-text-muted hidden flex-1 items-center gap-2 rounded-md border px-3 py-1.5 text-sm lg:flex lg:max-w-xs">
        <Search size={16} aria-hidden="true" />
        <span>Search…</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded p-2 focus-visible:outline-2"
        >
          <Bell size={20} />
        </button>
        <div
          className="bg-accent/20 h-8 w-8 rounded-full"
          role="img"
          aria-label="User avatar placeholder"
        />
      </div>
    </header>
  );
}
