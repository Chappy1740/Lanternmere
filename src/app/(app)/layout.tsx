import { AppShell } from '@/components/shell/app-shell';
import { getViewer } from '@/lib/hearth/context';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await getViewer();
  return <AppShell>{children}</AppShell>;
}
