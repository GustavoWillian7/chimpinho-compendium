# 004 — Fase 1: módulo `items` (notas com editor rico)

Data: 2026-11-16
Status: **implementado** (backend). 39 testes passando, typecheck limpo. Ver "Resultado" no fim.

## Objetivo
Criar o backend do módulo `items`: conteúdo que vive dentro de um node da árvore. Na Fase 1 só o tipo `note` é implementado, mas o schema já nasce com o campo `type` (regra em `docs/rules/dados.md`) para receber `flashcard_deck`, `checklist` e `link` depois sem migração destrutiva.

## Escopo
**Dentro:**
- Tabela `items` + migração Drizzle.
- CRUD de items do tipo `note`, escopado por `user_id`.
- Listar items de um node, mover item entre nodes, reordenar dentro do node.
- Soft delete.
- Coluna de texto extraído do conteúdo, preparada para a busca (usada na etapa "Busca básica").

**Fora (etapas seguintes da Fase 1 ou fases posteriores):**
- Anexos (R2), busca full-text, tags, backlinks `[[nota]]`.
- Tipos `flashcard_deck`, `checklist`, `link`.
- Exportação Markdown/JSON (requisito do produto, mas entra em etapa própria).
- Histórico de versões e lixeira com purge (pendências já listadas em 003).

## Decisões propostas
1. **Formato do conteúdo:** `content` em `jsonb`, guardando o JSON do Tiptap/ProseMirror (regra 5 de `dados.md`). O backend não interpreta o documento além de validar a forma básica (objeto com `type: "doc"`).
2. **Texto extraído:** coluna `content_text` (`text`), calculada no backend a cada gravação percorrendo o JSON. O cliente nunca a envia. Serve de base para o `tsvector` da busca, que entra na etapa de busca (não nesta).
3. **Tipo:** `type` como `text` com `CHECK` limitado a `note` por enquanto. Ampliar o `CHECK` depois é uma migração nova (regra 9: nunca editar migração aplicada).
4. **Ordenação:** `position` como `text` com o mesmo índice fracionário de `nodes` (reaproveita `fractional-index.ts`). A ordem é por `(user_id, node_id, position)`.
5. **Pertencimento:** `node_id` obrigatório, FK para `nodes(id)`. Todo acesso valida que o node pertence ao `user_id` da sessão (acesso cruzado devolve 404, como em `nodes`).
6. **Soft delete:** `deleted_at` no item. Quando um node é apagado em cascata, os items dele devem ser tratados como apagados também. Ver pergunta aberta 1.
7. **Limite de tamanho:** `content` com teto (proposta: 1 MB serializado) validado no Zod/Fastify, para evitar abuso. Imagens e áudio nunca vão no JSON: ficam em anexos.
8. **Estrutura de código:** `backend/src/modules/items/{routes,service,repository,schemas}.ts`, mesmo padrão de `nodes`. Um `ItemError` análogo ao `NodeError`, tratado no error handler global.

## Schema proposto (`backend/src/db/schema/items.ts`)
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `user_id` | uuid NOT NULL | FK `user.id`, `onDelete: cascade` |
| `node_id` | uuid NOT NULL | FK `nodes.id` |
| `type` | text NOT NULL | default `'note'`, CHECK in (`note`) |
| `title` | text NOT NULL | 1–255 caracteres |
| `content` | jsonb NOT NULL | doc Tiptap; default doc vazio |
| `content_text` | text NOT NULL | default `''`, derivado no backend |
| `position` | text NOT NULL | índice fracionário |
| `deleted_at` | timestamp | soft delete |
| `created_at`, `updated_at` | timestamp NOT NULL | `defaultNow()` |

Índices: `(user_id)`, `(node_id)`, `(user_id, node_id, position)`.

## Endpoints propostos
- `GET    /api/v1/nodes/:nodeId/items` — lista items do node, ordenados por `position`. Retorna metadados sem `content`.
- `POST   /api/v1/nodes/:nodeId/items` — cria item (`title`, `type`, `content?`).
- `GET    /api/v1/items/:id` — detalhe, com `content`.
- `PATCH  /api/v1/items/:id` — atualiza `title` e/ou `content` (recalcula `content_text`).
- `DELETE /api/v1/items/:id` — soft delete.
- `POST   /api/v1/items/:id/move` — muda de node e/ou reordena (`nodeId`, `beforeId`, `afterId`).

