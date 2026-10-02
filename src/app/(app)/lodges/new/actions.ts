'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type CreateLodgeState = {
  error: string | null;
};

export async function createLodge(
  _prevState: CreateLodgeState,
  formData: FormData,
): Promise<CreateLodgeState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!name) {
    return { error: 'Lodge name is required.' };
  }
  if (name.length > 60) return { error: 'Lodge name must be 60 characters or fewer.' };
  if (description.length > 500) return { error: 'Description must be 500 characters or fewer.' };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_lodge', {
    p_name: name,
    p_description: description || null,
  });

  if (error) {
    return { error: 'The Lodge could not be created. Please try again.' };
  }

  if (!data) {
    return { error: 'The Lodge could not be created.' };
  }

  redirect('/hearth');
}
