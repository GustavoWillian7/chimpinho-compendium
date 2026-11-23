# Frontend

## Stack
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

## Rodando
Suba o backend (`backend/README.md`, porta 3333) e depois:
```
npm install
npm run dev     # http://localhost:5173 (proxy de /api para o backend)
```

## Scripts
| Script | O que faz |
|---|---|
| `dev` | Vite com proxy de `/api` |
| `build` | typecheck + build de produção |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint |
| `test` | Vitest + Testing Library (jsdom) |

Versões fixadas por causa do Node 20.18 local: Vite 6 e jsdom 26 (ver `docs/prompts/007`).
