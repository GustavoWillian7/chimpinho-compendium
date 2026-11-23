# 001 — Verificações da Fase 0

Data: 2026-11-11

## Decisões do dono
- Cor "Bege" `#c33e2a` mantida como terracota. Sem bege adicional por ora.
- Pesquisar licenças das fontes e validar Better Auth antes de prosseguir.

## Better Auth
**Confirmado (docs oficiais/guias):**
- Plugin de 2FA com TOTP (`/two-factor/verify-totp`), tolerância de ±1 período, códigos de backup.
- Fluxo: após a senha, cookie temporário de 2FA (padrão 10 min); sessão completa só após verificar.
- Adapter Drizzle, com schema gerado pela CLI.
**Não confirmado:** integração específica com Fastify (encaminhar cookies/headers entre `auth.api` e a resposta).
**Ação:** na Fase 1, fazer um spike curto (login + 2FA + cookie via Fastify) antes de construir o resto. Se falhar, plano B: Lucia-style com sessões próprias em Postgres + `argon2` + `otplib`.

## Custos da stack
Ver `docs/rules/arquitetura.md` (seção Custos).
