import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { loadEnv } from '../src/config/env.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { escapeLike, HIGHLIGHT_END, HIGHLIGHT_START } from '../src/modules/search/repository.js';

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

interface Hit {
  id: string;
  nodeId: string;
  nodeTitle: string;
  nodeArchived: boolean;
  type: string;
  title: string;
  snippet: string;
  updatedAt: string;
}

describe('search', () => {
  let handle: DbHandle;
  let app: FastifyInstance;
  let base: string;
  const ownerJar = new Jar();
  const otherJar = new Jar();
  let jar = ownerJar;

  const owner: TestUser = { email: 'dono-busca@example.com', name: 'Dono', password: 'senha-muito-segura-123' };
  const other: TestUser = { email: 'outro-busca@example.com', name: 'Outro', password: 'senha-muito-segura-456' };

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
  const post = (url: string, payload: object = {}) => call('POST', url, payload);
  const patch = (url: string, payload: object) => call('PATCH', url, payload);
  const del = (url: string) => call('DELETE', url);

  const search = async (q: string, extra = ''): Promise<Hit[]> => {
    const res = await call('GET', `/api/v1/search?q=${encodeURIComponent(q)}${extra}`);
    expect(res.statusCode, `q=${q}`).toBe(200);
    return res.json();
  };
  const titles = (hits: Hit[]) => hits.map((h) => h.title);

  async function login(user: TestUser, target: Jar) {
    const res = await fetch(`${base}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    target.absorb(res.headers.getSetCookie());
    expect(res.status).toBe(200);
  }

  async function newNode(title: string) {
    const res = await post('/api/v1/nodes', { title });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  async function newItem(nodeId: string, title: string, text = '') {
    const res = await post(`/api/v1/nodes/${nodeId}/items`, { title, content: text ? doc(text) : undefined });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
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
    jar = new Jar();
    const res = await call('GET', '/api/v1/search?q=algo');
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('unauthorized');
    jar = ownerJar;
  });

  it('acha por título e por corpo, com o nome do node e sem o conteúdo', async () => {
    const node = await newNode('Estudos de violão');
    await newItem(node.id, 'Escalas pentatônicas', 'Praticar a posição um todos os dias');
    await newItem(node.id, 'Outra coisa', 'Acordes abertos de zarabatana');

    const byTitle = await search('pentatônicas');
    expect(titles(byTitle)).toEqual(['Escalas pentatônicas']);
    expect(byTitle[0]).toMatchObject({ nodeId: node.id, nodeTitle: 'Estudos de violão', nodeArchived: false, type: 'note' });
    expect(byTitle[0]).not.toHaveProperty('content');
    expect(byTitle[0]).not.toHaveProperty('contentText');
    expect(byTitle[0]).not.toHaveProperty('searchVector');

    expect(titles(await search('zarabatana'))).toEqual(['Outra coisa']);
    expect(await search('palavrainexistentexyz')).toEqual([]);
  });

  it('entende radicais do português', async () => {
    const node = await newNode('Trabalho');
    await newItem(node.id, 'Ata', 'Anotei várias receitas e fui cantando pela casa');
    expect(titles(await search('receita'))).toEqual(['Ata']); // plural no texto, singular na busca
    expect(titles(await search('cantar'))).toEqual(['Ata']);
    expect(titles(await search('cantaram'))).toEqual(['Ata']);
  });

  it('título pesa mais que corpo', async () => {
    const node = await newNode('Ranking');
    await newItem(node.id, 'Anotação qualquer', 'Aqui se fala de bicicletinha bicicletinha');
    await newItem(node.id, 'Bicicletinha', 'texto sem relação');
    const hits = await search('bicicletinha');
    expect(titles(hits)).toEqual(['Bicicletinha', 'Anotação qualquer']);
  });

  it('busca parcial no título; % e _ são literais', async () => {
    const node = await newNode('Parcial');
    await newItem(node.id, 'Planejamento trimestral');
    await newItem(node.id, 'Desconto 50% off');
    await newItem(node.id, 'snake_case notas');
    await newItem(node.id, 'Algo qualquer');

    expect(titles(await search('planejam'))).toEqual(['Planejamento trimestral']);
    expect(titles(await search('50%'))).toEqual(['Desconto 50% off']);
    expect(titles(await search('e_c'))).toEqual(['snake_case notas']);
    expect(titles(await search('%'))).toEqual(['Desconto 50% off']);
    expect(titles(await search('_'))).toEqual(['snake_case notas']);
  });

  it('suporta frase entre aspas e exclusão com hífen', async () => {
    const node = await newNode('Operadores');
    await newItem(node.id, 'Receita A', 'bolo de cenoura com cobertura');
    await newItem(node.id, 'Receita B', 'bolo de fubá com cobertura');
    await newItem(node.id, 'Receita C', 'cenoura cozida de cobertura');

    expect(titles(await search('"bolo de cenoura"'))).toEqual(['Receita A']);
    expect((titles(await search('cobertura -cenoura')).sort())).toEqual(['Receita B']);
  });

  it('entrada hostil não gera erro', async () => {
    for (const q of ["'", "a' or 1=1 --", 'a & b', 'x:*', '(((', ')', '!', '\\', '<->', 'a | b', '"', "'; drop table items; --"]) {
      await search(q); // o próprio helper exige 200
    }
    // a tabela continua lá
    expect((await call('GET', '/api/v1/search?q=Receita')).statusCode).toBe(200);
  });

  it('snippet usa marcadores de controle e nunca HTML do servidor', async () => {
    const node = await newNode('Snippets');
    await newItem(node.id, 'Diário', 'Hoje estudei harmonia funcional e <b>tag</b> literal no texto <script>alert(1)</script>');
    const [hit] = await search('harmonia');
    expect(hit!.snippet).toContain(`${HIGHLIGHT_START}harmonia${HIGHLIGHT_END}`);
    expect(hit!.snippet).not.toContain('<mark>');
    // Tags HTML digitadas na nota são removidas do snippet pelo próprio ts_headline.
    const [literal] = await search('literal');
    expect(literal!.snippet).not.toMatch(/<\/?b>/);
    expect(literal!.snippet).toContain(`${HIGHLIGHT_START}literal${HIGHLIGHT_END}`);
  });

  it('atualizar a nota atualiza a busca', async () => {
    const node = await newNode('Atualização');
    const item = await newItem(node.id, 'Rascunho', 'conteúdo com palavra-antiga-xpto');
    expect(titles(await search('xpto'))).toEqual(['Rascunho']);

    await patch(`/api/v1/items/${item.id}`, { title: 'Final', content: doc('agora com palavra-nova-wzyk') });
    expect(await search('xpto')).toEqual([]);
    expect(titles(await search('wzyk'))).toEqual(['Final']);
  });

  it('isolamento entre usuários', async () => {
    const node = await newNode('Privado');
    await newItem(node.id, 'Segredo', 'codinome-ultrassecreto-qwerty');
    expect(titles(await search('qwerty'))).toEqual(['Segredo']);

    jar = otherJar;
    expect(await search('qwerty')).toEqual([]);
    expect(await search('Segredo')).toEqual([]);
    jar = ownerJar;
  });

  it('item apagado e node apagado somem; node arquivado aparece marcado', async () => {
    const live = await newNode('Vivo');
    const dead = await newNode('Morto');
    const archived = await newNode('Arquivado');
    const itemGone = await newItem(live.id, 'Item removido', 'fantasmaaaa');
    await newItem(live.id, 'Item mantido', 'fantasmabbbb');
    await newItem(dead.id, 'Item do node morto', 'fantasmacccc');
    await newItem(archived.id, 'Item do arquivo', 'fantasmadddd');

    // controle positivo antes de apagar: todos aparecem
    for (const w of ['fantasmaaaa', 'fantasmabbbb', 'fantasmacccc', 'fantasmadddd']) expect(await search(w)).toHaveLength(1);

    expect((await del(`/api/v1/items/${itemGone.id}`)).statusCode).toBe(200);
    expect((await del(`/api/v1/nodes/${dead.id}`)).statusCode).toBe(200);
    expect((await post(`/api/v1/nodes/${archived.id}/archive`, { archived: true })).statusCode).toBe(200);

    expect(await search('fantasmaaaa')).toEqual([]);
    expect(await search('fantasmacccc')).toEqual([]);
    expect(titles(await search('fantasmabbbb'))).toEqual(['Item mantido']);
    const [arch] = await search('fantasmadddd');
    expect(arch).toMatchObject({ title: 'Item do arquivo', nodeArchived: true });
  });

  it('respeita limit e valida a entrada', async () => {
    const node = await newNode('Muitos');
    for (let i = 0; i < 5; i++) await newItem(node.id, `Marmota ${i}`);
    expect(await search('marmota', '&limit=3')).toHaveLength(3);
    expect(await search('marmota')).toHaveLength(5);

    const status = async (qs: string) => (await call('GET', `/api/v1/search${qs}`)).statusCode;
    expect(await status('')).toBe(400);
    expect(await status('?q=')).toBe(400);
    expect(await status('?q=%20%20')).toBe(400);
    expect(await status(`?q=${'a'.repeat(201)}`)).toBe(400);
    expect(await status('?q=a&limit=0')).toBe(400);
    expect(await status('?q=a&limit=51')).toBe(400);
    expect(await status('?q=a&limit=abc')).toBe(400);
    expect(await status('?q=a&extra=1')).toBe(400);
    expect(await status('?q=a%00b')).toBe(400);
    expect(await status(`?q=${'a'.repeat(200)}`)).toBe(200);
  });
});

describe('escapeLike', () => {
  it('escapa barra, porcentagem e sublinhado', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    expect(escapeLike('normal')).toBe('normal');
  });
});
