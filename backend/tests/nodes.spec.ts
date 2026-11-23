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

const JSON_HEADERS = { 'content-type': 'application/json', origin: env.FRONTEND_ORIGIN };

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

interface TestUser {
  email: string;
  name: string;
  password: string;
}

async function createUser(db: DbHandle['db'], user: TestUser) {
  const auth = createAuth({ env, db, allowSignup: true });
  const res = await auth.api.signUpEmail({ body: user });
  return res.user;
}

async function login(base: string, jar: Jar, email: string, password: string) {
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  });
  jar.absorb(res.headers.getSetCookie());
  expect(res.status).toBe(200);
}

describe('nodes', () => {
  let handle: DbHandle;
  let app: FastifyInstance;
  let base: string;
  const jar = new Jar();

  const owner: TestUser = { email: 'dono@example.com', name: 'Dono', password: 'senha-muito-segura-123' };
  const other: TestUser = { email: 'outro@example.com', name: 'Outro', password: 'senha-muito-segura-456' };

  const call = async (method: string, url: string, payload?: object) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(payload ? JSON_HEADERS : {}), cookie: jar.header() },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    jar.absorb(res.headers.getSetCookie());
    const text = await res.text();
    return {
      statusCode: res.status,
      json: () => JSON.parse(text) as any,
      text: () => text,
    };
  };
  const get = (url: string) => call('GET', url);
  const post = (url: string, payload: object) => call('POST', url, payload);
  const patch = (url: string, payload: object) => call('PATCH', url, payload);
  const del = (url: string) => call('DELETE', url);

  beforeAll(async () => {
    handle = await createDb({ inMemory: true });
    ({ app } = await buildApp(env, handle.db));
    base = await app.listen({ port: 0, host: '127.0.0.1' });

    await createUser(handle.db, owner);
    await createUser(handle.db, other);
  });

  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  beforeAll(async () => {
    await login(base, jar, owner.email, owner.password);
  });

  it('rejeita criar node sem sessão', async () => {
    jar.clear();
    const res = await post('/api/v1/nodes', { title: 'Trabalho' });
    expect(res.statusCode).toBe(401);
  });

  it('cria node raiz', async () => {
    await login(base, jar, owner.email, owner.password);
    const res = await post('/api/v1/nodes', { title: 'Trabalho' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Trabalho');
    expect(body.parentId).toBeNull();
    expect(body.path).toBe(body.id);
  });

  it('cria node filho e mantém path materializado', async () => {
    const root = (await post('/api/v1/nodes', { title: 'Idiomas' })).json();
    const child = (await post('/api/v1/nodes', { title: 'Inglês', parentId: root.id })).json();
    expect(child.parentId).toBe(root.id);
    expect(child.path).toBe(`${root.id}/${child.id}`);
  });

  it('lista árvore do usuário em ordem', async () => {
    const list = (await get('/api/v1/nodes')).json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
    const titles = list.map((n: any) => n.title);
    expect(titles).toContain('Trabalho');
    expect(titles).toContain('Idiomas');
  });

  it('atualiza título e metadados', async () => {
    const created = (await post('/api/v1/nodes', { title: 'Temp' })).json();
    const updated = (await patch(`/api/v1/nodes/${created.id}`, { title: 'Temporário', icon: 'star', color: '#c33e2a' })).json();
    expect(updated.title).toBe('Temporário');
    expect(updated.icon).toBe('star');
    expect(updated.color).toBe('#c33e2a');
  });

  it('reordena nodes com beforeId', async () => {
    const a = (await post('/api/v1/nodes', { title: 'A' })).json();
    const b = (await post('/api/v1/nodes', { title: 'B' })).json();
    const moved = (await post(`/api/v1/nodes/${b.id}/move`, { beforeId: a.id })).json();
    expect(moved.position < a.position).toBe(true);
  });

  it('move node para outro parent e atualiza path dos descendentes', async () => {
    const oldRoot = (await post('/api/v1/nodes', { title: 'Old Root' })).json();
    const child = (await post('/api/v1/nodes', { title: 'Child', parentId: oldRoot.id })).json();
    const grandchild = (await post('/api/v1/nodes', { title: 'Grandchild', parentId: child.id })).json();
    expect(grandchild.path).toBe(`${oldRoot.id}/${child.id}/${grandchild.id}`);

    const newRoot = (await post('/api/v1/nodes', { title: 'New Root' })).json();
    const moved = (await post(`/api/v1/nodes/${child.id}/move`, { parentId: newRoot.id })).json();
    expect(moved.parentId).toBe(newRoot.id);
    expect(moved.path).toBe(`${newRoot.id}/${child.id}`);

    const reloaded = (await get(`/api/v1/nodes/${grandchild.id}`)).json();
    expect(reloaded.path).toBe(`${newRoot.id}/${child.id}/${grandchild.id}`);
  });

  it('impede mover node para dentro de seus descendentes', async () => {
    const root = (await post('/api/v1/nodes', { title: 'Root' })).json();
    const child = (await post('/api/v1/nodes', { title: 'Child', parentId: root.id })).json();
    const res = await post(`/api/v1/nodes/${root.id}/move`, { parentId: child.id });
    expect(res.statusCode).toBe(400);
  });

  it('arquiva e desarquiva node', async () => {
    const node = (await post('/api/v1/nodes', { title: 'Archive me' })).json();
    const archived = (await post(`/api/v1/nodes/${node.id}/archive`, { archived: true })).json();
    expect(archived.archivedAt).not.toBeNull();
    const listWithoutArchived = (await get('/api/v1/nodes')).json();
    expect(listWithoutArchived.find((n: any) => n.id === node.id)).toBeUndefined();
    const listWithArchived = (await get('/api/v1/nodes?archived=true')).json();
    expect(listWithArchived.find((n: any) => n.id === node.id)).toBeDefined();
  });

  it('faz soft delete de node', async () => {
    const node = (await post('/api/v1/nodes', { title: 'Delete me' })).json();
    const res = await del(`/api/v1/nodes/${node.id}`);
    expect(res.statusCode).toBe(200);
    const getRes = await get(`/api/v1/nodes/${node.id}`);
    expect(getRes.statusCode).toBe(404);
  });

  it('soft delete em cascata remove descendentes', async () => {
    const root = (await post('/api/v1/nodes', { title: 'Root to delete' })).json();
    const child = (await post('/api/v1/nodes', { title: 'Child', parentId: root.id })).json();
    const grandchild = (await post('/api/v1/nodes', { title: 'Grandchild', parentId: child.id })).json();

    await del(`/api/v1/nodes/${root.id}`);

    expect((await get(`/api/v1/nodes/${child.id}`)).statusCode).toBe(404);
    expect((await get(`/api/v1/nodes/${grandchild.id}`)).statusCode).toBe(404);
  });

  it('impede acesso cruzado entre usuários', async () => {
    const ownerNode = (await post('/api/v1/nodes', { title: 'Segredo' })).json();

    const otherJar = new Jar();
    await login(base, otherJar, other.email, other.password);
    const res = await fetch(base + `/api/v1/nodes/${ownerNode.id}`, {
      method: 'GET',
      headers: { cookie: otherJar.header() },
    });
    expect(res.status).toBe(404);

    const patchRes = await fetch(base + `/api/v1/nodes/${ownerNode.id}`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, cookie: otherJar.header() },
      body: JSON.stringify({ title: 'Hackeado' }),
    });
    expect(patchRes.status).toBe(404);
  });
});
