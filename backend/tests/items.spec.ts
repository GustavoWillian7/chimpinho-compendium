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

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('items', () => {
  let handle: DbHandle;
  let app: FastifyInstance;
  let base: string;
  const ownerJar = new Jar();
  const otherJar = new Jar();
  let jar = ownerJar;

  const owner: TestUser = { email: 'dono-items@example.com', name: 'Dono', password: 'senha-muito-segura-123' };
  const other: TestUser = { email: 'outro-items@example.com', name: 'Outro', password: 'senha-muito-segura-456' };

  const call = async (method: string, url: string, payload?: object) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(payload ? JSON_HEADERS : {}), cookie: jar.header() },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    jar.absorb(res.headers.getSetCookie());
    const text = await res.text();
    return { statusCode: res.status, json: () => JSON.parse(text) as any };
  };
  const get = (url: string) => call('GET', url);
  const post = (url: string, payload: object) => call('POST', url, payload);
  const patch = (url: string, payload: object) => call('PATCH', url, payload);
  const del = (url: string) => call('DELETE', url);

  async function login(user: TestUser, target: Jar) {
    const res = await fetch(`${base}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    target.absorb(res.headers.getSetCookie());
    expect(res.status).toBe(200);
  }

  async function newNode(title: string, parentId?: string) {
    const res = await post('/api/v1/nodes', { title, parentId });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  async function newItem(nodeId: string, title: string, content?: object) {
    const res = await post(`/api/v1/nodes/${nodeId}/items`, { title, content });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; position: string };
  }

  beforeAll(async () => {
    handle = await createDb({ inMemory: true });
    ({ app } = await buildApp(env, handle.db));
    base = await app.listen({ port: 0, host: '127.0.0.1' });

    const auth = createAuth({ env, db: handle.db, allowSignup: true });
    await auth.api.signUpEmail({ body: owner });
    await auth.api.signUpEmail({ body: other });
    await login(owner, ownerJar);
    await login(other, otherJar);
  });

  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('rejeita sem sessão', async () => {
    const node = await newNode('Sem sessão');
    jar = new Jar();
    expect((await get(`/api/v1/nodes/${node.id}/items`)).statusCode).toBe(401);
    expect((await post(`/api/v1/nodes/${node.id}/items`, { title: 'x' })).statusCode).toBe(401);
    jar = ownerJar;
  });

  it('cria, detalha, atualiza e apaga uma nota', async () => {
    const node = await newNode('CRUD');
    const created = await post(`/api/v1/nodes/${node.id}/items`, { title: 'Minha nota', content: doc('olá') });
    expect(created.statusCode).toBe(201);
    const item = created.json();
    expect(item).toMatchObject({ title: 'Minha nota', type: 'note', nodeId: node.id });
    expect(item.content).toEqual(doc('olá'));

    const detail = await get(`/api/v1/items/${item.id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().content).toEqual(doc('olá'));

    const updated = await patch(`/api/v1/items/${item.id}`, { title: 'Renomeada', content: doc('novo texto') });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ title: 'Renomeada', content: doc('novo texto') });

    expect((await del(`/api/v1/items/${item.id}`)).statusCode).toBe(200);
    expect((await get(`/api/v1/items/${item.id}`)).statusCode).toBe(404);
  });

  it('cria nota com conteúdo vazio por padrão', async () => {
    const node = await newNode('Vazia');
    const item = await newItem(node.id, 'Sem conteúdo');
    const detail = await get(`/api/v1/items/${item.id}`);
    expect(detail.json().content).toEqual({ type: 'doc', content: [] });
  });

  it('lista items do node sem o content, na ordem de criação', async () => {
    const node = await newNode('Lista');
    await newItem(node.id, 'A', doc('a'));
    await newItem(node.id, 'B', doc('b'));
    const res = await get(`/api/v1/nodes/${node.id}/items`);
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list.map((i: any) => i.title)).toEqual(['A', 'B']);
    expect(list[0]).not.toHaveProperty('content');
    expect(list[0]).not.toHaveProperty('contentText');
  });

  it('recalcula content_text no servidor e ignora o enviado pelo cliente', async () => {
    const node = await newNode('Texto');
    const created = await post(`/api/v1/nodes/${node.id}/items`, {
      title: 'T',
      content: doc('primeiro'),
      contentText: 'forjado',
    });
    const item = created.json();
    expect(created.statusCode).toBe(201);
    expect(item).not.toHaveProperty('contentText');

    await patch(`/api/v1/items/${item.id}`, { content: doc('segundo'), contentText: 'forjado' });

    const { items } = await import('../src/db/schema/index.js').then((m) => ({ items: m.item }));
    const { eq } = await import('drizzle-orm');
    const [row] = await handle.db.select().from(items).where(eq(items.id, item.id));
    expect(row?.contentText).toBe('segundo');
  });

  it('valida entrada: tipo, forma do conteúdo, título e tamanho', async () => {
    const node = await newNode('Validação');
    const url = `/api/v1/nodes/${node.id}/items`;
    expect((await post(url, { title: 'x', type: 'checklist' })).statusCode).toBe(400);
    expect((await post(url, { title: 'x', content: { type: 'outro' } })).statusCode).toBe(400);
    expect((await post(url, { title: 'x', content: 'texto' })).statusCode).toBe(400);
    expect((await post(url, { title: '' })).statusCode).toBe(400);
    expect((await post(url, { content: doc('sem título') })).statusCode).toBe(400);
    const big = await post(url, { title: 'grande', content: doc('a'.repeat(1_100_000)) });
    expect(big.statusCode).toBe(400);
  });

  it('reordena dentro do node', async () => {
    const node = await newNode('Ordem');
    const a = await newItem(node.id, 'A');
    const b = await newItem(node.id, 'B');
    const c = await newItem(node.id, 'C');

    expect((await post(`/api/v1/items/${c.id}/move`, { beforeId: a.id })).statusCode).toBe(200);
    let titles = (await get(`/api/v1/nodes/${node.id}/items`)).json().map((i: any) => i.title);
    expect(titles).toEqual(['C', 'A', 'B']);

    expect((await post(`/api/v1/items/${c.id}/move`, { afterId: b.id })).statusCode).toBe(200);
    titles = (await get(`/api/v1/nodes/${node.id}/items`)).json().map((i: any) => i.title);
    expect(titles).toEqual(['A', 'B', 'C']);
  });

  it('move item para outro node', async () => {
    const from = await newNode('Origem');
    const to = await newNode('Destino');
    const item = await newItem(from.id, 'Viajante');

    const moved = await post(`/api/v1/items/${item.id}/move`, { nodeId: to.id });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().nodeId).toBe(to.id);
    expect((await get(`/api/v1/nodes/${from.id}/items`)).json()).toHaveLength(0);
    expect((await get(`/api/v1/nodes/${to.id}/items`)).json()).toHaveLength(1);
  });

  it('apagar um node esconde os items dele e dos descendentes', async () => {
    const parent = await newNode('Pai');
    const child = await newNode('Filho', parent.id);
    const a = await newItem(parent.id, 'No pai');
    const b = await newItem(child.id, 'No filho');
    const outsideNode = await newNode('Fora');
    const c = await newItem(outsideNode.id, 'Intacto');

    expect((await del(`/api/v1/nodes/${parent.id}`)).statusCode).toBe(200);
    expect((await get(`/api/v1/items/${a.id}`)).statusCode).toBe(404);
    expect((await get(`/api/v1/items/${b.id}`)).statusCode).toBe(404);
    expect((await get(`/api/v1/nodes/${parent.id}/items`)).statusCode).toBe(404);
    expect((await get(`/api/v1/items/${c.id}`)).statusCode).toBe(200);
  });

  it('node arquivado: não cria nem recebe itens, mas permite editar', async () => {
    const node = await newNode('Arquivável');
    const other = await newNode('Outro');
    const item = await newItem(node.id, 'Existente');
    const loose = await newItem(other.id, 'Solto');

    await post(`/api/v1/nodes/${node.id}/archive`, { archived: true });

    expect((await post(`/api/v1/nodes/${node.id}/items`, { title: 'Novo' })).statusCode).toBe(409);
    expect((await post(`/api/v1/items/${loose.id}/move`, { nodeId: node.id })).statusCode).toBe(409);
    expect((await patch(`/api/v1/items/${item.id}`, { title: 'Editado' })).statusCode).toBe(200);
  });

  it('acesso cruzado: outro usuário recebe 404 em tudo', async () => {
    const node = await newNode('Privado');
    const item = await newItem(node.id, 'Segredo', doc('segredo'));

    jar = otherJar;
    const otherNode = await newNode('Do outro');

    expect((await get(`/api/v1/nodes/${node.id}/items`)).statusCode).toBe(404);
    expect((await post(`/api/v1/nodes/${node.id}/items`, { title: 'invasor' })).statusCode).toBe(404);
    expect((await get(`/api/v1/items/${item.id}`)).statusCode).toBe(404);
    expect((await patch(`/api/v1/items/${item.id}`, { title: 'hack' })).statusCode).toBe(404);
    expect((await del(`/api/v1/items/${item.id}`)).statusCode).toBe(404);
    expect((await post(`/api/v1/items/${item.id}/move`, { nodeId: otherNode.id })).statusCode).toBe(404);

    jar = ownerJar;
    const mine = await get(`/api/v1/items/${item.id}`);
    expect(mine.statusCode).toBe(200);
    expect(mine.json().title).toBe('Segredo');
  });
});
