'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthActionState = {
  error: string | null;
};

function returnTo(formData: FormData) {
  const value = formData.get('returnTo');
  return typeof value === 'string' && /^\/invitations\/[A-Za-z0-9_-]{32,128}$/.test(value)
    ? value
    : null;
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const destination = returnTo(formData);

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Invalid email or password.' };
  }

  revalidatePath('/', 'layout');
  redirect(destination ?? '/hearth');
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const displayName = formData.get('displayName') as string;
  const destination = returnTo(formData);

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || undefined },
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect(
    `/sign-in?confirmEmail=1${destination ? `&next=${encodeURIComponent(destination)}` : ''}`,
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}
