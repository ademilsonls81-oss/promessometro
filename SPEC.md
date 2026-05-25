# SPEC: Promessômetro Brasil

Versão: 1.0
Data: 2026-05-25
Status: em-execucao

---

## 1. Objetivo

Plataforma de transparência política que rastreia, avalia e divulga o cumprimento de promessas feitas por políticos brasileiros. Combina IA (Groq/OpenAI) com checagem humana para classificar promessas em 4 status: cumprida, parcial, pendente, quebrada.

### 1.1 Resultado esperado

- Ranking público de políticos por cumprimento de promessas
- Perfil individual de cada político com C1/C2/C3 e nota final
- Pipeline automatizado de descoberta de promessas via Serper.dev + Groq
- Reavaliação periódica via cron (06:00 UTC)
- Admin dashboard com controle de acesso via GitHub OAuth + JWT
- Metodologia 3 Camadas (C1 Promessas, C2 Indicadores, C3 Fatos Jurídicos)

### 1.2 Fora de escopo

- Cadastro de usuários finais (apenas admin auth)
- Chat IA interativo
- App mobile nativo (apenas SPA responsivo)

---

## 2. Glossário

| Termo | Significado |
|-------|-------------|
| Promessa | Compromisso público feito por político (campanha, mandato, entrevista) |
| C1 | Camada 1 - Promessas (40% da nota final) |
| C2 | Camada 2 - Indicadores objetivos (35%) |
| C3 | Camada 3 - Fatos Jurídicos (25%) |
| Grade | Nota final categorizada: A(80-100) B(60-79) C(40-59) D(20-39) F(0-19) |

---

## 3. Arquitetura geral

```
[ Vercel CDN ] --> [ SPA React (Vite) ] --> [ Express API (lazy imports) ]
                    [ Vercel API Routes ] --> [ Supabase PostgreSQL ]
                    [ Cron Vercel ] --------> [ Groq/OpenAI + Serper.dev ]
```

### 3.1 Componentes

