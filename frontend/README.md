# Frontend

## Stack (planejada)
React 18 + Vite + TypeScript, React Router, TanStack Query, Tailwind (tokens em `docs/design/tokens.md`), Tiptap (editor), vite-plugin-pwa.

## Estrutura prevista
```
src/
  app/          rotas, providers, layout raiz
  features/     um diretório por domínio (auth, tree, notes, flashcards, attachments, search)
  components/   UI genérica (Button, Panel, Tabs, RadialMenu...)
  styles/       tokens, fontes, globais
  lib/          api client, utils
```

## Regras
Ver `docs/rules/ui.md` e `docs/rules/convencoes.md`.

## Scripts (a definir na Fase 1)
`dev`, `build`, `lint`, `test`.
