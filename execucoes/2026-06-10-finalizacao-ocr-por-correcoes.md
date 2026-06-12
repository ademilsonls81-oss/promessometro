---
titulo: "Finalização — OCR AM português + correções vault + sync Supabase"
data: "2026-06-10"
tipo: "execucao"
status: "concluido"
---

# Execução: OCR AM português + correções vault + sync Supabase

## Passo 1 — OCR do AM com português

- Download do `por.traineddata` via jsDelivr CDN (1.98 MB, tessdata_fast)
- Reprocessado PDF `AM_wilson_lima.pdf` (6 páginas, 475 KB) com Tesseract `-l por`
- Texto extraído: **10.910 chars** (vs 6.038 com OCR inglês)
- Extração de promessas via `extracao_avancada.mjs`: **+35 novas** (total AM: 64 → 99)
- Sincronizado no Supabase: 34 novas inseridas (1 duplicata)

## Passo 2 — Corrigir 26 planos-governo sem campo estado

- 26 arquivos em `promessas/_planos-governo/` com prefixo `UF_slug.md` não tinham `estado:` no frontmatter
- Adicionado via `fix_planos_estado.mjs` usando mapeamento UF → nome completo do estado
- Ex: `AM_wilson_lima.md` → `estado: "Amazonas"`

## Passo 3 — Normalizar acentos em nomes de políticos

- Verificação byte-a-byte: todos os 35 arquivos `politicos/*.md` já possuem UTF-8 correto com acentos
- Filenames e campo `nome`:
  - `Cláudio Castro` ❨C3 A1❩ = á ✓
  - `Fábio Mitidieri` ❨C3 A1❩ ✓
  - `Jerônimo Rodrigues` ❨C3 B4❩ = ô ✓ (etc.)
- Display corrompido no PowerShell é limitação de terminal (cp1252), não de dados
- `Paulo Suruagy do Amaral Dantas.md`: `total_promessas` ajustado de 36 → 0 (sem promessas locais ou no Supabase por este slug)

## Passo 4 — Atualizar CONTEXTO.md

- Total geral: 5.411 → **6.085** promessas
- Tabela de políticos e estados atualizada com contagens corretas (índice v3)
- Novas entradas: Mauro Mendes (145), Mato Grosso (145)
- Estados corrigidos: Amazonas 15→99, Sergipe 48→464, Maranhão 265→374, etc.

## Passo 0 (imprevisto) — Sync Supabase de SE e PR

- Sync falhou anteriormente por estado usar nome completo vs UF code
- Adicionado mapeamento `UF_MAP` em `sync_supabase.mjs`
- Fábio Mitidieri (SE): +464 promessas inseridas
- Carlos Massa Ratinho Junior (PR): +45 promessas inseridas
- Total acumulado Supabase: **+1.114 novas** nas últimas execuções

## Resultado final

| Métrica | Antes | Depois |
|---------|-------|--------|
| Total vault | ~5.449 | **6.085** |
| Total Supabase | ~2.509 | ~3.052 (promessas sync) |
| AM promessas | 64 | **99** |
| AM OCR chars | 6.038 (eng) | **10.910 (por)** |
| Planos sem estado | 26 | **0** |
| Políticos | 34 | **35** |
| Acentos corrompidos | 0 (display only) | **0** |
