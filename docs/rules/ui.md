# Regras — UI

1. Tema escuro como padrão; fundo preto/quase preto, painéis com textura sutil e bordas finas em cinza.
2. Tipografia (ver `docs/design/tokens.md`): **Anton** só em títulos de tópico; **Source Sans 3** em subtópicos, menus e rótulos; **Roboto Slab 600** em textos.
3. Vermelho = ação/destaque principal e títulos grandes. Amarelo = foco, seleção e progresso. Nunca vermelho em corpo de texto pequeno.
4. Contraste mínimo WCAG AA em todo texto. Validar cada combinação nova.
5. Padrões inspirados em RDR2:
   - **Menu de pausa** → navegação principal em abas (topo no desktop, base no mobile).
   - **Índice do mapa** → árvore de tópicos com ícone e contador.
   - **Detalhe de animal** → página de tópico: cabeçalho, painel de metadados/progresso, itens relacionados.
   - **Roda de itens** → criação rápida e troca de espaço (atalho no desktop, toque longo no mobile; fallback em menu comum).
6. Breakpoints: 360 / 768 / 1024 / 1440. Alvos de toque ≥ 44px.
7. Tudo acessível por teclado; foco visível sempre; `prefers-reduced-motion` respeitado.
8. Animações curtas (≤ 250ms) e funcionais. Efeito "RDR2" é visual, nunca atrapalha a velocidade de anotar.
9. Imagens do jogo não entram no app. Ornamentos são criados/licenciados à parte.
10. Somente fontes livres (OFL), self-hosted via `@fontsource`; fallbacks Impact / system-ui / Georgia.
