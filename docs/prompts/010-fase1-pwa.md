# 010 — Fase 1: PWA instalável

Data: 2026-11-24

## Objetivo
Tornar o app instalável (desktop e mobile) sem arriscar dados autenticados em cache.

## Decisões
- `frontend/public/manifest.webmanifest` (standalone, fundo/tema `#020300`) e ícones 192/512, maskable 512 e `apple-touch-icon` (placeholder: estrela amarela em anel terracota; trocar quando houver arte final).
- Service worker próprio e mínimo (`public/sw.js`, sem plugin): guarda só o casco (HTML + `/assets/*` com hash). **Nunca intercepta `/api/`**, então notas e sessão não ficam em cache.
- Navegação: rede primeiro; sem rede abre o `index.html` salvo (o app abre, mas sem dados — cache offline de leitura é Fase 5).
- Registro só em produção (`import.meta.env.PROD`), para não atrapalhar o HMR.

## Resultado
- `typecheck`, `lint`, `build` e 14 testes passam. `dist/` contém manifest, ícones e `sw.js`.
- **Não verificado no navegador:** instalação (Chrome/Android/iOS), Lighthouse PWA. O SW exige HTTPS ou localhost; testar com `npm run build && npm run preview`.

## Pendências
- Verificado pelo dono no desktop (2026-11-24): a opção "Instalar" aparece. Cache Storage sem `/api/` conferido. Offline não foi testado (dado como OK pelo dono). Falta o mobile (Android via USB; iOS só após deploy com HTTPS).
- Ícone definitivo.
- Atualização do SW: `skipWaiting` + `clients.claim` aplicam a versão nova no próximo carregamento; sem aviso de "nova versão".
