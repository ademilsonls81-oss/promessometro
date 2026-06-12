---
data: "2026-06-07"
horario: "início da sessão"
duracao: "contínuo (sessão interativa)"
promessas_verificadas: 9
promessas_atualizadas: 0
---

# Log de Execução — 2026-06-07 Leitura Inicial

## 🕐 Metadados

| Campo | Valor |
|-------|-------|
| **Data** | 2026-06-07 |
| **Horário Início** | Início da sessão |
| **Duração** | Contínuo (sessão interativa) |
| **Promessas Verificadas** | 9 (seed) |
| **Promessas Atualizadas** | 0 |

---

## 📋 Resumo

Leitura inicial completa do projeto **Promessômetro** para mapeamento de todas as promessas políticas cadastradas no código-fonte. Foram analisados arquivos SQL, scripts de seed, arquivos de processamento, templates, diretório `storage/` (PDFs de planos de governo), código-fonte em `src/` e `api/`, e arquivos de configuração.

### O que foi feito:
1. **Leitura da estrutura completa** do projeto (107+ entries na raiz)
2. **Análise de arquivos SQL** com 9 promessas seed para 5 políticos
3. **Leitura de scripts de processamento** (`processamento_status.json`) — 5 governadores processados por IA com 307 promessas extraídas de PDFs
4. **Leitura da metodologia 3 Camadas** (C1 Promessas 40%, C2 Indicadores 35%, C3 Fatos Jurídicos 25%)
5. **Análise completa de Cláudio Castro** (RJ) — 9 indicadores C2 e 4 fatos C3
6. **Inventário de storage/** — 21 PDFs de planos de governo estaduais não processados
7. **Criação de 9 arquivos individuais** em `promessas/` para as promessas seed

---

## 📊 Tabela de Promessas Verificadas

| Promessa | Status | Categoria | Score | Fonte |
|----------|--------|-----------|-------|-------|
| [[promessas/lula-zerar-fome]] | 🔵 em andamento | Saúde | 65 | seed SQL |
| [[promessas/lula-6m-empregos]] | 🟢 cumprida | Trabalho | 100 | seed SQL |
| [[promessas/lula-reconhecer-venezuela]] | 🔴 quebrada | Relações Exteriores | 0 | seed SQL |
| [[promessas/bolsonaro-100-anos-petroleo]] | 🟡 pendente | Economia | 10 | seed SQL |
| [[promessas/bolsonaro-armas]] | 🔴 quebrada | Segurança | 15 | seed SQL |
| [[promessas/bolsonaro-imposto-unico]] | ⚪ não classificada | Economia | 0 | seed SQL |
| [[promessas/tarcisio-metro-linha2]] | 🔵 em andamento | Transporte | 50 | seed SQL |
| [[promessas/zema-mil-escolas]] | 🟡 pendente | Educação | 5 | seed SQL |
| [[promessas/claudia-lei-seguranca-rj]] | 🟡 pendente | Segurança | 45 | seed SQL |

---

## 🧠 Decisões Tomadas

- **Status mapping**: Os 9 status diferentes encontrados no banco (cumprida, parcialmente_cumprida, em_andamento, nao_iniciada, descumprida, nao_classificada, parcial, pendente, quebrada) foram normalizados para os 4 valores do frontend no CONTEXTO.md.
- **Inconsistência detectada**: O tipo `PoliticalPromise.status` no TypeScript usa `'fulfilled' | 'partial' | 'broken' | 'pending'` (inglês), enquanto o banco usa português. Criado mapeamento no CONTEXTO.md.
- **Promessas do banco vs arquivos**: 330+ promessas estão no Supabase (extraídas por IA de PDFs de planos de governo), mas não há dump local. Os arquivos criados cobrem apenas as 9 promessas seed do SQL + o template de exemplo existente.

---

## ⚠️ Problemas Encontrados

1. **Dados de 330+ promessas apenas no Supabase** — sem dump local. Os 9 arquivos criados representam ~3% do total de promessas no banco.
2. **Inconsistência de nomes**: "Cláudia Lei" (seed) vs "Cláudio Castro" (governador real do RJ, PL). Possível erro ou político diferente.
3. **Status heterogêneo**: O banco usa 6 valores de status, o frontend normaliza para 4, e o TypeScript usa nomes em inglês — sem validação cruzada.
4. **21 PDFs de planos de governo** em `storage/` aguardam processamento (promessas ainda não extraídas).
5. **Link_promessa quebrado**: Algumas URLs seed são apenas nomes de arquivo (`https://plano2022 Lula.pdf`) em vez de URLs reais.

---

## 🚀 Próximos Passos

1. Exportar dump do Supabase para `db_out.json` (ou SQL) com todas as promessas
2. Criar arquivos individuais em `promessas/` para as 307+ promessas extraídas por IA
3. Processar os 21 PDFs restantes em `storage/` via `processar_planos.mjs`
4. Validar a consistência dos dados de Cláudia Lei vs Cláudio Castro
5. Implementar validação de status cross-reference (TS ↔ SQL ↔ normalizado)