- **Frontend SPA**: React 19 + Vite + TailwindCSS v4 + React Router + Recharts
- **Server Express**: server.ts + src/routes/* (lazy loaded) + src/services/*
- **Vercel API Routes**: api/index.js + api/cron/* (serverless functions)
- **Database**: Supabase PostgreSQL com RLS
- **AI Pipeline**: Groq (llama-3.3-70b) / OpenAI via OpenAI SDK + Serper.dev (evidências)

### 3.2 Boundaries

- Frontend nunca acessa Supabase service_role. Usa anon key via supabaseClient.ts.
- Admin auth via JWT + GitHub OAuth (api/index.js). Frontend só exibe /admin com token.
- Cron jobs rodam em Vercel serverless. Endpoints internos em src/routes/ rodam no server Express standalone.
- API routes no server.ts são lazy loaded via `import(...)`.

---

## 4. Stack e dependências

| Camada | Tecnologia | Versão | Razão |
|--------|-----------|--------|-------|
| Frontend | React | 19 | SPA moderna, ecosystem maduro |
| Bundler | Vite | 6.2 | Build rápido, HMR, Tailwind v4 |
| Estilos | TailwindCSS | 4.1 | Utility-first, baixo bundle |
| Backend | Express | 4.21 | Framework leve, flexível |
| Database | Supabase (PostgreSQL) | - | BaaS, RLS, auth |
| Admin Auth | JWT + GitHub OAuth | - | Segurança, OAuth padrão |
| AI | Groq/OpenAI SDK | - | Inferência rápida via Groq |
| Busca | Serper.dev | - | API Google Search |
| Testes | Vitest | 4.1 | Rápido, compatível Vite |
| Cron | Vercel Cron | - | Serverless schedule |

---

## 5. Modelo de dados

### 5.1 Entidades principais

#### politicians
```typescript
interface Politician {
  id: string; name: string; role: string; party?: string;
  state?: string; city?: string; photo_url?: string; bio?: string;
  website_url?: string; c1_score?: number; c2_score?: number;
  c3_score?: number; final_score?: number; grade?: string;
  methodology_version?: string; last_evaluated_at?: string;
  created_at: string; updated_at: string;
}
```

#### promises
```typescript
interface PoliticalPromise {
  id: string; politician_id: string; mandate_id?: string;
  title: string; description?: string; category?: string;
  status: 'cumprida' | 'parcial' | 'pendente' | 'quebrada';
  fulfillment_score?: number; evidence_url?: string;
  is_primary_source?: boolean; verification_sources?: JSON;
  fulfillment_percentage?: number; date_promised?: string;
  created_at: string; updated_at: string;
}
```

#### promise_explanations
```typescript
interface PromiseExplanation {
  id: string; promise_id: string; score: number;
  status_update: string; justificativa: string;
  evidencias_usadas: JSON; nivel_confianca: number;
  is_latest: boolean; gerado_em: string;
}
```

#### mandates, indicators, legal_facts
- `mandates`: Períodos de mandato (start_date, end_date, position)
- `indicators`: Indicadores objetivos por categoria (seguranca, financas, funcionalismo)
- `legal_facts`: Fatos jurídicos (condenações, investigações)

### 5.2 Status normalization

Mapeamento legado:
- `parcialmente_cumprida`, `em_andamento` → `parcial`
- `nao_iniciada`, `nao_classificada` → `pendente`
- `descumprida` → `quebrada`

---

## 6. Contratos / Interfaces

### 6.1 Tipos compartilhados

Fonte canônica: `src/types/index.ts`

```typescript
export type PromiseStatus = 'cumprida' | 'parcial' | 'pendente' | 'quebrada';
export type Plan = 'free' | 'pro';
export type UserRole = 'user' | 'admin';

export interface RankingFilter {
  state?: string; party?: string; position?: string; year?: number;
  minScore?: number; maxScore?: number;
  sortBy?: 'percentage' | 'name' | 'total';
  sortOrder?: 'asc' | 'desc'; cursor?: string; limit?: number;
}

export interface PoliticianRankingEntry {
  name: string; slug: string; party: string | null; state: string | null;
  position: string | null; photo_url: string | null;
  percentage: number;
  stats: { fulfilled: number; partial: number; broken: number; pending: number; total: number; };
  score_breakdown: Record<string, number>;
  election_year: number | null;
}
```

### 6.2 API Endpoints (server.ts)

| Rota | Método | Descrição |
|------|--------|-----------|
| /api/health | GET | Health check com status DB |
| /api/admin/* | GET/POST | Admin dashboard + discovery |
| /api/promises/* | GET/POST | CRUD promessas |
| /api/politicians/* | GET | Perfil + ranking |
| /api/score | POST | Cálculo de score |
| /api/evidence/* | GET | Pipeline de evidências |
| /api/cron/* | GET | Reavaliação automática |
| /api/ai-review/* | POST | Revisão IA |
| /api/feeds/* | GET/POST | Gerenciamento de RSS |
| /api/v1/* | GET/POST | API pública v1 |

### 6.3 Metodologia 3 Camadas

```
Nota Final = (C1 × 0.40) + (C2 × 0.35) + (C3 × 0.25)

C1 = (cumpridas × 1.0 + parciais × 0.5) / total × 100
C2 = Σ(indicador_score × peso) / Σ(pesos)
C3 = max(0, 100 - penalidades)

Grade: A(80-100) B(60-79) C(40-59) D(20-39) F(0-19)
```

---

## 7. Componentes / Módulos

### 7.1 Server (server.ts)

**Arquivo:** `server.ts`

**Responsabilidade:** Entry point do servidor Express standalone

**Comportamento:**
1. Inicializa middleware: cors, json parser, security headers, CSRF
2. Cria WebSocket server em /ws/stats
3. Registra rotas via lazy dynamic import
4. Inicializa serviços pesados (rate limit, Sentry, Stripe, ingestion) em background
5. Error handler global no final

**Exports:**
- `app` (Express instance) - exportada para testes

### 7.2 Frontend (src/App.tsx)

**Arquivo:** `src/App.tsx`

**Responsabilidade:** Roteador SPA com React Router

**Rotas:**
- `/` - Landing page
- `/ranking` - Ranking de políticos
- `/politico/:slug` - Perfil individual
- `/promessa/:id` - Detalhe da promessa
- `/metodologia` - Documentação da metodologia
- `/admin` - Admin dashboard (protegido)

### 7.3 Serviços (src/services/)

**Arquivos:** 22 services no total

| Service | Responsabilidade |
|---------|-----------------|
| rankingService.ts | Ranking com filtros, paginação por cursor |
| promiseAiService.ts | Classificação IA de promessas (via Groq) |
| evidencePipeline.ts | Pipeline automático de evidências (RSS + IA) |
| evidenceService.ts | CRUD de evidências |
| scoreService.ts | Cálculo de métricas e scores |
| searchService.ts | Busca textual |
| ingestionService.ts | Ingestão inicial de dados |
| scraperService.ts | Scraping de fontes externas |
| electionService.ts | Dados eleitorais |
| politicianPhotoService.ts | Fotos via Wikipedia |

### 7.4 Middleware (src/middleware/)

| Middleware | Função |
|-----------|--------|
| security.ts | secureHeaders, csrfValidation, sanitizeInput |
| rateLimit.ts | Rate limiting por IP e API key |
| antiAbuse.ts | Rate limit configurável por tipo (public/sensitive/api) |
| auth.ts | JWT + API key verification |
| auditLog.ts | Auditoria de operações |

### 7.5 API Serverless (api/index.js)

**Responsabilidade:** Vercel serverless function que hospeda:
- Admin auth (GitHub OAuth + JWT)
- CRUD promises/politicians
- Avaliação IA
- Discovery pipeline (Serper.dev + Groq)
- Webhook Stripe

### 7.6 Cron Jobs (api/cron/)

| Cron | Schedule | Descrição |
|------|----------|-----------|
| daily-reavaliation.js | 0 6 * * * | Reavalia promessas stale |
| pipeline-orchestrator.js | 0 6 * * * | Pipeline de descoberta |
| backup-export.js | - | Export mensal de backup |
| discovery-processor.js | - | Processador de descoberta |

---

## 8. Fluxos / Casos de uso

### 8.1 Ranking público

```
Usuário acessa /ranking
  -> Frontend chama GET /api/politicians/ranking
    -> rankingService busca promise_explanations + politicians
    -> Calcula score_breakdown por político
    -> Retorna lista paginada com cursor
  -> Frontend renderiza tabela com ordenação/filtros
```

### 8.2 Reavaliação automática (cron)

```
Cron Vercel 06:00 UTC
  -> daily-reavaliation.js
    -> Busca promessas stale (23h sem verificar) + cumpridas/quebradas (7d)
    -> Para cada promessa:
      -> Busca evidências via Tavily/Serper
      -> Prompt Groq para reavaliação
      -> Clamp score no range do status
      -> Atualiza promises, status_history, promise_explanations, audit_logs
    -> Alerta Slack se 2 execuções consecutivas com 0 promessas
```

### 8.3 Admin Login

```
Usuário acessa /admin
  -> Redireciona para GitHub OAuth
  -> api/index.js troca code por token GitHub
  -> Verifica email em ADMIN_EMAILS
  -> Gera JWT com validade 24h
  -> Redireciona para /admin com token
```

---

## 9. Tratamento de erros

Política geral: endpoints retornam `{ status: "error", message: string }`. Server.ts tem `errorHandler` do middleware security.ts como global handler.

| Caso | Severidade | Ação |
|------|-----------|------|
| Falha de DB | alta | Log + retorna { status: "error", message } |
| Rate limit | media | 429 com { error: "rate_limit_exceeded" } |
| Auth inválida | media | 401/403 com { error: "unauthorized" } |
| CSRF inválido | alta | 403 com { error: "Origin not allowed" } |
| Input malformado | baixa | 400 via Zod schema validation |

---

## 10. Observabilidade

- Logger: console.log com prefixo (server.ts heartbeat a cada 5min)
- Sentry: opcional via SENTRY_DSN env var
- Health check: GET /api/health retorna status DB + latency
- Cron tracking: cron_executions table + audit_logs

---

## 11. Segurança / Permissões

- Admin auth via JWT (24h) + GitHub OAuth + ADMIN_EMAILS whitelist
- CSRF validation em todas as mutations (origin/referer check)
- sanitizeInput com DOMPurify (strip HTML)
- Rate limiting por IP (global + tipo de endpoint)
- ALLOWED_ORIGINS valida origem em produção
- Service role key NUNCA exposta ao frontend
- RLS policies no Supabase protegem dados sensíveis

---

## 12. Performance / Limites

- Rate limit: 300 req/min (public), 60 req/min (api), 10 req/min (sensitive)
- AI requests: default 50 requests per cron run (AI_MAX_REQUESTS_PER_RUN)
- Batch delay: 2000ms entre requisições IA
- Vercel function maxDuration: 60s
- Chunk size warning limit: 600KB

---

## 13. Compatibilidade / Migração

- Status legado mapeado via mapStatus() em rankingService.ts
- promise_explanations.is_latest=true como fonte única da verdade
- Methodology v1 para v2: migration via run-migration.mjs (set 2026)

---

## 14. Plano de entrega (sprints)

| Sprint | Tema | Features esperadas |
|--------|------|--------------------|
| 00 | Bootstrap DX | Configurações IDE/editor |
| 01 | Test Coverage | Cobertura de testes unitários |
| 02 | Admin Dashboard | Melhorias dashboard admin |
| 03 | Cache & Performance | Cache ranking, otimizações |
| 04 | Sprint Review Final | Auditoria final e correções |

---

## 15. Constantes cross-sprint

| Constante | Define em | Tipo | Descrição |
|-----------|-----------|------|-----------|
| STATUS_CONFIG | src/routes/promises.ts | Record<string, number> | Score ranges por status |
| STATUS_MAP | src/services/rankingService.ts | Record<string, string> | Mapeamento legado |
| CATEGORIES | src/services/promiseCategorization.ts | string[] | Categorias normalizadas |
| ALLOWED_ORIGINS | src/middleware/security.ts | string[] | Origens permitidas CORS |
| ADMIN_EMAILS | api/index.js / src/middleware/auth.ts | string | Env var whitelist |
