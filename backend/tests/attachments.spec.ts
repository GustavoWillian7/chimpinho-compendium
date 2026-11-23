import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { loadEnv } from '../src/config/env.js';
import { createDb, type DbHandle } from '../src/db/client.js';
import { contentDisposition, createS3Storage, type Storage } from '../src/modules/attachments/storage.js';

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

/** Storage em memória: `objects` simula o bucket. O "cliente" grava direto nele (`put`). */
class FakeStorage implements Storage {
  objects = new Map<string, number>();
  deleted: string[] = [];
  lastUpload?: { key: string; mime: string; sizeBytes: number };
  lastDownload?: { key: string; filename: string };

  async presignUpload(input: { key: string; mime: string; sizeBytes: number; expiresInSeconds: number }) {
    this.lastUpload = input;
    return {
      url: `https://fake.test/upload/${input.key}`,
      method: 'PUT' as const,
      headers: { 'content-type': input.mime, 'content-length': String(input.sizeBytes) },
    };
  }
  async presignDownload(input: { key: string; filename: string; mime: string; expiresInSeconds: number }) {
    this.lastDownload = input;
    return `https://fake.test/download/${input.key}`;
  }
  async head(key: string) {
    const size = this.objects.get(key);
    return size === undefined ? null : { sizeBytes: size };
  }
  async delete(key: string) {
    this.deleted.push(key);
    this.objects.delete(key);
  }
  put(key: string, sizeBytes: number) {
    this.objects.set(key, sizeBytes);
  }
}

const PNG = { filename: 'mapa.png', mime: 'image/png', sizeBytes: 2048 };

