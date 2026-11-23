import { ApiError, api } from '../../lib/api';

export type Me = { id: string; email: string; name: string };

export async function fetchMe(): Promise<Me | null> {
  try {
    return await api<Me>('GET', '/api/v1/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function signIn(email: string, password: string) {
  const res = await api<{ twoFactorRedirect?: boolean }>('POST', '/api/auth/sign-in/email', {
    email,
    password,
  });
  return { twoFactor: res?.twoFactorRedirect === true };
}

export const verifyTotp = (code: string) =>
  api('POST', '/api/auth/two-factor/verify-totp', { code });
export const signOut = () => api('POST', '/api/auth/sign-out', {});
