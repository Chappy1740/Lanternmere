'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileNavigation } from './mobile-navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="focus:bg-accent focus:text-background sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-10 flex-1 p-4 pb-24 sm:p-6 sm:pb-24 md:p-8"
        >
          {children}
        </main>
        <MobileNavigation onMoreClick={() => setIsSidebarOpen(true)} />
      </div>
    </div>
  );
}
