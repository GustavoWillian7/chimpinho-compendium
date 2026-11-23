import { z } from 'zod';

export const createNodeSchema = z.object({
  title: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
});

export const moveNodeSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});

export const nodeParamsSchema = z.object({
  id: z.string().uuid(),
});

export const archiveNodeSchema = z.object({
  archived: z.boolean(),
});
