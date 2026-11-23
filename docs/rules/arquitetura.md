# Regras — Arquitetura

1. Monorepo simples: `frontend/` e `backend/` independentes, sem código compartilhado até haver necessidade real.
2. TypeScript obrigatório nos dois lados. Sem `any` implícito.
3. API REST JSON sob `/api/v1`. Contratos validados com Zod na entrada e tipados na saída.
4. Backend em camadas por módulo: `routes → service → repository`. Rota não acessa banco.
5. Frontend organizado por *feature*; componentes genéricos ficam em `components/`.
6. Estado de servidor via TanStack Query; estado de UI local ou Context. Sem Redux.
7. Mobile-first e PWA desde a Fase 1. Nenhuma tela é entregue sem versão mobile.
8. Hosting gratuito: front em Vercel/Cloudflare Pages, back em Render/Fly, banco Neon, anexos R2. Nada deve depender de um provedor específico além de Postgres e API S3.
9. Custos (verificado em 2026-11-11):
   - Grátis: React, Vite, Node, Fastify, Drizzle, Better Auth (open source); Vercel/Cloudflare Pages; Neon (1 GB/projeto, scale-to-zero após 5 min); Cloudflare R2 (10 GB-mês, 1M ops classe A, 10M classe B, egress grátis); Render (750 h/mês, hiberna após 15 min sem tráfego, filesystem efêmero, sem domínio próprio).
   - Pagos: licença web das fontes (ver `docs/design/licencas-fontes.md`) e domínio próprio, se quiser.
   - Limites que importam: 1 GB de banco e 10 GB de anexos. Áudio deve ter limite de tamanho por arquivo.
10. Toda decisão que contradiga estas regras exige atualizar este arquivo antes.
