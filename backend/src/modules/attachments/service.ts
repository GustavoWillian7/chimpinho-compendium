import { randomUUID } from 'node:crypto';
import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { createItemRepository } from '../items/repository.js';
import { createNodeRepository } from '../nodes/repository.js';
import { DOWNLOAD_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS } from './limits.js';
import { createAttachmentRepository, type AttachmentRow } from './repository.js';
import type { Storage } from './storage.js';

export class AttachmentError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export class AttachmentService {
  private repo: ReturnType<typeof createAttachmentRepository>;
  private items: ReturnType<typeof createItemRepository>;
  private nodes: ReturnType<typeof createNodeRepository>;

  constructor(
    db: Database,
    private auth: Auth,
    private storage: Storage | undefined,
  ) {
    this.repo = createAttachmentRepository(db);
    this.items = createItemRepository(db);
    this.nodes = createNodeRepository(db);
  }

  private async requireSession(headers: Headers) {
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new AttachmentError('unauthorized', 401);
    return session.user;
  }

  private requireStorage(): Storage {
    if (!this.storage) throw new AttachmentError('storage_not_configured', 503);
    return this.storage;
  }

  private async requireItem(itemId: string, userId: string) {
    const found = await this.items.findById(itemId, userId);
    if (!found) throw new AttachmentError('item_not_found', 404);
    return found;
  }

  private async requireAttachment(id: string, userId: string) {
    const found = await this.repo.findById(id, userId);
    if (!found) throw new AttachmentError('not_found', 404);
    return found;
  }

  async create(headers: Headers, itemId: string, input: { filename: string; mime: string; sizeBytes: number }) {
    const user = await this.requireSession(headers);
    const storage = this.requireStorage();
    const parent = await this.requireItem(itemId, user.id);
    const node = await this.nodes.findById(parent.nodeId, user.id);
    if (!node) throw new AttachmentError('item_not_found', 404);
    if (node.archivedAt) throw new AttachmentError('node_archived', 409);

    const id = randomUUID();
    const storageKey = `${user.id}/${id}`;
    const upload = await storage.presignUpload({
      key: storageKey,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
    const row = await this.repo.insert({ id, userId: user.id, itemId, storageKey, ...input });
    return { attachment: this.toAttachment(row), upload };
  }

  async complete(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const storage = this.requireStorage();
    const row = await this.requireAttachment(id, user.id);
    if (row.status === 'ready') return this.toAttachment(row);

    const object = await storage.head(row.storageKey);
    if (!object) throw new AttachmentError('upload_not_found', 409);
    if (object.sizeBytes !== row.sizeBytes) {
      // Arquivo diferente do declarado: não confiar nele.
      await storage.delete(row.storageKey);
      await this.repo.softDelete(row.id, user.id);
      throw new AttachmentError('size_mismatch', 422);
    }

    const ready = await this.repo.markReady(id, user.id);
    if (!ready) throw new AttachmentError('not_found', 404);
    return this.toAttachment(ready);
  }

  async list(headers: Headers, itemId: string) {
    const user = await this.requireSession(headers);
    await this.requireItem(itemId, user.id);
    const rows = await this.repo.findReadyByItem(user.id, itemId);
    return rows.map((r) => this.toAttachment(r));
  }

  async download(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const storage = this.requireStorage();
    const row = await this.requireAttachment(id, user.id);
    if (row.status !== 'ready') throw new AttachmentError('not_found', 404);

    const url = await storage.presignDownload({
      key: row.storageKey,
      filename: row.filename,
      mime: row.mime,
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });
    return { url, expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString() };
  }

  async delete(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const row = await this.repo.softDelete(id, user.id);
    if (!row) throw new AttachmentError('not_found', 404);
    return { id: row.id, deletedAt: row.deletedAt };
  }

  private toAttachment(row: AttachmentRow) {
    return {
      id: row.id,
      itemId: row.itemId,
      filename: row.filename,
      mime: row.mime,
      sizeBytes: row.sizeBytes,
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}
