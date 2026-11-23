# 008 — Fase 1: página de nota com editor Tiptap

## Objetivo
Ligar o frontend ao módulo `items` (004): listar notas de um tópico, criar, editar com Tiptap e apagar.

## Decisões
1. **Rotas:** `/topics/:nodeId` (lista de notas do tópico) e `/notes/:id` (editor). O título do tópico na árvore virou link para `/topics/:id`.
2. **Editor:** Tiptap v3 com `StarterKit` (negrito, itálico, H2/H3, listas, citação). Texto limpo; o estilo "diário" fica só para o modo de leitura (Fase 5).
3. **Autosave:** debounce de 800 ms, um único `PATCH` com `title` e/ou `content`. Grava o que estiver pendente ao sair da página. Indicador de estado (`Salvo`, `Salvando…`, `Alterações não salvas`, erro); em erro, o pendente é mantido e reenviado na próxima edição.
4. **Título vazio não é enviado** (o backend exige 1+ caracteres).
5. **Cache da nota com `gcTime: 0`:** o editor inicia a partir do que foi buscado; um cache antigo mostraria texto desatualizado ao reabrir a nota.
6. Nota nova nasce com o título "Sem título" e já abre no editor.

## Resultado (2026-11-23)
- Implementado: `features/notes/` (`api`, `useNotes`, `TopicPage`, `NotePage`), rotas, estilos do editor e strings.
- `typecheck`, `lint`, `build` passam; **10 testes** (3 novos: carregar nota, autosave do título, título vazio não é enviado).
- **Não verificado no navegador:** toolbar, foco, toque no mobile e o fluxo completo contra o backend real ainda precisam de conferência manual.

## Pendências
- Autosave do **conteúdo** só é coberto indiretamente (o jsdom não simula bem a digitação no ProseMirror); conferir no navegador.
- Se o salvamento falhar e o usuário sair da página, o pendente se perde (sem fila/offline).
- Mover/reordenar notas e apagar pela lista do tópico.
- Anexos no editor (depende do R2 real), busca na UI, PWA.
