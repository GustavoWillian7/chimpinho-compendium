# 002 — Fase 1: scaffold do backend + spike de auth

Data: 2026-11-11

## Resultado do spike: APROVADO
Better Auth 1.7 + Fastify 5 + Drizzle + Postgres funcionam juntos. Testes (`backend/tests/auth.spec.ts`, 7/7 passando):
- cadastro público bloqueado (`ALLOW_SIGNUP=false`) → 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`
- rota protegida sem sessão → 401
- senha errada → 401
- login → cookie `HttpOnly; SameSite=Lax`, rota protegida → 200
- 2FA TOTP: habilitar, login exige segundo fator (sem sessão até verificar), código errado rejeitado, código certo conclui
- headers de segurança (helmet)
Plano B (sessões próprias) **não será necessário**.

## Decisões
- **Banco em dev/testes: PGlite** (Postgres em WASM), sem Docker nem instalação. Produção: Postgres (Neon) via `DATABASE_URL`. Mesmas migrações Drizzle nos dois.
- **IDs UUID** também nas tabelas de auth (`advanced.database.generateId: 'uuid'` + `defaultRandom()` no schema). Sem `defaultRandom()` o cadastro falha.
- **Tabelas escritas à mão** (não geradas pela CLI do Better Auth, que exige módulo nativo e falhou no Windows). Ao atualizar o Better Auth, conferir o schema do plugin em `node_modules/better-auth/dist/plugins/two-factor/schema.mjs`.
- Senha: mínimo 12 caracteres. Sessão de 14 dias, renovada a cada 1 dia de uso.
- Criação de usuário: `npm run user:create -- <email> "<nome>" <senha>` (o servidor nunca expõe cadastro com a flag desligada).
- Testes usam **HTTP real** (porta efêmera + `fetch`), não `app.inject`.

## Problemas encontrados
| Problema | Causa | Solução |
|---|---|---|
| `npm i @better-auth/cli` falhou (node-gyp) | dependência nativa no Windows | dispensada; schema manual |
| Cadastro falhava com `id` nulo | uuid sem default no banco | `.defaultRandom()` em todos os ids |
| `app.inject` quebrava (`require() of ES Module cookie`) | `light-my-request` → `cookie@2` (ESM) exige Node ≥ 20.19 / 22.12; ambiente tem 20.18.3 | testes via HTTP real. **Recomendado atualizar para Node 22 LTS** |
| Segredo TOTP inválido no teste | URI traz o segredo em base32 | decodificar antes de calcular o código |

## Pendências conhecidas
- `npm audit`: 4 vulnerabilidades *moderate* em `esbuild` antigo dentro do `drizzle-kit` (**somente dev**, não vai para produção). `npm audit fix --force` faria downgrade quebrando; aguardar nova versão do drizzle-kit.
- Atualizar Node local para 22 LTS (frontend com Vite 7 também exige ≥ 20.19).
- Rate limit do Better Auth é em memória; ao rodar com mais de uma instância, mover para o banco.

## Próximos passos (Fase 1)
1. Módulo `nodes` (árvore): CRUD, mover, reordenar, com `user_id` em toda query + testes de acesso cruzado.
2. Módulo `items` (notas).
3. Anexos (R2, URL assinada).
4. Busca.
5. Frontend base (tokens, fontes, layout responsivo, login).
