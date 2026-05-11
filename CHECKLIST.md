# Promessômetro - Checklist Final

## Deploy Híbrido ✅

*   **Frontend (Vercel):**
    *   [x] Configurar projeto na Vercel
    *   [x] Variáveis de ambiente (VITE_S_URL, VITE_ANON_KEY, VITE_API_URL)
    *   [x] Deploy automático via GitHub
    *   [x] CORS configurado para Render
    *   [x] Rewrites para API no vercel.json

*   **Backend (Render):**
    *   [x] render.yaml configurado
    *   [x] Environment Groups criados
    *   [x] Server abre porta imediatamente
    *   [x] Health check funcional
    *   [x] Lazy loading de serviços pesados

*   **Branding Promessômetro:**
    *   [x] Footer atualizado em português
    *   [x] GitHub link para repo promessometro
    *   [x] robots.txt e sitemap.xml atualizados
    *   [x] Documentação atualizada

*   **Supabase:**
    *   [x] Variáveis renomeadas (S_URL, SERVICE_ROLE_KEY, ANON_KEY)
    *   [x] Frontend usa VITE_S_URL, VITE_ANON_KEY
    *   [x] Backend usa process.env
    *   [x] supabase.ts para server, supabaseClient.ts para frontend

*   **Verificação:**
    *   [x] Health check: `{"status":"ok"}`
    *   [x] Stats: `{"postsCount":0,"feedsCount":20}`
    *   [x] API Respondendo no Render

---

## Avaliação Detalhada de Promessas ✅

Para cada avaliação, o sistema exibe obrigatoriamente:

*   [x] **Motivo do score** — Por que aquela nota foi atribuída (campo: `justificativa`)
*   [x] **Evidências utilizadas** — O que embasou a análise (campo: `evidencias_usadas`)
*   [x] **Fontes consultadas** — De onde vieram os dados (extraído de evidências)
*   [x] **O que foi concluído** — Resultado da avaliação (campo: `o_que_foi_feito`)
*   [x] **O que ainda falta** — Lacunas ou pontos incompletos (campo: `o_que_falta`)
*   [x] **Grau de confiança da IA** — O quão certa a IA está (campo: `confianca`)
*   [x] **Última atualização** — Quando aquela avaliação foi gerada/revisada (campos: `gerado_em`, `revisado_em`)

**Componentes:**
*   [x] `PromiseEvaluation.tsx` - Componente React com todas as seções obrigatórias
*   [x] Tabela `promise_explanations` no schema SQL com campos:
    *   `status`, `fulfillment_score`, `criterio_aplicado`, `justificativa`
    *   `evidencias_usadas` (JSONB), `o_que_foi_feito`, `o_que_falta`
    *   `confianca`, `motivo_confianca`, `modelo_ia`, `gerado_em`, `revisado_em`
*   [x] RLS policies para leitura pública de explicações
*   [x] Integrado ao `PoliticianProfile.tsx` substituindo `PromiseExplanation`

---

## Módulo: Proteção Contra Viés (CRÍTICO) ✅

O sistema garante:

*   [x] **Isonomia partidária** — Mesmo critério aplicado a todos os partidos, sem exceção
*   [x] **Isonomia individual** — Mesmo peso para todos os políticos, independente de cargo ou relevância
*   [x] **Linguagem neutra** — Sem adjetivos carregados, tom jornalístico objetivo
*   [x] **Sem ataques pessoais** — Avaliações focadas em atos públicos, nunca na pessoa
*   [x] **Presunção de inocência** — Jamais acusar crimes sem decisão judicial transitada em julgado
*   [x] **Sem ironia política** — Proibido uso de sarcasmo ou recursos retóricos
*   [x] **Sem editorialização** — O sistema apresenta os fatos, não opiniões sobre resultados

**Implementação:**

*   `src/services/contentGuardService.ts` — Sistema completo com:
    *   `BLOCKED_TERMS` — Termos bloqueados com substituição automática
    *   `IRONY_PATTERNS` — Padrões de ironia/sarcasmo detectados
    *   `PARTISAN_PATTERNS` — Generalizações partidárias bloqueadas
    *   `CRIME_CLAIMS` — Afirmações de crime sem decisão judicial
    *   `checkBias()` — Verifica texto e retorna violações
    *   `sanitizeText()` — Remove/substitui termos proibidos
    *   `getProtectionReport()` — Gera relatório de conformidade
*   Tabela `bias_violation_log` para auditoria de violações
*   RLS policies para segurança

---

## Módulo: Correção Pública (CRÍTICO) ✅

**Frontend implementado:**

*   [x] **Contestação** — Interface para contestar avaliação (`ContestationModal.tsx`)
*   [x] **Envio de evidências** — Formulário conectado a `promise_evidences`
*   [x] **Sistema de revisão** — Fluxo IA reavalia após contestação (via `promise_explanations`)
*   [x] **Histórico público** — Timeline com `PromiseTimeline.tsx` usando:
    *   `promise_audit_log` — alterações de status/score
    *   `promise_explanations` — avaliações da IA
    *   `promise_contestations` — contestações
