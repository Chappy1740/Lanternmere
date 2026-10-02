'use client';

import { useActionState } from 'react';
import { Menu, Search, Bell, LogOut } from 'lucide-react';
import Image from 'next/image';
import { signOut, type AuthActionState } from '@/app/(auth)/actions';

const initialSignOutState: AuthActionState = { error: null };

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const [signOutState, signOutAction, signingOut] = useActionState(signOut, initialSignOutState);
  return (
    <header className="flex items-center justify-between border-b border-[color:var(--border-ornate)] bg-[rgba(9,17,29,0.76)] px-4 py-3 backdrop-blur md:px-8">
      <button
        onClick={onMenuClick}
        aria-expanded={false}
        aria-controls="primary-navigation"
        aria-label="Open navigation"
        className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded p-2 focus-visible:outline-2 md:hidden"
      >
        <Menu size={22} />
      </button>

      <div className="border-border bg-surface-raised text-text-muted hidden flex-1 items-center gap-2 rounded-md border px-3 py-1.5 text-sm md:flex md:max-w-xs">
        <Search size={16} aria-hidden="true" />
        <span>Search…</span>
      </div>

      <div className="flex items-center gap-4">
        <form action={signOutAction} className="flex max-w-56 flex-col items-end gap-1">
          <button
            type="submit"
            disabled={signingOut}
            className="lodge-button-secondary flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-60"
          >
            <LogOut size={16} aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {signOutState.error && (
            <p role="alert" className="text-xs text-red-300">
              {signOutState.error}
            </p>
          )}
        </form>
        <button
          aria-label="Notifications"
          className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded p-2 focus-visible:outline-2"
        >
          <Bell size={20} />
        </button>
        <Image
          src="/brand/lanternmere-master-crest.png"
          alt="Lodge insignia"
          width={32}
          height={32}
          className="bg-accent/10 h-8 w-8 rounded-full border border-[color:var(--border-ornate)] object-cover"
        />
      </div>
    </header>
  );
}
