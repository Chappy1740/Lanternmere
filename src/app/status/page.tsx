import Link from 'next/link';
import type { Metadata } from 'next';
import { ProjectStatusDashboard } from '@/components/project-status-dashboard';
import { bundledProjectTracker } from '@/lib/project-status';

export const metadata: Metadata = {
  title: 'Project status | Lanternmere',
  description: 'Lanternmere roadmap progress, remaining work, and requested changes.',
};

export default function StatusPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-8 flex items-center justify-between gap-4 text-sm">
        <Link href="/" className="font-display text-accent text-xl font-semibold">
          Lanternmere
        </Link>
        <Link href="/" className="text-text-muted hover:text-accent">
          Back to the site
        </Link>
      </nav>
      <ProjectStatusDashboard initialTracker={bundledProjectTracker} />
    </main>
  );
}
