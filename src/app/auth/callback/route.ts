import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/lib/env.client';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const destination =
    next === '/reset-password' || next === '/hearth' || next === '/account' ? next : '/sign-in';
  const response = NextResponse.redirect(new URL(destination, request.url));
  if (!code) return response;
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  );
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const failurePath = next === '/reset-password' ? '/forgot-password?expired=1' : '/sign-in';
    return NextResponse.redirect(new URL(failurePath, request.url));
  }
  return response;
}