*   [x] **Registro de revisões IA** — Exibe todas as avaliações geradas
*   [x] **Transparência** — Mostra claramente o que mudou (status, score, data, ator)

**Tabelas no schema:**

*   `promise_audit_log` — histórico de alterações
*   `promise_contestations` — contestações com evidências
*   RLS policies para todas as tabelas

**Fluxo:**
1. Usuário contesta avaliação via modal
2. Contestação fica pendente para análise
3. IA reavalia se aceita/rejeita
4. Histórico completo fica visível na timeline

---

## Módulo: Arquitetura Aberta (CRÍTICO) ✅

**Regra principal: NENHUMA ação exige login obrigatório.**

**Proteções implementadas (sem autenticação):**

*   [x] **Rate limiting por IP** — Limita requisições excessivas (100 req/min)
*   [x] **Cooldown por ação** — Mesmo IP só pode contestar 1x por 24h
*   [x] **Honeypot** — Campos ocultos em formulários para pegar bots
*   [x] **Fingerprint do navegador** — Identifica dispositivo sem conta
*   [x] **Validação de entrada** — Mínimo de caracteres, sanitização
*   [x] **Login opcional incentivado** — `LoginBenefits.tsx` mostra benefícios sem bloquear

**Componentes:**

*   `src/services/abuseProtection.ts` — Sistema completo de proteção
*   `src/components/LoginBenefits.tsx` — Mostra benefícios do login
*   `ContestationModal.tsx` — Integrado com todas as proteções

**O que funciona SEM login:**
- Pesquisar políticos ✅
- Ver rankings ✅
- Ver promessas ✅
- Ver evidências ✅
- Compartilhar páginas ✅
- Navegação completa ✅
- Contestações ✅
- Envio de evidências ✅

**Tabelas mantidas nullable (sem user_id obrigatório):**
- `promise_contestations` ✅
- `community_submissions` ✅
- `promise_reports` ✅

---

## Arquitetura Aberta — Foco em Viralização e SEO ✅

**URLs amigáveis implementadas:**

- [x] `/politico/nome-do-politico` (slugified)
- [x] `/promessa/titulo-da-promessa` (slugified)
- [x] `/politico/:id` (backwards compatible)
- [x] `/promessa/:slug` (nova rota)

**SEO e Open Graph:**

- [x] Componente `SEO.tsx` com meta tags dinâmicas por página
- [x] Open Graph tags: title, description, image, url, type
- [x] Twitter Card tags: summary_large_image
- [x] Canonical URLs únicos por página
- [x] Schema.org JSON-LD para Organization

**Imagens OG dinâmicas:**

- [x] `og-default.svg` — imagem padrão do site
- [x] `/api/og` — endpoint para gerar OG images dinâmicas com:
  - Nome do político
  - Título da promessa
  - Score de cumprimento
  - Status (cores diferentes)
  - Branding Promessômetro

**Sitemap.xml automático:**

- [x] `/api/sitemap.xml` — gera sitemap dinâmico com:
  - Rotas estáticas (prioridade alta)
  - Todos os políticos (até 500)
  - Todas as promessas (até 1000)
  - Lastmod baseado em updated_at
  - Prioridades e changefreq diferenciados

**Performance e Core Web Vitals:**

- [x] Code splitting com chunks: react-vendor, motion, ui
- [x] Minificação com terser
- [x] Preconnect para fontes e Supabase
- [x] DNS prefetch para banco de dados
- [x] CSS code splitting
- [x] Lazy loading de componentes

**Meta tags por página:**

- [x] Landing, Promessas, Ranking
- [x] Perfil de Político, Detalhe de Promessa
- [x] Metodologia, Fontes, Quem Somos, etc.
- [x] Noindex para 404

---

## Anti-Abuse Control Module ✅

**Middleware (`src/middleware/antiAbuse.ts`):**

- [x] Rate limiting by tier: public (300/min), sensitive (10/min), api (60/min)
- [x] `antiScrapingHeaders()` middleware with X-Robots-Tag, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- [x] `logSuspiciousActivity()` for rate limit violations, bot detection, scraping attempts
- [x] `getTrafficStats()` for active connections, blocked IPs, request counts
- [x] `getSuspiciousActivityLogs()` for admin review
- [x] Auto-cleanup of old IP records every 5 minutes
- [x] Friendly 429 response with Retry-After header

**reCAPTCHA v3 (`src/services/recaptchaService.ts`):**

- [x] Invisible reCAPTCHA v3 integration (no visible CAPTCHA for users)
- [x] Client-side token generation via `executeRecaptchaV3()`
- [x] Server-side verification endpoint `/api/recaptcha-verify`
- [x] Score threshold of 0.5 for blocking
- [x] Graceful fallback when keys not configured
- [x] `shouldSkipRecaptcha()` helper for conditional checks

