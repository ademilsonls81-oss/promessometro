---
data: "2026-06-07"
horario: "sessão completa"
duracao: "~2h"
promessas_verificadas: 1927
promessas_atualizadas: 0
---

# Log de Execução — 2026-06-07 Exportação Supabase → Obsidian

## 🕐 Metadados

| Campo | Valor |
|-------|-------|
| **Data** | 2026-06-07 |
| **Horário Início** | Após leitura inicial |
| **Duração** | ~2 horas |
| **Promessas Exportadas** | 1.927 (do Supabase) |
| **Arquivos .md Criados** | 1.923 + 26 placeholders de planos de governo |
| **PDFs Extraídos** | 26 (texto bruto) |

---

## 📋 Resumo

Exportação completa de todas as promessas do banco Supabase para o Obsidian, seguindo o workflow estabelecido no AGENTS.md e templates do projeto.

### O que foi feito:

1. **Conexão ao Supabase** via REST API com service_role key
2. **Exportação de 1.927 promessas** e **35 políticos** da tabela `promises` e `politicians`
3. **Criação de 1.923 arquivos .md** em `promessas/` organizados em **37 subpastas** por político
4. **Template aplicado**: cada arquivo segue `templates/promessa.md` com frontmatter YAML e corpo markdown
5. **Correção de status**: script de pós-processamento ajustou `**Status Atual** | 🟡 pendente` para o status real em todos os arquivos
6. **Extração textual de 26 PDFs** de planos de governo estaduais (`storage/`) usando `pdf-parse`
7. **Atualização de `CONTEXTO.md`** com inventário completo
8. **Dados exportados** salvos em `tmp/harness/` como JSON para referência futura

---

## 📊 Tabela de Promessas Exportadas (Top 10)

| # | Político | Estado | Partido | Qtd Promessas |
|---|----------|--------|---------|--------------|
| 1 | PAULO DANTAS | AL | MDB | 334 |
| 2 | GLADSON DE LIMA CAMELI | AC | PP | 151 |
| 3 | Fátima Bezerra | RN | PT | 142 |
| 4 | Tarcísio de Freitas | SP | Republicanos | 141 |
| 5 | Wanderlei Barbosa | TO | Republicanos | 113 |
| 6 | IBANEIS ROCHA BARROS JÚNIOR | DF | MDB | 107 |
| 7 | Antonio Denarium | RR | PP | 102 |
| 8 | Jerônimo Rodrigues | BA | PT | 74 |
| 9 | CARLOS ORLEANS BRANDÃO JÚNIOR | MA | PSB | 55 |
| 10 | RAFAEL TAJRA FONTELES | PI | PSD | 50 |

### Planos de Governo Extraídos (26 PDFs)

| UF | Estado | Político | Páginas | Caracteres |
|----|--------|----------|---------|------------|
| PR | Paraná | Carlos Massa Ratinho Junior | 114 | 376.985 |
| BA | Bahia | Jerônimo Rodrigues | 124 | 217.468 |
| ES | Espírito Santo | Renato Casagrande | 150 | 212.020 |
| GO | Goiás | Ronaldo Caiado | 75 | 183.591 |
| SE | Sergipe | Fábio Mitidieri | 112 | 148.624 |
| ... | (26 no total) | | | |

---

## 🧠 Decisões Tomadas

- **Status mapping**: arquivos usam o mapeamento: `cumprida`→🟢, `parcial`/`em_andamento`→🔵, `pendente`→🟡, `quebrada`→🔴, `nao_iniciada`/`nao_classificada`→⚪
- **Subpastas**: cada político tem sua própria subpasta em `promessas/` para evitar poluição da raiz com 1.900+ arquivos
- **Duplicatas**: 4 arquivos não foram sobrescritos (seed Lula + Bolsonaro + Tarcísio + Zema já existiam)
- **PDFs**: apenas texto bruto extraído sem classificação IA. Placeholders criados em `promessas/_planos-governo/`
- **Nomes duplicados**: alguns políticos aparecem com nomes diferentes no banco (ex: "PAULO DANTAS" e "PAULO SURUAGY DO AMARAL DANTAS") — mantidos como pastas separadas

---

## ⚠️ Problemas Encontrados

1. **GROQ_API_KEY ausente**: `.env` tem `YOUR_GROQ_API_KEY` — impossível executar `processar_planos.mjs` para extração IA de promessas dos PDFs
2. **Status hardcoded no template**: o template `templates/promessa.md` tem `🟡 pendente` fixo em 2 lugares — requer `replaceAll` para corrigir todos
3. **Nomes inconsistentes**: "Fátima Bezerra" vs uppercase "PAULO DANTAS" — o banco não normaliza nomes de políticos
4. **Duplicatas de político**: Romeu Zema e ROMEU ZEMA como entradas diferentes no banco
5. **PDF escaneado**: `AM_wilson_lima.pdf` extraiu apenas 12 caracteres (provavelmente imagem escaneada sem OCR)
6. **Acentos nos nomes**: alguns nomes de PDFs perderam acentos na conversão (clcio, jernimo, fbio)

---

## 🚀 Próximos Passos

1. Configurar GROQ_API_KEY e rodar `node processar_planos.mjs` para extração IA das promessas dos 26 planos de governo
2. Fazer OCR do PDF do Amazonas (AM) se necessário
3. Normalizar nomes de políticos no banco (dedup ROMEU ZEMA, PAULO DANTAS, WANDERLEI BARBOSA)
4. Avaliar veracidade das 1.927 promessas exportadas
5. Revisar merge dos seed files raiz com os das subpastas

---

## Scripts Utilizados

| Script | Finalidade |
|--------|-----------|
| `export_promises.mjs` | Conectar ao Supabase, exportar promessas, criar arquivos .md |
| `fix_status.mjs` | Corrigir status hardcoded no body dos arquivos |
| `extract_pdfs.mjs` | Extrair texto bruto dos 26 PDFs de planos de governo |
| API REST Supabase `rest/v1/promises` + `rest/v1/politicians` | Fonte dos dados |
| `processar_planos.mjs` | Script existente (não executado — falta API key) |
