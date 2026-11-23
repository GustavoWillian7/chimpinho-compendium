# Regras — Dados

## Modelo base
- **users** — gerenciado pela lib de auth.
- **nodes** — árvore: `id, user_id, parent_id, path, title, icon, color, position, archived_at, deleted_at`.
- **items** — conteúdo dentro de um node: `id, user_id, node_id, type, title, content (jsonb), position, deleted_at`.
  - `type`: `note | flashcard_deck | checklist | link`
- **cards** — `id, user_id, item_id (deck), front, back, due_at, stability, difficulty, reps, lapses, last_review_at`.
- **attachments** — `id, user_id, item_id, storage_key, filename, mime, size_bytes, created_at`.
- **tags** / **item_tags** — tags por usuário, N:N com items.
- **links** — `from_item_id, to_item_id` (backlinks de `[[nota]]`).

## Regras
1. Toda tabela tem `id` UUID, `user_id`, `created_at`, `updated_at`.
2. Exclusão é *soft delete* (`deleted_at`); lixeira purgada após 30 dias.
3. Árvore: `parent_id` + `path` materializado; mover um node atualiza o `path` dos descendentes em transação.
4. Ordenação manual por `position` (fractional index), sem renumerar irmãos.
5. Conteúdo de nota guardado como JSON do Tiptap; exportação em Markdown deve ser sempre possível.
6. Flashcards usam FSRS (ou SM-2 como fallback); a escolha é fechada na Fase 2.
7. Busca: Postgres full-text (`tsvector`, config `portuguese`) sobre título e texto extraído.
8. Anexos: binário no R2, só metadados no banco. `storage_key` = `{user_id}/{uuid}`.
9. Migrações versionadas; nunca editar migração já aplicada.
10. Exportar/importar JSON e Markdown é requisito do produto (sem lock-in).
