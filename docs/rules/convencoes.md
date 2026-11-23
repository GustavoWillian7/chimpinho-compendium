# Regras — Convenções

1. Idioma: interface em pt-BR, com strings centralizadas para permitir i18n depois. Código, commits e nomes técnicos em inglês.
2. Nomes: arquivos de componente `PascalCase.tsx`; demais `kebab-case.ts`; tabelas e colunas `snake_case`.
3. Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
4. ESLint + Prettier obrigatórios; CI falha com lint/type errors.
5. Testes: backend com Vitest (serviços e acesso cruzado de usuários); frontend com Vitest + Testing Library nos fluxos críticos.
6. Sem comentários óbvios; comentar apenas o "porquê".
7. Documentação: mudou regra → atualiza `docs/rules/`; mudou plano ou ocorreu erro relevante → novo arquivo em `docs/prompts/` (`NNN-titulo.md`).
8. PRs/commits pequenos, uma fase ou feature por vez.
