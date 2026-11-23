import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { loadEnv } from '../src/config/env.js';
import { createDb, type DbHandle } from '../src/db/client.js';

const env = loadEnv({
  NODE_ENV: 'test',
  AUTH_SECRET: 'x'.repeat(40),
  ALLOW_SIGNUP: 'false',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  BASE_URL: 'http://localhost:3333',
});

const EMAIL = 'dono@example.com';
const PASSWORD = 'senha-muito-segura-123';
const JSON_HEADERS = { 'content-type': 'application/json', origin: env.FRONTEND_ORIGIN };

/** Mantém um "cookie jar" mínimo a partir dos Set-Cookie das respostas. */
class Jar {
  private cookies = new Map<string, string>();
  absorb(list: string[]) {
    for (const c of list) {
      const [pair] = c.split(';');
      const idx = pair!.indexOf('=');
      const name = pair!.slice(0, idx);
      const value = pair!.slice(idx + 1);
      if (value === '' || /max-age=0/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  clear() {
    this.cookies.clear();
  }
}

describe('auth (spike Better Auth + Fastify)', () => {
  let handle: DbHandle;
  let app: FastifyInstance;
  let base: string;
  const jar = new Jar();

  // HTTP real (porta efêmera) em vez de app.inject: o light-my-request exige Node >= 20.19.
  const call = async (method: string, url: string, payload?: object) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(payload ? JSON_HEADERS : {}), cookie: jar.header() },
      body: payload ? JSON.stringify(payload) : undefined,
      redirect: 'manual',
    });
    const setCookie = res.headers.getSetCookie();
    jar.absorb(setCookie);
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: res.headers,
      setCookie,
      json: () => JSON.parse(text) as any,
    };
  };
  const post = (url: string, payload: object) => call('POST', url, payload);
  const get = (url: string) => call('GET', url);

  beforeAll(async () => {
    handle = await createDb({ inMemory: true });
    ({ app } = await buildApp(env, handle.db));
    base = await app.listen({ port: 0, host: '127.0.0.1' });
    // Cadastro público está desligado; o usuário é criado como no script user:create.
    await createAuth({ env, db: handle.db, allowSignup: true }).api.signUpEmail({
      body: { email: EMAIL, name: 'Dono', password: PASSWORD },
    });
  });

  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('health check responde sem login', async () => {
    expect((await get('/health')).statusCode).toBe(200);
  });

  it('bloqueia cadastro público', async () => {
    const res = await post('/api/auth/sign-up/email', {
      email: 'intruso@example.com',
      name: 'Intruso',
      password: 'outra-senha-bem-longa-1',
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });

  it('rota protegida retorna 401 sem sessão', async () => {
    expect((await get('/api/v1/me')).statusCode).toBe(401);
  });

  it('rejeita senha errada', async () => {
    const res = await post('/api/auth/sign-in/email', { email: EMAIL, password: 'errada-errada-123' });
    expect(res.statusCode).toBe(401);
  });

  it('login cria cookie httpOnly e libera a rota protegida', async () => {
    const res = await post('/api/auth/sign-in/email', { email: EMAIL, password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const raw = res.setCookie.join('\n');
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    const me = await get('/api/v1/me');
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(EMAIL);
  });

  it('2FA TOTP: habilita, exige segundo fator no login e conclui com o código', async () => {
    const enable = await post('/api/auth/two-factor/enable', { password: PASSWORD });
    expect(enable.statusCode).toBe(200);
    const { totpURI, backupCodes } = enable.json();
    expect(backupCodes.length).toBeGreaterThan(0);
    // A URI carrega o segredo em base32; o servidor calcula o TOTP sobre o segredo original.
    const secret = new TextDecoder().decode(base32.decode(new URL(totpURI).searchParams.get('secret')!));

    const otp = createOTP(secret, { digits: 6, period: 30 });
    const verify = await post('/api/auth/two-factor/verify-totp', { code: await otp.totp() });
    expect(verify.statusCode).toBe(200);

    // Novo login: senha correta NÃO basta, não pode haver sessão completa.
    await post('/api/auth/sign-out', {});
    jar.clear();
    const login = await post('/api/auth/sign-in/email', { email: EMAIL, password: PASSWORD });
    expect(login.statusCode).toBe(200);
    expect(login.json().twoFactorRedirect).toBe(true);
    expect((await get('/api/v1/me')).statusCode).toBe(401);

    const bad = await post('/api/auth/two-factor/verify-totp', { code: '000000' });
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);

    const ok = await post('/api/auth/two-factor/verify-totp', { code: await otp.totp() });
    expect(ok.statusCode).toBe(200);
    expect((await get('/api/v1/me')).statusCode).toBe(200);
  });

  it('envia headers de segurança (helmet)', async () => {
    const res = await get('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
