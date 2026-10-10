import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/lib/env.client';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const providerError = request.nextUrl.searchParams.get('error');
  const providerErrorCode = request.nextUrl.searchParams.get('error_code');
  const failurePath =
    next === '/reset-password' ? '/forgot-password?expired=1' : '/sign-in?confirmationError=1';
  if (providerError || providerErrorCode) {
    const expired =
      providerErrorCode === 'otp_expired' || providerErrorCode === 'flow_state_expired';
    return NextResponse.redirect(
      new URL(
        next !== '/reset-password' && expired
          ? `${failurePath}&confirmationExpired=1`
          : failurePath,
        request.url,
      ),
    );
  }
  const destination =
    next === '/reset-password' || next === '/hearth' || next === '/account' ? next : '/sign-in';
  const response = NextResponse.redirect(new URL(destination, request.url));
  if ((!code && !tokenHash) || (tokenHash && (next !== '/reset-password' || type !== 'recovery'))) {
    return NextResponse.redirect(new URL(failurePath, request.url));
  }
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
  const flowId = request.nextUrl.searchParams.get('sb_flow_id');
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    : await supabase.auth.exchangeCodeForSession(code!, flowId ? { flowId } : undefined);
  if (error) {
    return NextResponse.redirect(new URL(failurePath, request.url));
  }
  return response;
}
