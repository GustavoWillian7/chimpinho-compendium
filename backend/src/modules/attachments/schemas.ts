import { z } from 'zod';
import { MIME_LIMITS } from './limits.js';

export const createAttachmentSchema = z
  .object({
    // Sem separadores de caminho nem caracteres de controle.
    filename: z
      .string()
      .min(1)
      .max(255)
      .refine((v) => !/[\\/\x00-\x1f\x7f]/.test(v) && v !== '.' && v !== '..', { message: 'invalid_filename' }),
    mime: z.string().refine((v) => v in MIME_LIMITS, { message: 'unsupported_mime' }),
    sizeBytes: z.number().int().positive(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const limit = MIME_LIMITS[v.mime];
    if (limit !== undefined && v.sizeBytes > limit) {
      ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: 'file_too_large' });
    }
  });

export const attachmentParamsSchema = z.object({ id: z.string().uuid() });
export const itemAttachmentsParamsSchema = z.object({ itemId: z.string().uuid() });
