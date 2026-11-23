# Backend

## Stack
Node, Fastify 5, TypeScript, Zod, Drizzle ORM, Better Auth (com 2FA TOTP), PostgreSQL (Neon em produção; PGlite em dev/testes), Cloudflare R2 (API S3) para anexos.

## Rodando
```
cp .env.example .env        # defina AUTH_SECRET (32+ caracteres)
npm install
npm run user:create -- voce@email.com "Seu Nome" "uma-senha-com-12-ou-mais"
npm run dev                 # http://localhost:3333
```
Sem `DATABASE_URL`, os dados ficam em `./.data/pglite` (ignorado pelo git).

## Scripts
| Script | O que faz |
|---|---|
| `dev` | servidor com reload |
| `build` / `start` | compila e roda `dist` |
| `typecheck` | `tsc --noEmit` |
| `test` | vitest (usa PGlite em memória) |
| `db:generate` | gera migração a partir de `src/db/schema` |
| `user:create` | cria usuário (único jeito com `ALLOW_SIGNUP=false`) |

## Estrutura
```
src/
  config/env.ts        env validado com Zod
  db/                  client (PGlite|pg), schema/, migrations/
  plugins/auth-route.ts  ponte Fastify ↔ Better Auth
  modules/               nodes, items, attachments, search (routes → service → repository)
  auth.ts              configuração do Better Auth
  app.ts               buildApp(): helmet, cors, rate-limit, rotas
  server.ts            entrypoint
  scripts/             create-user
tests/                 testes de integração (HTTP real)
```
Módulos de domínio (`modules/nodes`, `items`...) entram como `routes → service → repository`.

## Endpoints atuais
- `GET /health`
- `GET|POST /api/auth/*` (Better Auth: sign-in, sign-out, two-factor/*)
- `GET /api/v1/me` (protegida; modelo para as demais)
- `GET /api/v1/nodes` — listar árvore (`?archived=true` inclui arquivados)
- `POST /api/v1/nodes` — criar node
- `GET /api/v1/nodes/:id` — detalhe de um node
- `PATCH /api/v1/nodes/:id` — atualizar título, ícone, cor
- `DELETE /api/v1/nodes/:id` — soft delete (em cascata nos descendentes)
- `POST /api/v1/nodes/:id/move` — mover/reordenar (`parentId`, `beforeId`, `afterId`)
- `POST /api/v1/nodes/:id/archive` — arquivar/desarquivar (`{ archived: boolean }`)
- `GET /api/v1/nodes/:nodeId/items` — listar items do node (sem `content`)
- `POST /api/v1/nodes/:nodeId/items` — criar nota (`title`, `content?` em JSON Tiptap; 409 se o node está arquivado)
- `GET /api/v1/items/:id` — detalhe, com `content`
- `PATCH /api/v1/items/:id` — atualizar `title` e/ou `content`
- `DELETE /api/v1/items/:id` — soft delete
- `POST /api/v1/items/:id/move` — mover/reordenar (`nodeId`, `beforeId`, `afterId`)
- `POST /api/v1/items/:itemId/attachments` — reservar anexo (`filename`, `mime`, `sizeBytes`); devolve `{ attachment, upload }` com URL `PUT` pré-assinada. Imagem até 10 MB, PDF até 20 MB, áudio até 50 MB; SVG não é aceito
- `POST /api/v1/attachments/:id/complete` — confirmar o upload (confere o tamanho no bucket)
- `GET /api/v1/items/:itemId/attachments` — listar anexos confirmados
- `GET /api/v1/attachments/:id/download` — `{ url, expiresAt }` (URL assinada, 5 min)
- `DELETE /api/v1/attachments/:id` — soft delete
- `GET /api/v1/search?q=<texto>&limit=<1-50>` — busca em título e conteúdo das notas (full-text `portuguese` + prefixo no título). Devolve `{ id, nodeId, nodeTitle, nodeArchived, type, title, snippet, updatedAt }`. O `snippet` marca os termos com `` (início) e `` (fim), nunca HTML: o cliente deve renderizar como texto e destacar por conta própria. Aceita aspas para frase e `-termo` para excluir

Sem `S3_*` no `.env`, as rotas de anexos respondem 503 `storage_not_configured`. Erros têm o formato `{ "error": "<codigo>" }`.

### Configurar o R2
1. Crie um bucket **privado** e um token de API (leitura e escrita) restrito a ele.
2. Preencha `S3_ENDPOINT` (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
3. Ao ligar o frontend, adicione no bucket uma regra de CORS que permita `PUT` e `GET` a partir da origem do app (o navegador envia o arquivo direto ao R2).

## Regras
`docs/rules/seguranca.md`, `dados.md`, `arquitetura.md`.
