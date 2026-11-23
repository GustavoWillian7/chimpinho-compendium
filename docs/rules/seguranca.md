# Regras — Segurança

## Autenticação
1. Login obrigatório para tudo, exceto `/auth/*` e health check.
2. Não implementar criptografia/sessão manualmente: usar biblioteca madura (Better Auth) com argon2id.
3. Sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`. Nunca token em `localStorage`.
4. Cadastro público controlado por `ALLOW_SIGNUP` (padrão `false`).
5. 2FA TOTP e recuperação de senha entregues até a Fase 3.
6. Rate limit em login, cadastro e recuperação de senha.

## Autorização
7. **Toda query filtra por `user_id`.** Sem exceção. Cobrir com testes de acesso cruzado entre usuários.
8. IDs públicos são UUID, nunca sequenciais.

## Entrada e saída
9. Toda entrada validada com Zod; rejeitar campos desconhecidos.
10. Conteúdo rico sanitizado (allowlist) antes de renderizar. Nada de `dangerouslySetInnerHTML` sem sanitização.
11. Headers via `helmet`; CORS restrito à origem do frontend; CSRF protegido.

## Anexos
12. Upload por URL pré-assinada, com limite de tamanho e allowlist de MIME (imagem, áudio, PDF).
13. Bucket privado; acesso apenas por URL assinada de curta duração, emitida após checar o dono.

## Operação
14. Segredos só em variáveis de ambiente. `.env` fora do git.
15. Backups automáticos do banco e teste de restauração antes do lançamento.
16. Logs sem senha, token ou conteúdo de notas.
17. Dependências auditadas (`npm audit`) a cada fase.
