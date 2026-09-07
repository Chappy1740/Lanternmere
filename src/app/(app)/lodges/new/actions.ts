'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type CreateLodgeState = {
  error: string | null;
};

export async function createLodge(
  _prevState: CreateLodgeState,
  formData: FormData
): Promise<CreateLodgeState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!name) {
    return { error: 'Lodge name is required.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_lodge', {
    p_name: name,
    p_description: description || null,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: 'The Lodge could not be created.' };
  }

  redirect('/hearth');
}