A listagem sem `content` evita transferir documentos grandes ao montar a árvore.

## Passos
1. Criar `schema/items.ts`, exportar em `schema/index.ts`, rodar `npm run db:generate` e conferir o SQL (FK e CHECK manuais se o Drizzle não gerar).
2. Escrever `extractText(doc)`: percorre o JSON do Tiptap e junta os nós de texto. Testes unitários próprios.
3. Implementar `schemas.ts` (Zod), `repository.ts`, `service.ts` e `routes.ts`; registrar as rotas em `app.ts`.
4. Adaptar o soft delete em cascata de `nodes` para também marcar os items (conforme decisão da pergunta 1).
5. Escrever `tests/items.spec.ts` (integração HTTP real, PGlite) e `tests/extract-text.spec.ts`.
6. Rodar `npm run typecheck` e `npm test`.
7. Atualizar `backend/README.md` (endpoints), `docs/rules/dados.md` (se algo mudar), marcar o item no `000-plano-geral.md` e registrar o resultado neste arquivo.

## Testes planejados
- Criar, listar, detalhar, atualizar e apagar uma nota.
- `content_text` recalculado ao atualizar `content` e ignorado se enviado pelo cliente.
- Reordenar dentro do node e mover para outro node.
- Rejeitar `type` inválido, `content` fora da forma esperada e conteúdo acima do limite.
- Acesso cruzado: usuário B não lê, edita, move nem cria item no node do usuário A (404).
- Apagar um node em cascata esconde seus items.
- Criar item em node apagado ou arquivado (ver pergunta 2).

## Perguntas abertas (decididas em 2026-11-16)
1. **Cascata de soft delete:** marcar `deleted_at` nos items na mesma transação. ✔
2. **Node arquivado:** permitir editar, não criar nem receber itens movidos (409 `node_archived`). ✔
3. **Limite de 1 MB:** mantido. ✔

## Pendências (para depois deste módulo)
- Índice `tsvector` (`portuguese`) sobre `title` + `content_text` na etapa de busca.
- Exportação de nota para Markdown.
- Novos tipos de item (Fase 2 em diante).

## Resultado (2026-11-16)
- Implementado conforme o plano: `schema/items.ts`, migração `0002_majestic_wrecking_crew.sql`, módulo `modules/items/` (`routes`, `service`, `repository`, `schemas`, `extract-text`).
- Soft delete de node agora também marca os items do node e dos descendentes, na mesma transação (`softDeleteByNodeTree`).
- Testes: `items.spec.ts` (11, integração HTTP), `extract-text.spec.ts` (3), e 2 novos em `fractional-index.spec.ts`. Total backend: **39 passando**.
- Violação do limite de 1 MB devolve 400 (`content_too_large`); para isso o `bodyLimit` do Fastify foi elevado para 2 MB.

## Bug encontrado e corrigido: índice fracionário
`keyBetween(null, next)` não conseguia gerar chave antes de `'0'` (devolvia `'00'`, que fica depois). Como a primeira chave era sempre `'0'`, mover um item/node para antes do primeiro da lista o colocava na posição errada. O teste de `nodes` só passava porque já havia outros nodes na raiz.
- Correção em `fractional-index.ts`: algoritmo de ponto médio que **nunca gera chaves terminadas em `'0'`** e começa no meio da base (`'V'`).
- Limitação: chaves legadas `'0'` já gravadas em banco de desenvolvimento ainda não aceitam inserção antes delas (lança erro explícito). Recriar o banco de dev (`./.data/pglite`) resolve; não há dados de produção.

## Outras observações
- Rate limit global sobe para 100 000 req/min só quando `NODE_ENV=test` (a suíte de items faz mais de 120 chamadas por minuto).
- O Better Auth limita logins em sequência; por isso `items.spec.ts` loga cada usuário uma vez e alterna as sessões.
- Erros de framework (ex.: 413, 429) ainda caem no handler global como 500. Pendência fora deste módulo.
