import { z } from 'zod';

export const searchQuerySchema = z
  .object({
    // NUL não existe em texto do Postgres; sem este filtro viraria erro 500.
    q: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((v) => !v.includes('\u0000'), { message: 'invalid_characters' }),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
