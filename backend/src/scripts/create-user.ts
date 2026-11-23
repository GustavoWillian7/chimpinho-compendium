import { createAuth } from '../auth.js';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error('Uso: npm run user:create -- <email> "<nome>" <senha com 12+ caracteres>');
  process.exit(1);
}

const env = loadEnv();
const { db, close } = await createDb({ url: env.DATABASE_URL });
const auth = createAuth({ env, db, allowSignup: true });
const res = await auth.api.signUpEmail({ body: { email, name, password } });
console.log(`Usuário criado: ${res.user.email} (${res.user.id})`);
await close();
