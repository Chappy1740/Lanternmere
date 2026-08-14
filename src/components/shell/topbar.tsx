'use client';

import { Menu, Search, Bell } from 'lucide-react';

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:px-6">
      <button
        onClick={onMenuClick}
        aria-expanded={false}
        aria-controls="primary-navigation"
        aria-label="Open navigation"
        className="rounded p-2 text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
      >
        <Menu size={22} />
      </button>

      <div className="hidden flex-1 items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-text-muted lg:flex lg:max-w-xs">
        <Search size={16} aria-hidden="true" />
        <span>Search…</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="rounded p-2 text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Bell size={20} />
        </button>
        <div
          className="h-8 w-8 rounded-full bg-accent/20"
          role="img"
          aria-label="User avatar placeholder"
        />
      </div>
    </header>
  );
}