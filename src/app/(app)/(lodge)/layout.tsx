import { getLodgeMemberships } from '@/lib/hearth/context';

export default async function LodgeLayout({ children }: { children: React.ReactNode }) {
  await getLodgeMemberships();
  return children;
}
