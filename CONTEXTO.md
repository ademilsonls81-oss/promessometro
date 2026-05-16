# CONTEXTO PROMESSÔMETRO BRASIL v2.0
# Data: 2026-05-16
# Status: Deployado em https://promessometro-brasil.vercel.app

---

## O QUE É O SISTEMA

Promessômetro é uma plataforma de transparência política que rastreia e avalia promessas
de políticos brasileiros usando IA (Groq/Llama) + busca de evidências (Serper).

### Stack
- **Frontend**: React + Vite + TypeScript (SPA)
- **Backend**: Vercel Serverless Functions (api/*.js)
- **Banco**: Supabase (PostgreSQL)
- **IA**: Groq (llama-3.3-70b-versatile)
- **Busca**: Serper.dev (Google Search API)
- **Deploy**: Vercel (Frontend + API + Crons)

---

## SUPABASE - SCHEMA DO BANCO

### Tabela: `politicians`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID único |
| name | text | Nome completo |
| party | text | Partido |
| state | text | Estado (UF ou BR) |
| role | text | Cargo (presidente, governador, prefeito) |
| city | text | Cidade (se prefeito) |
| photo_url | text | URL da foto |
| bio | text | Biografia |
| is_active | boolean | Se está no mandato |
| slug | text | Slug para URL |
| election_year | int | Ano da eleição |
| position | text | Cargo normalizado |
| source_doc_url | text | URL documento fonte |
| created_at | timestamptz | Criação |
| updated_at | timestamptz | Atualização |

### Tabela: `promises`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID único |
| politician_name | text | Nome do político |
| politician_id | uuid FK | ID do político |
| promise_title | text | Título da promessa |
| category | text | Categoria (Economia, Saúde, etc) |
| status | text | Status atual (cumprida, parcial, pendente, quebrada) |
| fulfillment_score | int | Score 0-100 |
| evidence | text | Evidência textual |
| source_link | text | Link fonte original |
| evidence_count | int | Contagem de evidências |
| last_verified_at | timestamptz | Última verificação |
| ai_evaluation | text | Justificativa da IA |
| evidences_used | jsonb | Array de evidências usadas |
| needs_human_review | boolean | Precisa revisão humana |
| is_automated | boolean | Avaliação automática |
| party | text | Partido |
| data_promessa | date | Data da promessa |
| created_at | timestamptz | Criação |
| updated_at | timestamptz | Atualização |

### Tabela: `promise_explanations` (FONTE ÚNICA DA VERDADE)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID único |
| promise_id | uuid FK | ID da promessa |
| status | text | Status avaliado |
| fulfillment_score | int | Score avaliado |
| criterio_aplicado | text | Critério usado |
| justificativa | text | Justificativa |
| evidencias_usadas | jsonb | Array de evidências |
| o_que_falta | text | O que falta |
| o_que_foi_feito | text | O que foi feito |
| confianca | numeric(0-1) | Nível de confiança |
| modelo_ia | text | Modelo usado |
| is_latest | boolean | É a versão mais recente |
| gerado_em | timestamptz | Data de geração |
| revisado_em | timestamptz | Data de revisão |
| revisado_por | text | Quem revisou |

### Tabela: `promise_evidences`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID único |
| promise_id | uuid FK | ID da promessa |
| title | text | Título da evidência |
| description | text | Descrição |
| url | text | URL da fonte |
| source_name | text | Nome da fonte |
| evidence_type | text | Tipo (news, official) |
| source_type | text | Tipo de fonte |
| validation_status | text | Status de validação |
| published_at | timestamptz | Data de publicação |
| confiabilidade | int | Score de confiabilidade |
| relevance_score | int | Score de relevância |
| credibility_score | int | Score de credibilidade |
| discovered_at | timestamptz | Data de descoberta |
| validated | boolean | Se foi validada |
| needs_review | boolean | Precisa revisão |

### Tabela: `cron_executions`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| execution_id | text PK | ID da execução |
| trigger | text | Gatilho (vercel_cron, autonomous_seed) |
| status | text | started/completed/failed |
| started_at | timestamptz | Início |
| completed_at | timestamptz | Fim |
| promises_evaluated | int | Promessas avaliadas |
| promises_failed | int | Falhas |
| details | jsonb | Detalhes da execução |

### Tabela: `daily_monitor_log`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID único |
| monitor_name | text | Nome do monitor |
| promises_processed | int | Promessas processadas |
| new_evidences_found | int | Novas evidências |
| errors | text | Erros JSON |
| started_at | timestamptz | Início |
| completed_at | timestamptz | Fim |

### Tabela: `status_history`
- Colunas conhecidas: `id`, `promise_id`, `previous_status`, `new_status`
- Colunas que NÃO existem: `previous_score`, `new_score`, `changed_by`, `evaluation_type`, `change_reason`

### Tabela: `audit_logs`
- Colunas conhecidas: `id`, `action`, `table_name`, `details`
- Colunas que NÃO existem: `record_id`, `old_value`, `new_value`, `performed_by`, `old_data`, `new_data`

### Tabela: `feeds`
- Usada pelo pipeline para descobrir domínios ativos
- Colunas: `url`, `active`, `category`

---

## STATUS NORMALIZADOS (4 VALORES)

| Status DB | Label | Score Range |
|-----------|-------|-------------|
| `cumprida` | Cumprida | 80-100 |
| `parcial` | Parcialmente Cumprida | 40-79 |
| `pendente` | Pendente | 0-39 |
| `quebrada` | Descumprida | 0 |

### Mapeamento Reverso
- `parcialmente_cumprida`, `em_andamento` → `parcial`
- `nao_iniciada`, `nao_classificada`, `pendente` → `pendente`
- `descumprida` → `quebrada`
- `cumprida` → `cumprida`

---

## ENDPOINTS API (api/index.js)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| GET | `/api/politicians/ranking` | Ranking de políticos |
| GET | `/api/politician/:slug` | Perfil de político + promessas |
| GET | `/api/promises` | Lista de promessas |
| POST | `/api/promises/submit` | Submeter nova promessa |
| GET | `/api/evaluate/:promiseId` | Avaliação unificada |
| GET/POST | `/api/batch-evaluate` | Seed de avaliações |
| GET | `/api/stats` | Estatísticas gerais |
| GET/POST | `/api/autonomous-seed` | Seed autônomo completo |

### Endpoints Cron (arquivos separados)
| Path | Arquivo | Descrição |
|------|---------|-----------|
| `/api/cron/pipeline-orchestrator` | `api/cron/pipeline-orchestrator.js` | Pipeline completo |
| `/api/cron/daily-reavaliation` | `api/cron/daily-reavaliation.js` | Reavaliação diária |
| `/api/cron/discover-evidences` | `api/cron/discover-evidences.js` | Descoberta de evidências |
| `/api/sitemap` | `api/sitemap.js` | Sitemap XML |

---

## O QUE FIZEMOS HOJE (2026-05-16)

### 1. Corrigimos endpoints faltantes
- Adicionado `/api/politician/:slug` para perfil de político
- Adicionado `/api/promises/submit` para submeter promessas
- Ranking e perfil estavam retornando "Endpoint nao encontrado"

### 2. Corrigimos sitemap 500
- `api/sitemap.js` usava `module.exports` (CommonJS) → convertido para `export default` (ESM)
- `createClient` no escopo do módulo causava crash → movido para função lazy `db()`
- Usava anon key com RLS → agora usa service role key
- Agora inclui URLs de políticos e promessas no XML

### 3. Criamos endpoint autônomo de seed
- `api/autonomous-seed.js` - popula TODAS as tabelas automaticamente
- Descobre evidências via Serper (10 por promessa)
- Avalia com Groq AI (llama-3.3-70b-versatile)
- Popula `promises`, `promise_evidences`, `promise_explanations`
- Processa em batches de 3 promessas para evitar timeout

### 4. Corrigimos nomes de colunas
- `promise_evidences`: usa `title`, `description`, `source_name` (NÃO `titulo`, `descricao`, `fonte`)
- `status_history`: colunas limitadas a `promise_id`, `previous_status`, `new_status`
- `audit_logs`: colunas limitadas a `action`, `table_name`, `details`
- `promise_explanations.confianca` é numeric(0-1), NÃO int

### 5. Populamos o banco completamente
- 41 promessas avaliadas
- ~350 evidências descobertas e inseridas
- 41 explicações em `promise_explanations`
- 12 políticos no ranking

### 6. Regra crítica descoberta
- `createClient` do Supabase NUNCA pode ser chamado no escopo do módulo
- Sempre usar função lazy `db()` que cria o client sob demanda
- Isso causa erro 500 no Vercel serverless durante cold starts

### 7. Correções aplicadas (segunda sessão - 16/05/2026 tarde)
- **Score clamping corrigido**: promessas "cumpridas" com score 0 agora recebem score 85
  - Criado script SQL `scripts/fix-score-clamping.sql` para corrigir dados existentes
  - Atualizado `api/index.js` batch-evaluate para clamped scores corretamente
- **Campo `fonte` vazio corrigido**: adicionada função `extractHostname(url)` para extrair hostname quando Serper não retorna `source`
  - Aplicado em `api/autonomous-seed.js`, `api/cron/daily-reavaliation.js`, `api/cron/pipeline-orchestrator.js`
- **Tratamento de erro da IA melhorado**: fallback agora retorna status/score original com score clamped e mensagem descritiva
  - Inclui motivo da falha (GROQ_API_KEY não configurada ou erro HTTP)
- **status_history e audit_logs agora são inseridos**: com schema correto (colunas existentes)
  - `status_history`: `promise_id`, `previous_status`, `new_status`
  - `audit_logs`: `action`, `table_name`, `details` (JSON)
- **Deduplicação de evidências**: verifica URLs existentes antes de inserir
  - Usa Set de URLs existentes + check no mesmo batch
- **pipeline-orchestrator.js corrigido**:
  - `createClient` movido para função lazy `db()`
  - Colunas de `promise_evidences` corrigidas (`title`, `description`, `source_name`)
  - `confianca` agora usa valores 0.5/0.85 (NÃO 50/85)
  - `status_history` e `audit_logs` com schema correto

---

## O QUE FALTA FAZER

### Urgente
1. **Rodar SQL migration** - Executar `scripts/fix-score-clamping.sql` no Supabase para corrigir scores existentes
2. **Verificar GROQ_API_KEY no Vercel** - Avaliações IA ainda podem estar falhando se a key não estiver configurada
3. **Deploy das correções** - Subir alterações para produção (autonomous-seed, daily-reavaliation, pipeline-orchestrator, index.js)

### Melhorias
4. **Pipeline cron não está rodando** - Vercel crons podem não estar configurados no plano free
   - Verificar se crons estão ativos no dashboard Vercel
   - Considerar alternativa: GitHub Actions ou endpoint manual
5. **Frontend precisa de refresh** - Algumas páginas podem cache antigo
   - Verificar se `/ranking` e `/promessas` renderizam corretamente
   - Verificar se badges de status usam labels corretos
6. **Página de detalhes da promessa** - Verificar se `/promessa/:slug` funciona
   - Frontend precisa de rota para detalhes individuais
   - Usar endpoint `/api/evaluate/:id`

### Longo Prazo
7. **Adicionar mais políticos** - Apenas 12 políticos no banco
8. **Melhorar prompt da IA** - Justificativas genéricas ("herdada do status")
9. **Adicionar fontes brasileiras** - Expandir lista de domínios confiáveis
10. **Cache de evidências** - Não buscar mesma promessa repetidamente
11. **Admin dashboard** - Página para gerenciar políticos e promessas
12. **Notificações** - Alertar quando promessa muda de status

---

## VARIÁVEIS DE AMBIENTE (VERCEL)

```
VITE_SUPABASE_URL = https://liqutcjzzrqstivvfele.supabase.co
SUPABASE_SERVICE_ROLE_KEY = (configurada)
SUPABASE_ANON_KEY = (configurada)
GROQ_API_KEY = (VERIFICAR - avaliações podem estar falhando)
OPENAI_BASE_URL = https://api.groq.com/openai/v1
SERPER_API_KEY = (configurada)
CRON_SECRET = (opcional)
SLACK_WEBHOOK_URL = (opcional)
NODE_ENV = production
```

---

## COMANDOS ÚTEIS

```bash
# Testar seed autônomo
curl https://promessometro-brasil.vercel.app/api/autonomous-seed?batch=3&offset=0

# Verificar ranking
curl https://promessometro-brasil.vercel.app/api/politicians/ranking

# Verificar saúde
curl https://promessometro-brasil.vercel.app/api/health

# Verificar stats
curl https://promessometro-brasil.vercel.app/api/stats

# Popular avaliações faltantes
curl -X POST https://promessometro-brasil.vercel.app/api/batch-evaluate
```

---

## REGRAS CRÍTICAS

1. **NUNCA** usar `createClient` no escopo do módulo - SEMPRE usar função lazy `db()`
2. **NUNCA** commitar chaves de API no código - usar variáveis de ambiente
3. **SEMPRE** usar `promise_explanations` com `is_latest=true` como fonte única
4. **SEMPRE** mapear status para 4 valores normalizados antes de exibir no frontend
5. **SEMPRE** usar `export default` nos arquivos da api/ (ESM, não CommonJS)
6. **NUNCA** assumir schema do banco - verificar colunas existentes antes de inserir