**Client-side protection (`src/services/abuseProtection.ts`):**

- [x] Session-based rate limiting with sessionStorage
- [x] Per-action cooldowns (24h for contestations)
- [x] Honeypot field detection
- [x] Client-side fingerprinting
- [x] Form-specific cooldown management

**Admin dashboard (`src/pages/admin/TrafficMonitor.tsx`):**

- [x] Real-time traffic stats (active connections, blocked IPs, requests, suspicious activities)
- [x] Filterable suspicious activity logs (rate_limit, scraping, bot)
- [x] Auto-refresh every 30 seconds
- [x] Protection configuration display
- [x] API endpoints: `/api/admin/traffic-stats`, `/api/admin/suspicious-logs`

**Global API headers (`server.ts`):**

- [x] X-Robots-Tag: noindex, nofollow
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Cache-Control: no-store, no-cache
- [x] Pragma: no-cache
- [x] Permissions-Policy: camera=(), microphone=(), geolocation=()

**ContestationModal integration:**

- [x] reCAPTCHA v3 token execution on submit
- [x] Token stored in `recaptcha_token` field
- [x] Honeypot + cooldown + fingerprint layered protection
- [x] Friendly error messages (no silent blocks)

**robots.txt:**

- [x] Allow: Googlebot, Bingbot, Slurp, DuckDuckBot, Applebot, Yandex
- [x] Disallow: Baiduspider, Bytespider (known scrapers)
- [x] Proper sitemap reference
- [x] Crawl-delay for polite crawling

---

## Módulo: Infraestrutura ✅

**CDN e Cache (Vercel + Cloudflare):**

- [x] Vercel `crons` config for 4 scheduled jobs (daily-reavaliation, update-stats, backup-export, process-evidences)
- [x] Vercel `headers` config for politician/promessa pages (s-maxage=1800, stale-while-revalidate=3600)
- [x] Sitemap Cache-Control header (s-maxage=3600)
- [x] Global API headers (Cache-Control: no-store) already configured
- [x] In-memory cache with TTL per endpoint in public.ts

**Logs:**

- [x] `logSystemError()` added to auditLog.ts for system_errors table
- [x] `logAuditAction()` already logging to audit_logs table
- [x] Structured severity levels: low, medium, high, critical
- [x] Cron routes logging errors to system_errors

**Backup Automático:**

- [x] `/api/cron/backup-export` runs weekly (Sunday 02:00 UTC)
- [x] Exports tables: promises, politicians, promise_contestations, promise_evidences, promise_explanations
- [x] Saves to Supabase Storage bucket `backups` as JSON
- [x] Auto-cleanup of backups older than 30 days
- [x] Backup filename: `backup_YYYY-MM-DD.json`

**Monitoramento:**

- [x] Enhanced `/api/health` returns database status, latency_ms
- [x] Health check with slow response detection (>3s)
- [x] Returns HTTP 503 if database is unreachable
- [x] Admin routes for traffic-stats and suspicious-logs
- [x] node-cron jobs running in production mode

**Async Jobs:**

- [x] `/api/cron/daily-reavaliation` — reavaliates promises (daily at 09:00 UTC)
- [x] `/api/cron/update-stats` — updates system metrics (every 6h)
- [x] `/api/cron/process-evidences` — validates evidence URLs (every 2h)
- [x] `/api/cron/politician-ranking` — snapshots ranking to Supabase Storage (manual trigger)
- [x] All cron routes protected with `CRON_SECRET` header
- [x] Daily ingestion via server.ts `runIngestion()`

**Storage de Evidências:**

- [x] `/api/evidences/evidence` — upload endpoint for files
- [x] `uploadEvidence()` service with 10MB limit
- [x] Accepted types: PDF, JPG, PNG, MP4
- [x] Saves to Supabase Storage bucket `evidences`
- [x] Returns public URL linked to `promise_evidences` table

**Snapshots:**

- [x] `snapshotService.ts` with `savePromiseSnapshot()` for JSONB audit trail
- [x] `getPromiseHistory()` returns full promise audit trail
- [x] `generateDiff()` creates before/after diff between snapshots
- [x] Promise audit log captures: status, score, changed_by, change_reason
- [x] Weekly ranking snapshot saved to Supabase Storage

**Banco Escalável:**

- [x] Supabase Point-in-Time Recovery (automatic)
- [x] Connection pooling via Supabase (PgBouncer enabled by default)
- [x] All indexes created on main tables
- [x] `politician_stats` view available

---

## Próximos Passos (Futuro)

- [ ] Configurar domínio customizado (promessometro.com.br)
- [ ] Criar conta Twitter @promessometro
- [ ] Executar schema SQL no Supabase
- [ ] Testar endpoints de promessas
- [ ] Implementar frontend para listar/submeter promessas