describe('attachments', () => {
  let handle: DbHandle;
  let app: FastifyInstance;
  let base: string;
  const storage = new FakeStorage();
  const ownerJar = new Jar();
  const otherJar = new Jar();
  let jar = ownerJar;

  const owner: TestUser = { email: 'dono-anexos@example.com', name: 'Dono', password: 'senha-muito-segura-123' };
  const other: TestUser = { email: 'outro-anexos@example.com', name: 'Outro', password: 'senha-muito-segura-456' };

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
  const post = (url: string, payload: object = {}) => call('POST', url, payload);
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

  async function newNode(title: string) {
    const res = await post('/api/v1/nodes', { title });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  async function newItem(nodeId = '') {
    const parent = nodeId || (await newNode('Nó de anexos')).id;
    const res = await post(`/api/v1/nodes/${parent}/items`, { title: 'Nota' });
    expect(res.statusCode).toBe(201);
    return { id: res.json().id as string, nodeId: parent };
  }

  /** Reserva + "envia" + confirma. */
  async function readyAttachment(itemId: string, body = PNG) {
    const created = await post(`/api/v1/items/${itemId}/attachments`, body);
    expect(created.statusCode).toBe(201);
    const { attachment } = created.json();
    storage.put(`${await userIdOf(owner)}/${attachment.id}`, body.sizeBytes);
    const done = await post(`/api/v1/attachments/${attachment.id}/complete`);
    expect(done.statusCode).toBe(200);
    return attachment.id as string;
  }

  const userIds = new Map<string, string>();
  async function userIdOf(u: TestUser) {
    return userIds.get(u.email)!;
  }

  beforeAll(async () => {
    handle = await createDb({ inMemory: true });
    ({ app } = await buildApp(env, handle.db, { storage }));
    base = await app.listen({ port: 0, host: '127.0.0.1' });

    const auth = createAuth({ env, db: handle.db, allowSignup: true });
    for (const u of [owner, other]) {
      const res = await auth.api.signUpEmail({ body: u });
      userIds.set(u.email, res.user.id);
    }
    await login(owner, ownerJar);
    await login(other, otherJar);
  });

  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('rejeita sem sessão', async () => {
    const { id } = await newItem();
    jar = new Jar();
    expect((await post(`/api/v1/items/${id}/attachments`, PNG)).statusCode).toBe(401);
    expect((await get(`/api/v1/items/${id}/attachments`)).statusCode).toBe(401);
    expect((await get(`/api/v1/attachments/${id}/download`)).statusCode).toBe(401);
    jar = ownerJar;
  });

  it('fluxo completo: reservar, enviar, confirmar, listar, baixar e apagar', async () => {
    const { id: itemId } = await newItem();

    const created = await post(`/api/v1/items/${itemId}/attachments`, PNG);
    expect(created.statusCode).toBe(201);
    const { attachment, upload } = created.json();
    expect(attachment).toMatchObject({ itemId, filename: 'mapa.png', mime: 'image/png', sizeBytes: 2048, status: 'pending' });
    expect(upload).toMatchObject({ method: 'PUT', headers: { 'content-type': 'image/png', 'content-length': '2048' } });
    // storage_key = {user_id}/{attachment_id}, sem o nome do arquivo
    const key = `${await userIdOf(owner)}/${attachment.id}`;
    expect(storage.lastUpload?.key).toBe(key);
    expect(attachment.storageKey).toBeUndefined();

    // pendente: não lista nem baixa
    expect((await get(`/api/v1/items/${itemId}/attachments`)).json()).toEqual([]);
    expect((await get(`/api/v1/attachments/${attachment.id}/download`)).statusCode).toBe(404);

    storage.put(key, 2048);
    const done = await post(`/api/v1/attachments/${attachment.id}/complete`);
    expect(done.statusCode).toBe(200);
    expect(done.json().status).toBe('ready');
    // idempotente
    expect((await post(`/api/v1/attachments/${attachment.id}/complete`)).statusCode).toBe(200);

    const list = await get(`/api/v1/items/${itemId}/attachments`);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].id).toBe(attachment.id);

    const dl = await get(`/api/v1/attachments/${attachment.id}/download`);
    expect(dl.statusCode).toBe(200);
    expect(dl.json().url).toBe(`https://fake.test/download/${key}`);
    expect(new Date(dl.json().expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(storage.lastDownload?.filename).toBe('mapa.png');

    expect((await del(`/api/v1/attachments/${attachment.id}`)).statusCode).toBe(200);
    expect((await get(`/api/v1/items/${itemId}/attachments`)).json()).toEqual([]);
    expect((await get(`/api/v1/attachments/${attachment.id}/download`)).statusCode).toBe(404);
    expect((await del(`/api/v1/attachments/${attachment.id}`)).statusCode).toBe(404);
  });

  it('valida MIME, tamanho e nome do arquivo', async () => {
    const { id } = await newItem();
    const url = `/api/v1/items/${id}/attachments`;
    const bad = async (body: object) => (await post(url, body)).statusCode;

    expect(await bad({ ...PNG, mime: 'image/svg+xml' })).toBe(400);
    expect(await bad({ ...PNG, mime: 'text/html' })).toBe(400);
    expect(await bad({ ...PNG, mime: 'application/x-msdownload' })).toBe(400);
    expect(await bad({ ...PNG, sizeBytes: 0 })).toBe(400);
    expect(await bad({ ...PNG, sizeBytes: -5 })).toBe(400);
    expect(await bad({ ...PNG, sizeBytes: 1.5 })).toBe(400);
    expect(await bad({ ...PNG, sizeBytes: 10 * 1024 * 1024 + 1 })).toBe(400); // imagem > 10 MB
    expect(await bad({ ...PNG, mime: 'application/pdf', sizeBytes: 20 * 1024 * 1024 + 1 })).toBe(400);
    expect(await bad({ ...PNG, mime: 'audio/mpeg', sizeBytes: 50 * 1024 * 1024 + 1 })).toBe(400);
    expect(await bad({ ...PNG, filename: '../segredo.png' })).toBe(400);
    expect(await bad({ ...PNG, filename: 'a/b.png' })).toBe(400);
    expect(await bad({ ...PNG, filename: '..' })).toBe(400);
    expect(await bad({ ...PNG, filename: '' })).toBe(400);
    expect(await bad({ ...PNG, extra: 'campo desconhecido' })).toBe(400);

    // limites exatos passam
    expect(await bad({ filename: 'a.mp3', mime: 'audio/mpeg', sizeBytes: 50 * 1024 * 1024 })).toBe(201);
    expect(await bad({ filename: 'a.pdf', mime: 'application/pdf', sizeBytes: 20 * 1024 * 1024 })).toBe(201);
  });

  it('confirmar sem enviar o arquivo falha e o anexo segue pendente', async () => {
    const { id: itemId } = await newItem();
    const { attachment } = (await post(`/api/v1/items/${itemId}/attachments`, PNG)).json();
    const res = await post(`/api/v1/attachments/${attachment.id}/complete`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('upload_not_found');
    expect((await get(`/api/v1/items/${itemId}/attachments`)).json()).toEqual([]);

    // agora envia e confirma normalmente
    storage.put(`${await userIdOf(owner)}/${attachment.id}`, PNG.sizeBytes);
    expect((await post(`/api/v1/attachments/${attachment.id}/complete`)).statusCode).toBe(200);
  });

  it('tamanho divergente do declarado: apaga o objeto e recusa', async () => {
    const { id: itemId } = await newItem();
    const { attachment } = (await post(`/api/v1/items/${itemId}/attachments`, PNG)).json();
    const key = `${await userIdOf(owner)}/${attachment.id}`;
    storage.put(key, 999_999);

    const res = await post(`/api/v1/attachments/${attachment.id}/complete`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('size_mismatch');
    expect(storage.deleted).toContain(key);
    expect((await get(`/api/v1/items/${itemId}/attachments`)).json()).toEqual([]);
    expect((await post(`/api/v1/attachments/${attachment.id}/complete`)).statusCode).toBe(404);
  });

  it('acesso cruzado: outro usuário recebe 404 em tudo', async () => {
    const { id: itemId } = await newItem();
    const attachmentId = await readyAttachment(itemId);
    const pendingId = (await post(`/api/v1/items/${itemId}/attachments`, PNG)).json().attachment.id as string;

    jar = otherJar;
    expect((await post(`/api/v1/items/${itemId}/attachments`, PNG)).statusCode).toBe(404);
    expect((await get(`/api/v1/items/${itemId}/attachments`)).statusCode).toBe(404);
    expect((await get(`/api/v1/attachments/${attachmentId}/download`)).statusCode).toBe(404);
    expect((await post(`/api/v1/attachments/${pendingId}/complete`)).statusCode).toBe(404);
    expect((await del(`/api/v1/attachments/${attachmentId}`)).statusCode).toBe(404);
    jar = ownerJar;

    // continua intacto para o dono
    expect((await get(`/api/v1/items/${itemId}/attachments`)).json()).toHaveLength(1);
    expect((await get(`/api/v1/attachments/${attachmentId}/download`)).statusCode).toBe(200);
  });

  it('item apagado esconde seus anexos', async () => {
    const { id: itemId } = await newItem();
    const attachmentId = await readyAttachment(itemId);
    expect((await del(`/api/v1/items/${itemId}`)).statusCode).toBe(200);

    expect((await get(`/api/v1/attachments/${attachmentId}/download`)).statusCode).toBe(404);
    expect((await get(`/api/v1/items/${itemId}/attachments`)).statusCode).toBe(404);
    expect((await post(`/api/v1/items/${itemId}/attachments`, PNG)).statusCode).toBe(404);
  });

  it('node apagado em cascata esconde os anexos dos items', async () => {
    const { id: itemId, nodeId } = await newItem();
    const attachmentId = await readyAttachment(itemId);
    expect((await del(`/api/v1/nodes/${nodeId}`)).statusCode).toBe(200);
    expect((await get(`/api/v1/attachments/${attachmentId}/download`)).statusCode).toBe(404);
  });

  it('node arquivado bloqueia novos anexos (409) mas mantém os existentes', async () => {
    const { id: itemId, nodeId } = await newItem();
    const attachmentId = await readyAttachment(itemId);
    expect((await post(`/api/v1/nodes/${nodeId}/archive`, { archived: true })).statusCode).toBe(200);

    const res = await post(`/api/v1/items/${itemId}/attachments`, PNG);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('node_archived');
    expect((await get(`/api/v1/attachments/${attachmentId}/download`)).statusCode).toBe(200);
  });

  it('IDs que não são UUID dão 400', async () => {
    expect((await get('/api/v1/attachments/nao-e-uuid/download')).statusCode).toBe(400);
    expect((await post('/api/v1/items/nao-e-uuid/attachments', PNG)).statusCode).toBe(400);
  });
});

describe('attachments sem storage configurado', () => {
  it('responde 503 storage_not_configured', async () => {
    const handle = await createDb({ inMemory: true });
    const { app } = await buildApp(env, handle.db); // env de teste não tem S3_*
    const base = await app.listen({ port: 0, host: '127.0.0.1' });
    const auth = createAuth({ env, db: handle.db, allowSignup: true });
    const user = { email: 'sem-storage@example.com', name: 'X', password: 'senha-muito-segura-789' };
    await auth.api.signUpEmail({ body: user });
    const login = await fetch(`${base}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    const jar = new Jar();
    jar.absorb(login.headers.getSetCookie());
    const headers = { ...JSON_HEADERS, cookie: jar.header() };

    const node = await (await fetch(`${base}/api/v1/nodes`, { method: 'POST', headers, body: JSON.stringify({ title: 'n' }) })).json();
    const item = await (
      await fetch(`${base}/api/v1/nodes/${node.id}/items`, { method: 'POST', headers, body: JSON.stringify({ title: 'i' }) })
    ).json();
    const res = await fetch(`${base}/api/v1/items/${item.id}/attachments`, { method: 'POST', headers, body: JSON.stringify(PNG) });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('storage_not_configured');

    await app.close();
    await handle.close();
  });
});

describe('S3 storage (assinatura, sem rede)', () => {
  const s3Env = loadEnv({
    NODE_ENV: 'test',
    AUTH_SECRET: 'x'.repeat(40),
    S3_ENDPOINT: 'https://conta.r2.cloudflarestorage.com',
    S3_BUCKET: 'chimpinho',
    S3_ACCESS_KEY_ID: 'AKIAFAKEFAKEFAKE',
    S3_SECRET_ACCESS_KEY: 'segredo-falso-segredo-falso-segredo',
  });

  it('só liga quando as 4 variáveis existem; string vazia conta como ausente', () => {
    expect(createS3Storage(env)).toBeUndefined();
    expect(loadEnv({ NODE_ENV: 'test', AUTH_SECRET: 'x'.repeat(40), S3_ENDPOINT: '', S3_BUCKET: '' }).S3_ENDPOINT).toBeUndefined();
    expect(createS3Storage(s3Env)).toBeDefined();
  });

  it('URL de upload assina content-type e content-length (limite aplicado pelo R2)', async () => {
    const s3 = createS3Storage(s3Env)!;
    const up = await s3.presignUpload({ key: 'u1/a1', mime: 'image/png', sizeBytes: 2048, expiresInSeconds: 900 });
    const url = new URL(up.url);
    expect(url.host).toBe('conta.r2.cloudflarestorage.com');
    expect(url.pathname).toContain('/chimpinho/u1/a1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    const signed = (url.searchParams.get('X-Amz-SignedHeaders') ?? '').split(';');
    expect(signed).toContain('content-type');
    expect(signed).toContain('content-length');
    expect(up.headers).toEqual({ 'content-type': 'image/png', 'content-length': '2048' });
  });

  it('URL de download expira em curto prazo e força o nome do arquivo', async () => {
    const s3 = createS3Storage(s3Env)!;
    const url = new URL(await s3.presignDownload({ key: 'u1/a1', filename: 'mapa.png', mime: 'image/png', expiresInSeconds: 300 }));
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('response-content-disposition')).toContain('mapa.png');
  });

  it('contentDisposition neutraliza aspas e caracteres não ASCII', () => {
    const header = contentDisposition('relatório "final".pdf');
    expect(header).toContain('filename="relat_rio _final_.pdf"');
    expect(header).toContain("filename*=UTF-8''relat%C3%B3rio%20%22final%22.pdf");
  });
});
