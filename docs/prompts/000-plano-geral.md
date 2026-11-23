# 000 — Plano geral

## Respostas de planejamento
- Uso inicial: só do dono, expansão possível → desenhar multiusuário desde o início.
- Desktop e mobile com igual prioridade → mobile-first + PWA.
- Backend Node próprio.
- Anexos (inclusive áudio) já no MVP.

## Fases
**Fase 0 — Fundação**
- [x] Estrutura de pastas e documentação inicial
- [x] Paleta final (terracota mantido)
- [x] Fontes: decidido usar alternativas livres (Anton, Source Sans 3, Roboto Slab)
- [x] Better Auth validado com Fastify (spike aprovado, ver `002-fase1-spike-auth.md`)
- [x] ORM: Drizzle
- [x] Wireframes v1: `docs/design/wireframes/index.html` (menu, índice, detalhe, roda; desktop + mobile)

**Fase 1 — MVP** (em andamento)
- [x] Backend base + Auth (login, sessão, 2FA TOTP, cadastro desligado)
- [x] Árvore de tópicos (CRUD, mover, reordenar, soft delete em cascata) — ver `003-fase1-modulo-nodes.md`
- [x] Notas com editor rico — backend (módulo `items`), ver `004-fase1-modulo-items.md`. O editor Tiptap em si entra com o frontend.
- [x] Anexos (imagem, áudio, PDF) via R2 com URL assinada — backend (módulo `attachments`), ver `005-fase1-modulo-anexos.md`. Falta configurar o bucket R2 real e a UI no frontend.
- [x] Busca básica — backend (módulo `search`), ver `006-fase1-busca-basica.md`
- [x] Frontend base: scaffold, login (com TOTP), shell responsivo e árvore de tópicos — ver `007-fase1-frontend-base.md`
- [x] Página de nota com editor Tiptap (autosave) — ver `008-fase1-frontend-notas.md`. Falta conferir no navegador.
- [ ] UI de anexos (depende do R2 real)
- [ ] Busca na UI
- [ ] PWA instalável

**Fase 2 — Estudo**
- Decks e flashcards com repetição espaçada
- Registro de eventos de atividade (base da gamificação, ver Fase 4)
- Tags e favoritos
- Checklists e links

**Fase 3 — Conforto e segurança**
- Roda de criação rápida
- 2FA TOTP, recuperação de senha
- Exportar/importar, lixeira, histórico de versões

**Fase 4 — Progresso e gamificação** (depois da Fase 2)
- Perfil do "personagem": nome, patente/título, nível, barra de XP ("100/200 para o próximo nível") e recompensas a descobrir
- Patentes como capítulos: cada patente nova abre com tela cheia estilo "Capítulo II" + nome em cursiva
- Metas definidas pelo usuário (diária, semanal, mensal; várias ao mesmo tempo): métrica + alvo + período, contadas no fuso do usuário
- Metas com vários objetivos e medalhas bronze/prata/ouro conforme quantos foram cumpridos (progresso parcial conta)
- Conquistas: fixas do app e também criadas pelo usuário; grade de emblemas com estados bloqueado/desbloqueado
- Toasts in-app e Log com 3 abas: Tarefas (metas ativas), Checklist (objetivos do dia) e Histórico (conquistas e eventos) — sem push
- Hub "Progresso" com cards e contadores "X de Y" e tela de Conclusão total por categoria
- Regras: XP só de estudo e revisão (notas não contam); teto diário; streaks sem punição
- Tudo derivado de eventos de atividade (ver "Decisões de gamificação")

**Fase 5 — Polimento**
- Backlinks `[[nota]]`, estatísticas de estudo, cache offline de leitura
- Modo de leitura de notas em estilo diário (página dupla no desktop, página única no mobile)

## Decisões de gamificação
- Estilo visual e textual: western RDR2 (patentes, textos temáticos).
- Referências em `docs/references/rdr2/`; mapeamento completo tela a tela em `docs/references/README.md`. Resumo: `hint` (toasts), `quest-log` png/jpg + `RDR2_118` (Log em abas e medalhas), `challenges` (metas), `RDR2_22` (conquistas), `tutorial` (perfil/XP), `progress` + `stats` (hub e conclusão total), `chapter` (subida de patente), `RDR2_108`/`114` (cartões especiais), `Diario-de-Arthur-Morgan` (leitura de notas). Atenção: `achievements` é a tela Activities e `tutorial` é a tela Health.
- Tela de subida de patente usa a mesma fonte manuscrita do modo diário.
- Registro de eventos de atividade (card revisado, tempo estudado etc.) deve ser criado já na Fase 2, para o histórico começar a existir. XP, nível, metas e conquistas são calculados a partir dele, nunca guardados como contador solto.
- Push notifications descartado: complexidade desnecessária (service worker, VAPID, agendador, hospedagem que hiberna, limitação no iOS).
- Fonte manuscrita do modo diário: livre (Google Fonts); registrar licença em `docs/design/licencas-fontes.md`.
- No editor, manter texto limpo e legível; o estilo diário vale só para leitura.

## Riscos
- Anexos de áudio consomem armazenamento: limitar tamanho por arquivo e monitorar cota do R2.
- Render grátis hiberna: aceitar cold start ou avaliar Fly.io.
