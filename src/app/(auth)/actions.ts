'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { gameNicknameSchema } from '@/lib/account-nickname';

export type AuthActionState = {
  error: string | null;
  success?: string | null;
};

function returnTo(formData: FormData) {
  const value = formData.get('returnTo');
  return typeof value === 'string' &&
    /^\/(?:invitations|guild-invitations)\/[A-Za-z0-9_-]{32,128}$/.test(value)
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
    if (error.code === 'invalid_credentials') {
      return { error: 'Invalid email or password.' };
    }
    if (error.code === 'email_not_confirmed') {
      return {
        error:
          'Confirm your email before signing in. Open your signup email and click “Confirm email address”. Check your spam or junk folder if you cannot find it.',
      };
    }

    return { error: 'Sign-in is temporarily unavailable. Check your connection and try again.' };
  }

  const { error: accessError } = await supabase.auth.getUser();
  if (accessError) {
    await supabase.auth.signOut();
    return { error: 'This account cannot currently access Lanternmere. Contact the app owner.' };
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
  const nickname = gameNicknameSchema.safeParse(displayName);
  if (!nickname.success)
    return { error: 'Choose a game nickname of 2–32 characters without an email address.' };
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
  const origin = (await headers()).get('origin');
  if (!origin) return { error: 'Sign-up is temporarily unavailable. Please try again.' };
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: nickname.data,
        directory_opt_in: formData.get('directoryOptIn') === 'on',
      },
      emailRedirectTo: `${origin}/auth/callback?next=/account`,
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

export async function signOut(_previousState: AuthActionState): Promise<AuthActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: 'Sign-out is temporarily unavailable. Please try again.' };
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailValue = formData.get('email');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
  try {
    const origin = (await headers()).get('origin');
    if (!origin) return { error: 'Password recovery is unavailable right now. Please try again.' };
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  } catch {
    return { error: 'Password recovery is unavailable right now. Please try again.' };
  }
  return {
    error: null,
    success: 'If that email belongs to an account, a password-reset link is on its way.',
  };
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const passwordValue = formData.get('password');
  const confirmPasswordValue = formData.get('confirmPassword');
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  const confirmPassword = typeof confirmPasswordValue === 'string' ? confirmPasswordValue : '';
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirmPassword) return { error: 'Passwords do not match.' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Your reset link has expired. Request a new one.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      return { error: 'Your password could not be updated. Request a new link and try again.' };
  } catch {
    return { error: 'Your password could not be updated. Request a new link and try again.' };
  }
  revalidatePath('/', 'layout');
  return { error: null, success: 'Password updated. You can now sign in.' };
}
