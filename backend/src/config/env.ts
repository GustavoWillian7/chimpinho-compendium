import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

/** Variável opcional: string vazia vira `undefined`. */
const optionalString = <T extends z.ZodType<string>>(inner: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), inner.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  BASE_URL: z.string().url().default('http://localhost:3333'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET precisa ter ao menos 32 caracteres'),
  ALLOW_SIGNUP: bool,
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Storage S3-compatível (Cloudflare R2). Todas vazias = anexos desligados (503).
  S3_ENDPOINT: optionalString(z.string().url()),
  S3_BUCKET: optionalString(z.string()),
  S3_ACCESS_KEY_ID: optionalString(z.string()),
  S3_SECRET_ACCESS_KEY: optionalString(z.string()),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${msg}`);
  }
  return parsed.data;
}
