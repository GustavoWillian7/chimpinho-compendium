# 006 — Fase 1: busca básica

Data: 2026-11-23
Status: **implementado** (backend). 67 testes passando no total, typecheck limpo.

## Objetivo
Buscar notas por título e conteúdo, no backend, usando Postgres full-text (regra 7 de `dados.md`: `tsvector`, config `portuguese`). Isso usa a coluna `content_text` que o módulo `items` já mantém.

## Escopo
**Dentro:** coluna `search_vector` gerada + índice GIN; endpoint `GET /api/v1/search`; ranking; trecho (snippet) com os termos achados; busca parcial no título.

**Fora:** busca em títulos de nodes, em texto de anexos/PDF, tags, filtros por node, busca sem acento (ver pendências), sugestões/autocomplete.

## Decisões
1. **Coluna gerada, não trigger.** `items.search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('portuguese', title), 'A') || setweight(to_tsvector('portuguese', content_text), 'B')) STORED`. O Postgres mantém sozinho; o código de `items` não muda. Título pesa mais que corpo. A migração preenche os itens já existentes.
2. **Índice GIN** em `search_vector`.
3. **Consulta com `websearch_to_tsquery('portuguese', q)`**: aceita texto livre sem lançar erro de sintaxe (aspas para frase, `-` para excluir, `or`). Nunca montar `tsquery` na mão com entrada do usuário.
4. **Busca parcial no título:** além do full-text, casa `title ILIKE '%q%'` (com `%`, `_` e `\` escapados). O full-text só casa palavras inteiras (por radical), e quem digita "reun" espera achar "Reunião". Só no título, para não varrer o corpo inteiro.
5. **Ranking:** `ts_rank` sobre `search_vector`; empate por `updated_at` desc. Resultados só por ILIKE têm rank 0 e ficam depois dos full-text.
6. **Snippet:** `ts_headline('portuguese', content_text, query)` com marcadores de controle (`\u0001` abre, `\u0002` fecha), **nunca HTML**: o texto das notas é livre e o frontend não deve renderizar HTML vindo daqui. O cliente divide pelos marcadores e destaca com seu próprio elemento.
7. **Escopo de dados:** só items do usuário, não apagados (`items.deleted_at IS NULL`). Items de nodes apagados já estão apagados pela cascata. Items de nodes arquivados **aparecem**, com `nodeArchived: true`.
8. **Resposta:** lista de `{ id, nodeId, nodeTitle, nodeArchived, type, title, snippet, updatedAt }`, sem `content`. `q` de 1 a 200 caracteres (após `trim`); `limit` de 1 a 50, padrão 20.

## Endpoint
`GET /api/v1/search?q=<texto>&limit=<n>` → `200 [...]`. `q` vazio ou ausente → 400. Sem sessão → 401.

## Passos
1. Coluna gerada + índice GIN no schema (`customType` para `tsvector`), `npm run db:generate`, conferir o SQL.
2. Módulo `modules/search/` (`routes`, `service`, `repository`, `schemas`), registrado em `app.ts`; `SearchError` no handler global.
3. `tests/search.spec.ts` (integração, PGlite).
4. `npm run typecheck` e `npm test`.
5. Atualizar `backend/README.md`, `000-plano-geral.md`, registrar o resultado aqui.

## Testes planejados
- Acha por palavra do título e do corpo; título pesa mais que corpo.
- Radical em português ("reuniões" acha "reunião").
- Busca parcial no título; `%` e `_` na consulta são literais.
- Frase entre aspas e exclusão com `-`.
- Entrada hostil (`'`, `&`, `:*`, `(`) não gera erro 500.
- Snippet usa os marcadores de controle e não contém HTML gerado pelo servidor.
- Isolamento: outro usuário não vê nada; item apagado e node apagado somem; node arquivado aparece com `nodeArchived`.
- Atualizar a nota atualiza a busca (a coluna gerada acompanha).
- `limit` respeitado; `q` vazio/longo → 400; sem sessão → 401.

## Pendências (já previstas)
- Busca sem acento (`musica` achar "Música"): exige a extensão `unaccent` (e uma função `IMMUTABLE` para usar em coluna gerada). Avaliar com o frontend.
- Busca em títulos de nodes e em nome de anexos.
- Busca parcial no corpo (hoje só palavras inteiras/radicais).
- Plurais em `-ão/-ões` não se unem (`reunião` ≠ `reuniões`): é limitação do stemmer Snowball português do Postgres, não do código. Mitigado só no título, pela busca parcial. Avaliar dicionário de sinônimos/`unaccent` + trigram (`pg_trgm`) se incomodar.

## Resultado (2026-11-23)
- Migração `0004_bright_darkstar.sql` (coluna gerada + GIN) e módulo `modules/search/` (`routes`, `service`, `repository`, `schemas`).
- `tests/search.spec.ts`: 13 casos (título/corpo, radicais, ranking, busca parcial com `%`/`_` literais, operadores, entrada hostil, snippet, atualização, isolamento, apagado/arquivado, limit e validação). Total backend: **67 passando**.
- Verificado no Postgres (PGlite): `ts_headline` já remove tags HTML do texto da nota; o snippet só carrega os marcadores de controle.
- A coluna `search_vector` não é exposta pela API e foi excluída do tipo `ItemSummaryRow`.
- Aprendizado de teste: asserções de "lista vazia" passam por acaso se a consulta estiver errada (ex.: `fantasma-bbb` não casa com `termo-fantasma-bbb`). Sempre incluir controle positivo antes.
- Não rodado contra Postgres real/Neon (só PGlite, que é Postgres de verdade em WASM). A migração usa SQL padrão; conferir ao subir o banco de produção.
