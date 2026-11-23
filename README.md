# Chimpinho Compendium

Caderno pessoal de anotações e estudos com estética inspirada em Red Dead Redemption 2.
Organiza trabalho, idiomas, música etc. em uma árvore de tópicos/subtópicos, com notas, flashcards (repetição espaçada), checklists, links e anexos (inclusive áudio).

## Status
Fase 1 (MVP) em andamento: backend com auth, árvore de tópicos e notas (`items`) prontos; frontend, anexos e busca pendentes. Ver `docs/prompts/000-plano-geral.md`.

## Decisões-chave
- Uso inicial: só do dono, **mas multiusuário-ready** (todo dado pertence a um `user_id`; cadastro público desligado por flag).
- Desktop e mobile com a mesma prioridade (mobile-first + PWA).
- Frontend: React + Vite + TypeScript. Backend: Node + Fastify + TypeScript. Banco: PostgreSQL.
- Anexos em storage S3-compatível (Cloudflare R2).

## Estrutura
```
/frontend            App React (ver frontend/README.md)
/backend             API Node (ver backend/README.md)
/docs
  /rules             Regras e decisões (curtas, normativas)
  /prompts           Planos de implementação, erros, histórico de sessões
  /design            Tokens de cor/fonte e guia de UI
  /references        Material de inspiração (não é asset do app)
```

## Como trabalhar neste projeto
1. Leia `docs/rules/` antes de implementar qualquer coisa.
2. Toda mudança relevante gera um arquivo em `docs/prompts/` (plano ou registro de erro).
3. Se uma regra mudar, atualize o arquivo em `docs/rules/` no mesmo commit.
