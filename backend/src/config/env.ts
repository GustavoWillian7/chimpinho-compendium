import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

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
