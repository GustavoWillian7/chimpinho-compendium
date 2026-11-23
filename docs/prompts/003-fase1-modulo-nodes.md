# 003 — Fase 1: módulo `nodes` (árvore de tópicos)

Data: 2026-11-12

## O que foi feito
Implementação do backend da árvore de tópicos/subtópicos:

- Schema `nodes` (`backend/src/db/schema/nodes.ts`) com:
  - `id` UUID, `user_id`, `parent_id`, `path` materializado, `title`, `icon`, `color`.
  - `position` como `text` (índice fracionário em base 62) para ordenação manual.
  - `archived_at` e `deleted_at` (soft delete).
  - Índices: `user_id`, `parent_id`, `path`, `position` composto.
- Migração `0001_peaceful_frog_thor.sql` gerada pelo Drizzle Kit.
  - FK `parent_id → nodes(id)` adicionada manualmente ao SQL (o schema não declara a self-reference para evitar inferência circular de tipos no Drizzle).
- Camadas `routes → service → repository` em `backend/src/modules/nodes/`.
- Funcionalidades:
  - CRUD de nodes (criar, listar árvore, detalhe, atualizar, soft delete).
  - Soft delete em cascata: deletar um node também deleta todos os descendentes.
  - Arquivar/desarquivar (`?archived=true` lista arquivados).
  - Mover e reordenar (`/move` com `parentId`, `beforeId`, `afterId`).
  - Path materializado atualizado em transação ao mover.
- Índice fracionário customizado (`fractional-index.ts`) em base 62, sem dependências externas.
- Validação de entrada com Zod em todas as rotas.
- `user_id` obrigatório em toda query; testes de acesso cruzado incluídos.
- Error handler global para `NodeError`, retornando os status corretos (401, 404, 400).

## Endpoints adicionados
- `GET /api/v1/nodes` — listar árvore (`?archived=true`)
- `POST /api/v1/nodes` — criar node
- `GET /api/v1/nodes/:id`
- `PATCH /api/v1/nodes/:id`
- `DELETE /api/v1/nodes/:id`
- `POST /api/v1/nodes/:id/move`
- `POST /api/v1/nodes/:id/archive`

## Testes
- `backend/tests/nodes.spec.ts`: 12 testes de integração via HTTP real.
  - Criação raiz/filho, path materializado, listagem, atualização.
  - Reordenação, mover para outro parent, impedir mover para dentro de descendente.
  - Arquivar, soft delete e soft delete em cascata.
  - Acesso cruzado entre usuários.
- `backend/tests/fractional-index.spec.ts`: 4 testes do índice fracionário.
- Total backend: **23 testes passando**.

## Decisões e observações
- `position` foi mantido como `text` em vez de `real` para evitar perda de precisão com o índice fracionário.
- O schema Drizzle omite a self-reference FK em `parent_id`; a constraint fica na migração SQL. Isso evita o erro TS de inferência circular (`node` implicitly `any`) sem perder a integridade do banco.
- Soft delete em cascata é feito por prefixo de `path` dentro de uma transação.
- O próximo passo do plano é o módulo `items` (notas com editor rico).

## Pendências do módulo (para Fases 2–3)
- Lixeira com purge após 30 dias.
- Histórico de versões de nodes.
- Busca full-text sobre títulos de nodes.
