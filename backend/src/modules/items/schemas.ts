import { z } from 'zod';

export const MAX_CONTENT_BYTES = 1_000_000;

export const contentSchema = z
  .object({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .passthrough()
  .refine((doc) => Buffer.byteLength(JSON.stringify(doc), 'utf8') <= MAX_CONTENT_BYTES, {
    message: 'content_too_large',
  });

export const createItemSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.literal('note').default('note'),
  content: contentSchema.optional(),
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: contentSchema.optional(),
});

export const moveItemSchema = z.object({
  nodeId: z.string().uuid().optional(),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});

export const itemParamsSchema = z.object({ id: z.string().uuid() });
export const nodeItemsParamsSchema = z.object({ nodeId: z.string().uuid() });
