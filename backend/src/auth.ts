import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins/two-factor';
import type { Env } from './config/env.js';
import type { Database } from './db/client.js';
import * as schema from './db/schema/index.js';

export interface AuthOptions {
  env: Env;
  db: Database;
  /** Sobrescreve ALLOW_SIGNUP (usado pelo script de criação de usuário). */
  allowSignup?: boolean;
}

export function createAuth({ env, db, allowSignup }: AuthOptions) {
  const isProd = env.NODE_ENV === 'production';
  return betterAuth({
    baseURL: env.BASE_URL,
    basePath: '/api/auth',
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.FRONTEND_ORIGIN],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !(allowSignup ?? env.ALLOW_SIGNUP),
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 dias
      updateAge: 60 * 60 * 24, // renova após 1 dia de uso
    },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: isProd,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: isProd },
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    plugins: [twoFactor({ issuer: 'Chimpinho Compendium' })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
