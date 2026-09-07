import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LodgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { data: membership, error } = await supabase
    .from('lodge_members')
    .select('id')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to verify Lodge membership.');
  }

  if (!membership) {
    redirect('/lodges/new');
  }

  return children;
}