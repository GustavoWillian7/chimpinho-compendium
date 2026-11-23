# 005 — Fase 1: módulo `attachments` (anexos via R2)

Data: 2026-11-23
Status: **implementado** (backend). 54 testes passando no total, typecheck limpo. Ver "Resultado" no fim.

## Objetivo
Permitir anexar imagem, áudio e PDF a um item (nota). O binário vive no R2 (API S3); o banco guarda só metadados (regra 8 de `dados.md`). Upload e download nunca passam pelo servidor: o cliente usa URLs pré-assinadas de curta duração (regras 12 e 13 de `seguranca.md`).

## Escopo
**Dentro:** tabela `attachments` + migração; fluxo de upload em duas etapas (reservar → enviar → confirmar); listar, baixar (URL assinada) e apagar (soft delete); abstração de storage com implementação S3/R2 e uma falsa para testes.

**Fora:** busca, cota total por usuário, purga física dos arquivos (entra com a lixeira, Fase 3), miniaturas/transcodificação, upload multipart (arquivos grandes).

## Decisões
1. **Fluxo em duas etapas.** `POST /items/:itemId/attachments` valida nome/MIME/tamanho, grava uma linha `pending` e devolve uma URL `PUT` pré-assinada. O cliente envia o arquivo direto ao R2. `POST /attachments/:id/complete` faz um `HEAD` no objeto, confere que o tamanho bate com o declarado e marca `ready`. Só `ready` aparece nas listagens.
2. **Limite de tamanho aplicado no R2.** O R2 não suporta POST policy; por isso o `Content-Length` e o `Content-Type` entram na assinatura do `PUT`. Enviar tamanho ou tipo diferente do declarado faz o R2 recusar. O `complete` confere de novo (defesa em profundidade) e, se divergir, apaga o objeto, apaga (soft) a linha e responde 422.
3. **Allowlist de MIME** (SVG fica de fora de propósito: pode carregar script):
   - imagem: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif`
   - áudio: `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/webm`, `audio/wav`, `audio/flac`
   - documento: `application/pdf`
4. **Limites por arquivo** (padrão, ajustáveis em `modules/attachments/limits.ts`): imagem 10 MB, PDF 20 MB, áudio 50 MB. Risco do R2 (10 GB) registrado no plano geral; cota por usuário fica como pendência.
5. **`storage_key` = `{user_id}/{attachment_id}`** (regra 8). O nome original vai só para o banco e para o `Content-Disposition` do download, nunca para a chave.
6. **Download:** `GET /attachments/:id/download` confere o dono e devolve `{ url, expiresAt }` (validade 5 min). Bucket privado.
7. **Soft delete:** a linha recebe `deleted_at`; o objeto permanece no R2 até a purga da Fase 3. Anexos de um item apagado (ou de node apagado em cascata) somem das consultas porque toda leitura faz join com `items.deleted_at IS NULL` — não é preciso mexer no soft delete de `items`/`nodes`.
8. **Linhas `pending` abandonadas** não aparecem em lugar nenhum; limpeza física fica junto da purga (Fase 3).
9. **Provedor-agnóstico (regra 8 de `arquitetura.md`):** interface `Storage` (`presignUpload`, `presignDownload`, `head`, `delete`). Implementação S3 usa `@aws-sdk/client-s3` + `s3-request-presigner`, configurada por `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (R2: `https://<account>.r2.cloudflarestorage.com`). Sem essas variáveis, as rotas respondem 503 `storage_not_configured`. `buildApp` aceita um storage injetado (testes).
10. **Item arquivado/node arquivado:** não se pode criar anexo em item cujo node está arquivado (409 `node_archived`), mesma regra de `items`.

## Schema (`backend/src/db/schema/attachments.ts`)
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL | FK `user.id`, cascade |
| `item_id` | uuid NOT NULL | FK `items.id`, cascade |
| `storage_key` | text NOT NULL UNIQUE | `{user_id}/{id}` |
| `filename` | text NOT NULL | 1–255, sem separadores de caminho |
| `mime` | text NOT NULL | CHECK na allowlist não é feita no banco (muda com frequência); validada no Zod |
| `size_bytes` | integer NOT NULL | CHECK > 0 |
| `status` | text NOT NULL | `pending` \| `ready` (CHECK) |
| `deleted_at` | timestamp | soft delete |
| `created_at`, `updated_at` | timestamp NOT NULL | |

