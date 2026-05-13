# HANDSOFF PROMESSÔMETRO BRASIL v2.0

## Status Geral
- **Banco**: ✅ Operacional
- **Frontend**: ✅ Deployado (https://promessometro-brasil.vercel.app)
- **Cron**: ✅ Implementado e em produção
- **Validação**: ⏳ Aguardando smoke tests

---

## Stack
- **Frontend**: React + Vite + TypeScript (SPA)
- **Backend**: Express/Node (server.ts) + Vercel Serverless Functions
- **Banco**: Supabase (PostgreSQL)
- **IA**: Groq (llama-3.3-70b-versatile) + Tavily (evidências)
- **Deploy**: Vercel (Frontend + API routes)

---

## Status de Promessa (banco de dados)
```
cumprida              → Cumprida        (score 80-100)
parcialmente_cumprida → Parcialmente Cumprida (score 40-79)
em_andamento          → Em Andamento   (score 20-39)
nao_iniciada          → Pendente       (score 0-19)
nao_classificada      → Pendente       (score 0-100)
pendente              → Pendente       (score 0-19)
descumprida           → Descumprida    (score 0)
```

**Regra**: `nao_iniciada` e `nao_classificada` são salvos no banco como `pendente` pelo cron.

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

## Commits recentes (main)
```
ac7735b fix: improve cron with score clamping, promise_explanations populating, status_history mandatory, cutoff logic, audit logging
bb01ae7 fix: todas inconsistências de status - em_andamento=pending, nao_classificada=Pendente, StatusBadge, og, middleware
2dfd7ea fix: padronizar labels de status para nomes exatos do banco
62897fe fix: padronizar status conforme banco - em_andamento=pending, nao_iniciada agrupada, Metodologia label
c392b46 fix: remove duplicate declarations in SEO.tsx
```