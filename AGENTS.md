# HANDSOFF PROMESSÔMETRO BRASIL v2.0

## Status Geral
- **Banco**: ✅ Operacional (~242 promessas, antes 41)
- **Frontend**: ✅ Deployado (https://promessometro-brasil.vercel.app)
- **Cron**: ✅ Implementado e em produção
- **Auditoria**: ✅ Concluída
- **Descoberta**: ✅ `/api/discover-promises` + `/api/import-promises`

---

## Stack
- **Frontend**: React + Vite + TypeScript (SPA)
- **Backend**: Express/Node (server.ts) + Vercel Serverless Functions
- **Banco**: Supabase (PostgreSQL)
- **IA**: Groq (llama-3.3-70b-versatile) + Serper.dev (evidências)
- **Deploy**: Vercel (Frontend + API routes)

---

## Status de Promessa (banco de dados) — NORMALIZADOS
Os status no banco agora usam apenas 4 valores normalizados:

| Status DB | Label | Score Range |
|-----------|-------|-------------|
| `cumprida` | Cumprida | 80-100 |
| `parcial` | Parcialmente Cumprida | 40-79 |
| `pendente` | Pendente | 0-39 |
| `quebrada` | Descumprida | 0 |

**Mapeamento reverso** (para compatibilidade com dados legados):
- `parcialmente_cumprida`, `em_andamento` → `parcial`
- `nao_iniciada`, `nao_classificada`, `pendente` → `pendente`
- `descumprida` → `quebrada`
- `cumprida` → `cumprida`

---

## Avaliações (promise_explanations) — FONTE ÚNICA DA VERDADE
A tabela `promise_explanations` com `is_latest=true` é a fonte única para:
- Score e status exibidos no ranking
- Score e status exibidos no detalhe da promessa
- Evidências (evidencias_usadas)
- Justificativa e nível de confiança

**Regra**: Ranking e Detalhe NUNCA devem calcular stats próprios.
Sempre consultar `promise_explanations` via endpoint unificado `/api/evaluate/:promiseId`.

---

## Auditoria e Correções (Maio 2026)
Resultado da auditoria completa:
- **35 promessas sem avaliação** → Criado endpoint `/api/batch-evaluate` para popular
- **6 status divergentes** entre evaluation e promise → Corrigido via SQL
- **0 evidências inválidas** (todas com descrição, URL e fonte)
- **Colunas do banco padronizadas** (name, role, state, party)

### Novos endpoints
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/evaluate/:promiseId` | Avaliação unificada da promessa |
| POST | `/api/batch-evaluate` | Popular avaliações em lote |
| POST | `/api/seed-evaluations` | Seed básico de avaliações |
| GET/POST | `/api/photos/backfill` | Preencher fotos faltantes de políticos via Wikipedia |

### Descoberta de Promessas (Maio 2026)
O sistema agora tem pipeline de descoberta automática de promessas via Serper.dev + Groq:

| Endpoint | Método | Descrição |
|---|---|---|
| `GET/POST /api/discover-promises?politician=NOME&dryrun=true` | GET/POST | Busca artigos + extrai promessas via Groq (se `dryrun=true`, não insere) |
| `POST /api/import-promises` | POST | Importa JSON de promessas para um político |

**Como funciona a descoberta:**
1. Serper.dev busca 4 queries por político (plano de governo + promessas + propostas)
2. Groq (llama-3.1-8b-instant) extrai promessas específicas dos snippets
3. Insere no banco com status `pendente` e score 50
4. Dedup futuro: comparação fuzzy por título (desabilitado temporariamente)

**Notas:**
- Groq free tier: rate limit ~30 req/min por modelo
- Categorias normalizadas para 10 valores: Saude, Educacao, Seguranca, Economia, Infraestrutura, Meio_Ambiente, Trabalho, Habitacao, Transporte, Outros
- Usa `dbAdmin()` (service_role key) para inserts (RLS policy bloqueia anon key)
- Colunas disponíveis em `promises`: `id, politician_id, politician_name, promise_title, category, status, fulfillment_score, party, created_at, updated_at`

### Como testar a consistência
```bash
# Verificar avaliação de uma promessa
curl https://promessometro-brasil.vercel.app/api/evaluate/PROMISE_ID

# Popular avaliações faltantes
curl -X POST https://promessometro-brasil.vercel.app/api/batch-evaluate

# Verificar ranking (agora usa promise_explanations)
curl https://promessometro-brasil.vercel.app/api/politicians/ranking
```

---

## Arquivos críticos

### Cron (Vercel Serverless)
- `api/cron/daily-reavaliation.js` — Reavalia promessas automaticamente
- Horário: `0 6 * * *` (6AM UTC / 9AM BRT)
- Funcionalidades:
  - Score clamping por status (STATUS_CONFIG)
  - Inserção obrigatória em `status_history` + `promise_explanations`
  - `audit_logs` em toda mudança
  - `cron_executions` para rastrear lotes
  - Alert Slack se 2 execuções consecutivas com 0 promessas

### Rewrites (vercel.json)
- `/api/cron/daily-reavaliation` → `api/cron/daily-reavaliation.js`
- `/api/cron/update-stats` → `api/cron/update-stats.js`
- `/api/cron/backup-export` → `api/cron/backup-export.js`
- `/api/cron/process-evidences` → `api/cron/process-evidences.js`
- `/api/cron/politician-ranking` → `api/cron/politician-ranking.js`
- `/api/sitemap` → `api/sitemap.js`
- `/api/(.*)` → `/api/index.js` (todas as demais)

### Frontend (src/pages)
- `Ranking.tsx` — Ranking de políticos (classification: fulfilled/partial/broken/pending)
- `PoliticianProfile.tsx` — Perfil de político + lista de promessas
- `PromiseDetail.tsx` — Detalhe de promessa (com badge 🤖 AI)
- `PublicFeed.tsx` — Feed público de promessas
- `Admin.tsx` — Dashboard admin com estatísticas

### Labels de status (todos consistentes)
| Chave | Label |
|---|---|
| `cumprida` | Cumprida |
| `parcialmente_cumprida` | Parcialmente Cumprida |
| `em_andamento` | Em Andamento |
| `nao_iniciada` | Pendente |
| `nao_classificada` | Pendente |
| `pendente` | Pendente |
| `descumprida` | Descumprida |

---

## Variáveis de ambiente (Vercel)
```
VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY
OPENAI_API_KEY (fallback)
OPENAI_BASE_URL = https://api.groq.com/openai/v1
TAVILY_API_KEY (opcional)
SERPER_API_KEY (recomendado)
CRON_SECRET (opcional em produção)
SLACK_WEBHOOK_URL (opcional)
NODE_ENV
```

---

## Checklist de smoke test
```bash
# Testar cron manualmente
curl -s https://promessometro-brasil.vercel.app/api/cron/daily-reavaliation | jq .

# Verificar se status_history foi populado
curl "https://liqutcjzzrqstivvfele.supabase.co/rest/v1/status_history?order=created_at.desc&limit=5" \
  -H "apikey: ...ANON_KEY..." -H "Authorization: Bearer ..."

# Verificar se promise_explanations foi populado
curl "https://liqutcjzzrqstivvfele.supabase.co/rest/v1/promise_explanations?order=gerado_em.desc&limit=5" \
  -H "apikey: ...ANON_KEY..." -H "Authorization: Bearer ..."

# Verificar cron_executions
curl "https://liqutcjzzrqstivvfele.supabase.co/rest/v1/cron_executions?order=created_at.desc&limit=5" \
  -H "apikey: ...ANON_KEY..." -H "Authorization: Bearer ..."
```

---

## Fotos de Políticos
- **Coluna `photo_url`** na tabela `politicians` (TEXT)
- **Ranking.tsx** e **PoliticianProfile.tsx** já exibem foto com fallback para iniciais
- **PublicFeed.tsx** exibe foto circular ao lado do nome do político (fallback: iniciais)
- **PromiseDetail.tsx** exibe foto circular ao lado do nome do político (fallback: iniciais)

### Como funciona para novos candidatos
- Ao submeter promessa via `/api/promises/submit`, o `ensurePolitician()` cria/atualiza o político e busca foto via Wikipedia automaticamente
- Endpoint `/api/photos/backfill` preenche fotos de políticos que ainda não têm

### População manual
```bash
# Preencher fotos de até 50 políticos sem foto
curl -X POST https://promessometro-brasil.vercel.app/api/photos/backfill
```

---

## Colunas do banco (promises)
```sql
-- Essenciais para o cron
status                 TEXT       -- status atual
fulfillment_score      INTEGER    -- score 0-100
last_verified_at       TIMESTAMPTZ -- última reavaliação
ai_evaluation          TEXT       -- justificativa da IA
evidences_used         JSONB      -- array de evidências
needs_human_review     BOOLEAN    -- requer revisão humana
```

---

## Fluxo Cron
1. Busca promessas stale (23h) + nunca verificadas + cumpridas/descumpridas (7d)
2. Para cada promessa:
   a. Busca evidências via Tavily
   b. Envia prompt para Groq
   c. Clamp score no range do status
   d. Mapeia `nao_iniciada`→`pendente`
   e. Atualiza `promises`
   f. Insere em `status_history` (sempre)
   g. Insere em `promise_explanations` (sempre)
   h. Insere em `audit_logs` (sempre)
   i. Insere em `cron_executions`
3. Alerta Slack se 2 execuções consecutivas com 0 promessas

---

---

## Metodologia 3 Camadas (Maio 2026)

### Migração do Banco (17/05/2026)
**Status**: ✅ Completa

#### Novas tabelas (4)
| Tabela | Descrição |
|--------|-----------|
| `mandates` | Mandatos políticos (mandato fechado, linked a politician) |
| `indicators` | Indicadores objetivos — Camada 2 (segurança, finanças, funcionalismo) |
| `legal_facts` | Fatos jurídicos — Camada 3 (condenações, investigações, etc) |
| `methodology` | Documento de metodologia versionado (JSONB) |

#### Novas colunas em `promises`
`mandate_id UUID`, `is_primary_source BOOLEAN`, `verification_sources JSONB`, `government_response TEXT`, `contestation_sent_at TIMESTAMPTZ`, `contestation_response TEXT`, `fulfillment_percentage INTEGER`, `verification_notes TEXT`

#### Novas colunas em `politicians`
`c1_score DECIMAL`, `c2_score DECIMAL`, `c3_score DECIMAL`, `final_score DECIMAL`, `grade TEXT`, `methodology_version TEXT`, `last_evaluated_at TIMESTAMPTZ`

#### Índices (5)
`idx_promises_mandate`, `idx_promises_is_primary`, `idx_indicators_politician`, `idx_legal_facts_politician`, `idx_mandates_politician`

### Executando DDL via exec_sql
A função `exec_sql` usa `EXECUTE sql INTO result` — DDL puro falha com "INTO used with a command that cannot return data".
**Workaround**: Sempre anexar `; SELECT 1;` no final do DDL:
```sql
CREATE TABLE IF NOT EXISTS x (id int); SELECT 1;
```
**Schema cache**: Após criar tabelas via exec_sql, PostgREST não descobre automaticamente. Executar:
```sql
NOTIFY pgrst, 'reload schema'
```
Via exec_sql para forçar refresh (funciona comprovadamente).

### Estrutura Metodológica
```
Nota Final = (C1 × 0.40) + (C2 × 0.35) + (C3 × 0.25)
Grade: A(80-100) B(60-79) C(40-59) D(20-39) F(0-19)
```

**Camada 1** (Promessas, 40%):
- C1 = (cumpridas×1.0 + parciais×0.5) / total × 100
- Status: cumprida/parcial/pendente/quebrada

**Camada 2** (Indicadores, 35%):
- C2 = Σ(indicador_score × peso) / Σ(pesos)
- Categorias: seguranca (30%), financas (40%), funcionalismo (30%)

**Camada 3** (Fatos Jurídicos, 25%):
- C3 começa em 100, deduz penalidades
- Condenação transitada: -50, Investigação formal: -20, Alerta: -10, Irregularidade: -5
- Se C3 < 20 → grade máxima = C independente das demais camadas

### Prioridade Atual
Cláudio Castro **primeiro** (implementação completa end-to-end), depois replicar.

### Endpoints implementados
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/metodologia` | Documento de metodologia versionado (current) |
| GET | `/api/politician/:slug` | Perfil completo + C1/C2/C3 + grade + mandates/indicators/legal_facts |

O endpoint `/api/politician/:slug` agora calcula e salva automaticamente:
- C1 = promessas (cumpridas/parciais/pendentes/quebradas)
- C2 = indicadores objetivos (por categoria)
- C3 = fatos jurídicos (deduções)
- Grade final (A-F)

### Status atual do Castro
| Camada | Score | Peso |
|--------|-------|------|
| C1 Promessas | 15.4 | 40% |
| C2 Indicadores | 0 (vazio) | 35% |
| C3 Fatos Jurídicos | 100 (vazio) | 25% |
| **Final** | **31.2** | **Grade D** |

### Arquivos de migração
- `sql/migration-2026-05-17-metodologia.sql` — DDL puro
- `run-migration.mjs` — Runner que executa cada statement com `; SELECT 1`
- `verify-migration.mjs` — Verificação pós-migração

### Commits recentes (main)
```
ac7735b fix: improve cron with score clamping, promise_explanations populating, status_history mandatory, cutoff logic, audit logging
bb01ae7 fix: todas inconsistências de status - em_andamento=pending, nao_classificada=Pendente, StatusBadge, og, middleware
2dfd7ea fix: padronizar labels de status para nomes exatos do banco
62897fe fix: padronizar status conforme banco - em_andamento=pending, nao_iniciada agrupada, Metodologia label
c392b46 fix: remove duplicate declarations in SEO.tsx
```