Índices: `(user_id)`, `(item_id)`.

## Endpoints
- `POST   /api/v1/items/:itemId/attachments` — body `{ filename, mime, sizeBytes }` → 201 `{ attachment, upload: { url, method: 'PUT', headers } }`
- `POST   /api/v1/attachments/:id/complete` — confirma o upload → `attachment` (`ready`)
- `GET    /api/v1/items/:itemId/attachments` — lista anexos `ready`
- `GET    /api/v1/attachments/:id/download` — `{ url, expiresAt }`
- `DELETE /api/v1/attachments/:id` — soft delete

## Passos
1. Instalar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`.
2. Schema + migração (`npm run db:generate`).
3. `storage/` (interface, S3, falso para testes), `limits.ts`, `schemas.ts`, `repository.ts`, `service.ts`, `routes.ts`; registrar em `app.ts` (+ `AttachmentError` no handler global).
4. Variáveis no `env.ts` e `.env.example`.
5. `tests/attachments.spec.ts` (integração HTTP + storage falso).
6. `npm run typecheck` e `npm test`.
7. Atualizar `backend/README.md`, `000-plano-geral.md` e registrar o resultado aqui.

## Testes planejados
- Fluxo feliz: reservar → (simular upload) → completar → listar → baixar → apagar.
- Rejeitar MIME fora da allowlist (inclui `image/svg+xml`), tamanho 0, acima do limite do tipo e `filename` com `/` ou `..`.
- `complete` com objeto ausente ou tamanho divergente: erro e anexo continua `pending`/não listado.
- `pending` não aparece na lista nem no download.
- Acesso cruzado: outro usuário recebe 404 em tudo (criar, completar, listar, baixar, apagar).
- Item apagado esconde seus anexos; node arquivado bloqueia criação (409).
- Sem storage configurado: 503.
- Sem sessão: 401.

## Pendências
- Cota total por usuário (R2 10 GB).
- Purga física de objetos (lixeira, Fase 3) e limpeza de `pending` antigos.
- CORS do bucket R2 para o `PUT` direto do navegador (configurar no painel do R2 ao ligar o frontend).
- Upload multipart para áudios acima do limite.

## Resultado (2026-11-23)
- Implementado conforme o plano: `schema/attachments.ts`, migração `0003_hesitant_hobgoblin.sql`, módulo `modules/attachments/` (`routes`, `service`, `repository`, `schemas`, `storage`, `limits`).
- Testes: `attachments.spec.ts` com 15 casos (fluxo completo, validação, upload ausente, tamanho divergente, acesso cruzado, item/node apagado, node arquivado, 503 sem storage e assinatura S3 sem rede). Total backend: **54 passando**.
- A URL de upload assina `content-type` e `content-length` (conferido no teste); o limite é aplicado pelo próprio R2. **Não foi testado contra um R2 real** — falta uma verificação manual com bucket de verdade (ver pendências).
- `forcePathStyle: true` no cliente S3, para funcionar igual no R2 e em outros S3-compatíveis.

## Bug encontrado e corrigido: handler global de erros nunca rodava
`app.setErrorHandler` era chamado **depois** dos `await app.register(...)`. Plugins encapsulados herdam o handler vigente na criação, então `NodeError` e `ItemError` sempre caíam no handler padrão do Fastify (corpo `{ statusCode, error: "Conflict", message: "node_archived" }`, em vez de `{ error: "node_archived" }`). Os status HTTP estavam certos e nenhum teste conferia o corpo, por isso passou despercebido.
- Correção: handler movido para antes do registro das rotas. Erros do Fastify/plugins com status 4xx (413, 429...) passam com o status original — isso resolve também a pendência "erros de framework caem como 500" do `004`. Erros 5xx são logados.
- **Mudança visível para o frontend:** o corpo de erro de `nodes` e `items` agora é `{ "error": "<codigo>" }`, como documentado.

## Pendências novas
- Testar o fluxo contra um bucket R2 real (upload `PUT` com os headers devolvidos, `complete`, `download`) e configurar o CORS do bucket.
- O SDK da AWS avisa que versões publicadas depois de jan/2027 exigem Node ≥ 22; o ambiente local está no Node 20.18. Planejar a atualização do Node.
- `npm audit`: 4 vulnerabilidades moderadas, todas em `drizzle-kit` → `esbuild` (ferramenta de desenvolvimento, não vai para produção). Reavaliar quando o drizzle-kit atualizar.
