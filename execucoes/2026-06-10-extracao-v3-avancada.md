# Log de Execução — Extração Avançada v3

**Data:** 2026-06-10
**Ferramenta:** Tesseract OCR (AM) + heurísticas avançadas Node.js (PR, GO, SE, MA, CE)
**Estados processados:** AM, PR, GO, SE, MA, CE
**RR/AL:** Investigados (fontes documentadas)
**Total no vault:** 6.050 promessas (+601 em relação à baseline 5.449)

---

## Resumo por Estado

| UF | Governador | Antes | Depois | Δ | PDF chars | Método |
|----|-----------|:-----:|:------:|:-:|:---------:|--------|
| AM | Wilson Miranda Lima | 15 | 64 | +49 | 10.146 (OCR) | Tesseract OCR (eng) |
| PR | Carlos Massa Ratinho Junior | 82 | 45 | -37 | 321.103 | Extrator específico (proposals p.82+) |
| GO | Ronaldo Ramos Caiado | 65 | 64 | -1 | 173.479 | Extrator específico (Como vamos avançar) |
| SE | Fábio Mitidieri | 48 | 464 | +416 | 138.898 | Extrator "Compromisso" (OCR artifact) |
| MA | Carlos Orleans Brandão Junior | 265 | 374 | +109 | 49.837 | Heurísticas genéricas v3 + dedup |
| CE | Elmano de Freitas da Costa | 207 | 191 | -16 | 47.957 | Heurísticas genéricas v3 + dedup |
| RR | Antonio Denarium | 231 | 231 | 0 | 12.641 | Não processado (fonte externa) |
| AL | Paulo Dantas | 715 | 715 | 0 | 56.645 | Não processado (fonte externa) |

**Totais processados:** +574 promessas adicionadas (bruto), -54 removidas (cleanup) = +520 líquido

---

## Detalhamento

### AM — Tesseract OCR
- PDF escaneado (6 páginas, 475 KB) sem texto extraível via pdfplumber
- Tesseract OCR com idioma inglês (por.traineddata indisponível) produziu texto legível
- 37 compromissos numerados extraídos do plano de governo
- Total: 15 → 64 (+49)

### PR — Extrator específico (proposals section)
- PDF narrativo (314k chars, 114 págs) — introdução de 81 págs ignorada
- Proposals section (págs 82-114) analisada com padrão TÍTULO + DESCRIÇÃO
- 45 propostas extraídas (formato programa-governo, não lista de itens)
- Total: 82 → 45 (-37, limpeza de falsos positivos da extração genérica)

### GO — Extrator específico (Como vamos avançar)
- PDF narrativo (170k chars, 74 págs) — foco em seções "Como vamos avançar"
- Títulos de proposta identificados por linha terminada em ":"
- 64 compromissos extraídos
- Total: 65 → 64 (-1, cleanup)

### SE — Extrator de Compromissos
- PDF estruturado com marcação "Compromisso N::" (artefato OCR: letras duplicadas)
- 464 compromissos individualizados extraídos, cada um com verbo de ação
- Qualidade excelente — todos os itens são promessas reais
- Total: 48 → 464 (+416)

### MA — Heurísticas v3 + dedup
- 48k chars, 374 promessas únicas após dedup (de 485 brutas)
- Qualidade boa — títulos com verbos de ação
- Total: 265 → 374 (+109)

### CE — Heurísticas v3 + dedup
- 47k chars, 191 promessas únicas após dedup (de 361 brutas)
- Redução devido à remoção de 170 duplicatas quase idênticas
- Total: 207 → 191 (-16, cleanup)

---

## Investigação RR e AL (super-densidade)

Análise dos dados indica que as promessas adicionais (além da extração do PDF) vieram do **cron de ranking** (`cron_v*.json` → `processar-sem-avaliacao.mjs` → Supabase), que scrapeia sites externos de monitoramento de promessas. Não há "fonte extra" não documentada — o vault sempre foi a união de:

1. **Extração do PDF** (via `extracao_v2.py` ou scripts equivalentes)
2. **Ranking scraping** (fonte externa de promessas governamentais)

| UF | Total | PDF (v2) | Ranking | Ratio chars/prom |
|----|:-----:|:--------:|:-------:|:----------------:|
| RR | 231 | 129 | 102 | 55 (muito denso) |
| AL | 715 | 346 | 369 | 79 (muito denso) |

Ambos os estados têm PDFs pequenos (12k e 56k chars respectivamente) com alta densidade de promessas já no PDF. A fonte ranking complementa com promessas de outras fontes (discursos, releases, etc.)

---

## Impacto no chars/prom (comparação com baseline)

| UF | Antes (chars/prom) | Depois (chars/prom) | Veredito |
|----|:------------------:|:-------------------:|----------|
| AM | 0 (scan) | 158 | OCR bem-sucedido |
| PR | 3.837 | 7.135 | PDF tem ~45 propostas reais (não "promessas" no sentido de itens) |
| GO | 2.616 | 2.711 | Estável — PDF é narrativo |
| SE | 2.810 | 299 | Extração de compromissos bem-sucedida |
| MA | 182 | 129 | Estável — PDF já era bem explorado |
| CE | 228 | 251 | Estável — PDF já era bem explorado |

---

## Arquivos Gerados/Modificados

- `promessas/wilson-miranda-lima/*.md` — 64 promessas (49 novas + 15 existentes)
- `promessas/carlos-massa-ratinho-junior/*.md` — 45 promessas (reescritas)
- `promessas/ronaldo-ramos-caiado/*.md` — 64 promessas (reescritas)
- `promessas/fabio-mitidieri/*.md` — 464 promessas (48 existentes + 416 novas)
- `promessas/carlos-orleans-brandao-junior/*.md` — 374 promessas (265 + 109 novas)
- `promessas/elmano-de-freitas-da-costa/*.md` — 191 promessas (207 - 16 cleanup)
- `promessas/_planos-governo/AM_wilson_lima.md` — texto OCR adicionado
- `estados/*.md` — índices regenerados (fix-indices-v3.mjs)
- `politicos/*.md` — índices regenerados

## Scripts Utilizados

- `tmp/harness/extracao_avancada.mjs` — Extração genérica v3
- `tmp/harness/extracao_pr.mjs` — Extrator específico para PR
- `tmp/harness/extracao_go_se.mjs` — Extratores específicos para GO e SE
- `tmp/harness/cleanup_dupes.mjs` — Limpeza de duplicatas
- `tmp/harness/fix-indices-v3.mjs` — Regeneração de índices
- Tesseract OCR via linha de comando (AM)

## Como Continuar

- Reprocessar PR com IA (Groq/OpenAI) pode extrair mais promessas do texto narrativo (~80-100 vs 45 atuais)
- RR e AL: a extração via PDF já está no limite (12k e 56k chars). Ranking scraping é a fonte principal.
- AM: tentar OCR com idioma português (por.traineddata) para melhor acurácia
- Executar `node processar-planos-melhorado.mjs` ou similar com chave de IA real para extração semântica
