# Design Tokens

## Cores
| Token | Valor | Uso |
|---|---|---|
| `--color-red` | `#b60616` | Ação principal, títulos grandes, destaques |
| `--color-yellow` | `#feaa00` | Foco, seleção, progresso |
| `--color-terracotta` | `#c33e2a` | Detalhes, bordas, hover (o "bege" original; é um terracota) |
| `--color-black` | `#020300` | Fundo base |
| `--color-gray` | `#b8b8b8` | Texto secundário, bordas |
| `--color-white` | `#fffdfe` | Texto principal |

**Decisão:** `#c33e2a` fica como terracota; não haverá bege adicional por ora.
**Atenção:** `#b60616` sobre `#020300` tem contraste baixo; usar só em texto grande/ícones ou com fundo mais claro.

## Fontes (decisão: alternativas livres, 2026-11-11)
| Papel | Fonte adotada (Google Fonts, OFL) | Inspiração original |
|---|---|---|
| Tópicos | **Anton** | Chinese Rocks |
| Subtópicos / UI | **Source Sans 3** (400/600/700) | Effra |
| Texto | **Roboto Slab** 600 (leitura longa: 400) | Hapna Slab Serif DemiBold |

Variáveis CSS: `--font-topic`, `--font-sub`, `--font-text`. Nenhum componente referencia o nome da fonte diretamente, o que permite trocar depois.
Self-host via `@fontsource` (sem depender do CDN do Google). Fallbacks: Impact, system-ui, Georgia.
Licenças: ver `licencas-fontes.md`.

## Escala (rascunho)
- Espaçamento: 4, 8, 12, 16, 24, 32, 48
- Raio: 2px (painéis quase retos, estilo cartaz antigo)
- Tipografia: 12, 14, 16, 20, 28, 40
