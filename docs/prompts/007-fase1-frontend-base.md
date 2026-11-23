# 007 — Fase 1: frontend base

## Objetivo
Começar o frontend (mobile-first) e ligar ao backend já pronto. Primeiro corte vertical: **scaffold, tokens/fontes, cliente de API, login, shell de navegação e árvore de tópicos**. Editor Tiptap, anexos, busca na UI e PWA ficam para os cortes seguintes.

## Decisões
1. **Vite 6** (não 7): o ambiente local está no Node 20.18 e o Vite 7 exige 20.19+.
2. **Tailwind v4** com tokens em `@theme` (`src/styles/tokens.css`), espelhando `docs/design/tokens.md`.
3. **Sessão por cookie** do Better Auth (`credentials: 'include'`). Em dev, o Vite faz proxy de `/api` para `localhost:3333`, então front e back parecem a mesma origem e não há CORS nem cookie cross-site.
4. Cliente de API próprio e pequeno (`lib/api.ts`) sobre `fetch`; erros viram `ApiError` com o `error` do corpo (`{ error: "<codigo>" }`).
5. Strings da interface centralizadas em `lib/strings.ts` (pt-BR, preparado para i18n).
6. Estado de servidor com TanStack Query; sem estado global além disso.

## Passos
1. Scaffold (`package.json`, `vite.config.ts`, `tsconfig`, ESLint, Prettier, Vitest).
2. Tokens, fontes `@fontsource`, estilos globais.
3. `lib/api.ts`, `features/auth` (login, 2FA TOTP, guarda de rota).
4. Shell: abas (base no mobile, topo no desktop).
5. `features/tree`: listar, criar, renomear, apagar tópicos.
6. Testes dos fluxos críticos.

## Resultado (2026-11-23)
- Implementado: scaffold, tokens/fontes, `lib/api.ts`, login com segundo passo TOTP, shell com abas (base no mobile, topo no desktop) e árvore de tópicos (criar raiz/subtópico, renomear, apagar com confirmação, recolher).
- `typecheck`, `lint` e `build` passam; **7 testes** (login com erro, login com TOTP, árvore).
- Verificado de ponta a ponta com o backend real, pelo proxy do Vite: login, `/me`, criar raiz e filho, árvore aninhada, `DELETE` sem corpo e logout. **Não foi aberto no navegador**: layout, foco e toque ainda não foram conferidos visualmente.
- **Verificado no navegador pelo dono (2026-11-23):** a tela abre e o login funciona com o backend real. Layout mobile, foco e contraste ainda não foram conferidos com atenção.
- Tropeços no primeiro uso (Windows), agora documentados em `backend/README.md`: faltava o `backend/.env` (o backend recusa subir sem `AUTH_SECRET`); a senha precisa ter 12+ caracteres; e `npm run user:create` passa por `cmd.exe`, que lê `&` como separador de comandos e corta a senha. Contorno: `node --import tsx src/scripts/create-user.ts '<email>' '<nome>' '<senha>'`.
- `jsdom` fixado na v26: a v27 exige Node ≥ 20.19 e o ambiente está no 20.18 (mesma causa do Vite 6). Sai junto com a atualização do Node.
- `vitest` com `globals: true`, senão o Testing Library não limpa o DOM entre testes.
- Folhas da árvore não têm botão de expandir (só espaçador), para não poluir a navegação por leitor de tela.

## Pendências (cortes seguintes)
- Conferir com atenção no navegador (mobile 360 e desktop) e validar contraste AA das combinações usadas (cinza/40% em bordas, vermelho só em títulos grandes).
- Rota `/login` e `/` dependem de `/api/v1/me`; falta tratar sessão expirada no meio do uso (401 em qualquer chamada → voltar ao login).
- CI (`lint`, `typecheck`, `test`) ainda não existe.
- Editor Tiptap e página de nota.
- UI de anexos (precisa do R2 real + CORS).
- Busca na UI (decidir `unaccent`).
- PWA (`vite-plugin-pwa`) e verificação de instalabilidade.
- Mover/reordenar por arrastar na árvore.
