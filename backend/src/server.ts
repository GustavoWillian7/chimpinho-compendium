import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';

const env = loadEnv();
const { db } = await createDb({ url: env.DATABASE_URL });
const { app } = await buildApp(env, db);

await app.listen({ port: env.PORT, host: '0.0.0.0' });
