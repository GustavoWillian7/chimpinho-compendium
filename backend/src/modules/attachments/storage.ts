import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../../config/env.js';

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  /** Headers que o cliente DEVE enviar exatamente como estão (fazem parte da assinatura). */
  headers: Record<string, string>;
}

/** Abstração mínima sobre a API S3, para não depender de um provedor (regra 8 de arquitetura.md). */
export interface Storage {
  presignUpload(input: { key: string; mime: string; sizeBytes: number; expiresInSeconds: number }): Promise<PresignedUpload>;
  presignDownload(input: { key: string; filename: string; mime: string; expiresInSeconds: number }): Promise<string>;
  /** Devolve o tamanho do objeto, ou `null` se ele não existe. */
  head(key: string): Promise<{ sizeBytes: number } | null>;
  delete(key: string): Promise<void>;
}

/** Nome seguro para Content-Disposition (ASCII em `filename`, UTF-8 em `filename*`). */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function createS3Storage(env: Env): Storage | undefined {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) return undefined;

  const bucket = env.S3_BUCKET;
  const client = new S3Client({
    region: 'auto',
    // Path-style (endpoint/bucket/key): funciona no R2 e em qualquer S3-compatível (MinIO etc.).
    forcePathStyle: true,
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });

  return {
    async presignUpload({ key, mime, sizeBytes, expiresInSeconds }) {
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: sizeBytes });
      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return { url, method: 'PUT', headers: { 'content-type': mime, 'content-length': String(sizeBytes) } };
    },

    async presignDownload({ key, filename, mime, expiresInSeconds }) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: mime,
        ResponseContentDisposition: contentDisposition(filename),
      });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },

    async head(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { sizeBytes: res.ContentLength ?? 0 };
      } catch (err) {
        const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw err;
      }
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
