# 009 — Fase 1: busca na UI

Data: 2026-11-23

## Objetivo
Tela de busca ligada a `GET /api/v1/search` (006).

## Decisões
- Rota `/search` e aba "Busca" no shell. Termo em `?q=` (link compartilhável, sobrevive ao reload).
- Debounce de 300 ms; só consulta com termo não vazio; `q` limitado a 200 caracteres.
- Snippet: o backend manda marcadores `\u0001`/`\u0002`; o cliente os converte em `<mark>` via `parseSnippet` (sem regex, por causa de `no-control-regex`). Nunca `dangerouslySetInnerHTML`.
- `unaccent` **adiado**: continua só no backend como pendência; não bloqueia a UI.

## Resultado
- `features/search/` (`api`, `snippet`, `useSearch`, `SearchPage`) + testes (4 novos, 14 no total). `typecheck`, `lint`, `build` passam.
- **Não verificado no navegador** (mobile 360 e desktop) contra o backend real.

## Pendências
- Busca sem acento (`unaccent`) e plural `-ão/-ões` (ver 006).
- Atalho de teclado e histórico de buscas, se fizer falta.
