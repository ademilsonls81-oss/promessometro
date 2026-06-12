# Resume Pipeline — Extracao de Promessas de Planos de Governo

## Status Atual (2026-06-09)

| Item | Status |
|------|--------|
| PDFs extraidos com pdfplumber | ✅ 26/26 |
| Extracao v1 (heuristica basica, 5713 promessas) | ✅ Substituida pela v2 |
| **Extracao v2 (heuristica melhorada, 5250 promessas)** | **✅ Atual** |
| Amazonas (AM) - PDF escaneado | ❌ Sem texto extraivel |
| Log de execucao | ✅ `execucoes/2026-06-09-extracao-v2.md` |
| Checkpoint | ✅ `tmp/harness/checkpoint_v2.json` |

## Melhorias v2 vs v1

| Problema | v1 (antes) | v2 (depois) | Metodo |
|----------|-----------|-------------|--------|
| Palavras quebradas por hifen no PDF | BA: 36% truncados | BA: <1% truncados | Rejuncao de hifens |
| Secao ALL CAPS como promessa | MA: 55.7% falsos | MA: 11.7% | Filtro ALL CAPS sem verbo |
| Titulo truncado (ex: "Ampliar a") | RS: 35.1% | RS: 14% | Filtro de truncados |
| Secao de indice (ex: "4. Desenvolvimento") | DF: muitos removidos | DF: 16.2% (maioria legitimos) | Filtro de secoes |
| Slogans/vago (ex: "Foco no cidadao") | Geral | Removidos | Padroes de meta-texto |
| **Total de promessas** | **5.713** | **5.250** | Filtragem de -463 falsos |

## Qualidade restante

A v2 ainda tem ~15-20% de itens de qualidade duvidosa, principalmente:
1. **Layout colunar**: PDFs com 2 colunas (AC, GO) geram texto embaralhado
2. **Secao + conteudo grudados**: "CULTURA E ECONOMIA CRIATIVA Pernambuco e um lugar..."
3. **Conteudo de paragrafo capturado**: Frases longas de paragrafos narrativos

## Pipeline Completo

```
storage/*.pdf
    │
    ▼ (passo 1 - ja feito)
promessas/_planos-governo/UF_nome.md   ← texto completo via pdfplumber
    │
    ▼ (passo 2 - feito, v2)
promessas/[governador]/*.md   ← promessas individuais (5250)
    │
    ▼ (passo 3 - pendente - MELHOR QUALIDADE)
Revisao com IA (GROQ ou similar)
    │
    ▼ (passo 4)
Atualizacao de status via avaliacao IA
```

## Como Continuar

### Opcao A: Reprocessar com extracao v2 (sem IA)
```bash
python tmp/harness/extracao_v2.py
```
Usa checkpoint_v2.json. Para reprocessar um estado, remova-o do checkpoint.

### Opcao B: Extrair com IA (GROQ) - MELHOR QUALIDADE
1. Consiga uma GROQ_API_KEY valida em https://console.groq.com
2. Atualize `.env`:
   ```
   GROQ_API_KEY=gsk_sua_chave_aqui
   ```
3. Execute:
   ```bash
   node processar_planos.mjs
   ```
   (insere no Supabase, nao em arquivos locais)

### Opcao C: Amazonas (AM) OCR
PDF escaneado (`AM_wilson_lima.pdf`), sem texto extraivel.
1. Instalar Tesseract: `winget install Tesseract-OCR`
2. `pip install pytesseract`
3. Rodar OCR manualmente

## Arquivos Importantes

| Arquivo | Para que serve |
|---------|---------------|
| `tmp/harness/checkpoint_v2.json` | Checkpoint v2 do que foi processado |
| `tmp/harness/extracao_v2.py` | Extracao v2 com filtros de qualidade |
| `execucoes/2026-06-09-extracao-v2.md` | Log detalhado da execucao v2 |
| `promessas/_planos-governo/UF_nome.md` | Texto completo de cada PDF |
| `promessas/[governador]/*.md` | Promessas individuais (5250) |
| `processar_planos.mjs` | Script oficial (requer GROQ_API_KEY) |

## Dicas

- As 1922 promessas originais (do Supabase) sao curadas e de melhor qualidade
- As 3328 novas (v2 dos PDFs) tem qualidade variavel
- O ideal e revisar com IA (GROQ) quando tiver chave valida
- A v2 ja removeu ~460 falsos positivos em relacao a v1
