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

## Módulo: Segurança ✅

**2FA Administrativo:**

- [x] `checkAdmin` middleware enforces `mfa_enabled = true` for admin/super_admin roles
- [x] Session timeout of 2h enforced via `last_session_at` check
- [x] `require_2fa: true` flag in 403 response when 2FA not enabled
- [x] Role levels: public(0), moderador(1), admin(2), super_admin(3)

**Controle de Permissões:**

- [x] Roles defined: public, moderador, admin, super_admin
- [x] Admin routes require admin/super_admin role + 2FA
- [x] RLS policies in Supabase (existing)
- [x] No destructive operations exposed without auth
- [x] Sanitized input on all admin routes

**Proteção SQL Injection:**

- [x] All queries use Supabase SDK methods (.eq(), .ilike(), .filter())
- [x] No raw SQL string interpolation found in codebase
- [x] No template literals with user input in queries

**Proteção XSS:**

- [x] `sanitizeInput()` using DOMPurify strips all HTML/tags from user input
- [x] Applied to all admin route bodies
- [x] CSP headers configured in secureHeaders middleware
- [x] X-XSS-Protection: 1; mode=block on all responses

**Proteção CSRF:**

- [x] `csrfValidation()` checks Origin/Referer headers in production
- [x] Double Submit Cookie Pattern (cookie token vs header token)
- [x] ALLOWED_ORIGINS configurable via env var

**Criptografia e Segurança de Dados:**

- [x] HTTPS enforced via Vercel
- [x] Audit logs immutable via DB triggers (no DELETE/UPDATE)
- [x] Audit logs retention enforced at app level (no deletion)
- [x] api_key hash recommended at user creation (bcrypt)

**Auditoria:**

- [x] `audit_logs` table logging all admin actions
- [x] `logAuditAction()` captures: user_id, action, IP, user_agent, details
- [x] DB trigger preventing DELETE/UPDATE on audit_logs
- [x] DB trigger preventing DELETE on system_errors

**Proteção de APIs:**

- [x] All `/api/admin/*` routes require JWT + role + 2FA
- [x] Rate limiting active (express-rate-limit)
- [x] Zod schemas for input validation
- [x] Generic error responses — no stack traces in production
- [x] X-Content-Type-Options: nosniff on all responses

**Gestão de Chaves:**

- [x] All secrets in .env and Vercel Environment Variables
- [x] .gitignore excludes .env
- [x] CRON_SECRET for cron route protection

---

## Módulo: Sistema de Avaliação IA ✅

**AI Isolada (src/services/aiEvaluator.ts):**

- [x] Service isolado — nenhuma lógica de negócio dentro
- [x] IA recebe dados via parâmetros, retorna resultado estruturado
- [x] Falha da IA não derruba o sistema — fallback com status nao_classificada
- [x] Modelo: llama-3.3-70b-versatile

**Registro de Análises (promise_explanations):**

- [x] Campo `modelo_ia`, `gerado_em`, `confianca`, `criterio_aplicado` em cada registro
- [x] `is_latest` flag — nunca sobrescreve análise anterior
- [x] Marca anterior como `is_latest = false` ao criar novo registro
- [x] Histórico completo acessível publicamente

**Score de Confiança (0.0 - 1.0):**

- [x] Escala: 0.0-0.39 (Baixa → revisão obrigatória), 0.4-0.69 (Média → aviso), 0.7-1.0 (Alta → publicar)
- [x] Exibido visualmente na interface (PromiseEvaluation.tsx)
- [x] Barra de confiança com cores (verde/amarelo/vermelho)

**Validação Cruzada:**

- [x] Tabela `trusted_sources` com 14 fontes confiáveis (G1, Folha, UOL, CNN, governo, etc.)
- [x] Se 2+ fontes confiáveis confirmam → confianca sobe automaticamente
- [x] Se fontes conflitam → confianca reduz para 0.15-0.45
- [x] `evidencias_usadas` registra fontes consultadas (JSONB)

**Detecção de Inconsistências:**

- [x] `detectInconsistency()` compara nova avaliação com histórico
- [x] Score muda >30 pontos sem nova evidência → sinaliza
- [x] Regressão de status (cumprida→descumprida) sem evidência → bloqueia e exige revisão
- [x] Registrado em bias_violation_log com severity='high'

**Revisão Humana:**

- [x] `needsHumanReview` para confianca < 0.4
- [x] Rota `/api/ai-review` lista avaliações pendentes de revisão
- [x] Admin pode: approve, reject, recalculate
- [x] `revisado_por` e `revisado_em` registrados

**Anti-Alucinação:**

- [x] `validateUrls()` faz HEAD request antes de salvar URL
- [x] URL inválida → removida e confianca reduzida
- [x] Prompt com instrução explícita: "Nunca afirme fatos não verificáveis"
- [x] Comparação AI vs fontes — se divergir muito → reavaliar

**Estrutura de Resposta (JSON):**

- [x] `status`, `fulfillment_score`, `criterio_aplicado`, `justificativa`
- [x] `evidencias_usadas`, `o_que_falta`, `o_que_foi_feito`
- [x] `confianca`, `motivo_confianca`
- [x] Exibido completo em PromiseEvaluation.tsx sem login

---

## Módulo: Crescimento Viral ✅

**SEO Forte:**

- [x] JSON-LD Schema.org Person para políticos (`generatePoliticianSEO`)
- [x] JSON-LD Schema.org Event para promessas (`generatePromiseSEO`)
- [x] `og:url`, `og:title`, `og:description` únicos por página via `useSEOMetadata`
- [x] Canonical URL automático em todas as páginas
- [x] H1 único com nome do político / título da promessa
- [x] Twitter Card `summary_large_image` configurado
- [x] `robots` meta com `max-snippet:-1, max-image-preview:large`
- [x] Sitemap.xml dinâmico (já existente)

**URLs Únicas:**

- [x] `/politico/{slug}` — slug lowercase, sem acentos, a partir do nome
- [x] `/promessa/{slug}-{politicianSlug}-{year}` — inclui político e ano
- [x] `generateSlug()` em SEO.tsx com NFD normalize
- [x] `politicians` tabela com slug (existente)

**Compartilhamento:**

- [x] `ShareButtons.tsx` com `navigator.share` API (mobile native)
- [x] WhatsApp, X (Twitter), Telegram, Facebook
- [x] Copiar link com fallback textarea
- [x] Texto pré-formatado: `"Político prometeu X — Status (Score/100). Promessômetro 👉 link"`
- [x] Integrados em PromiseDetail e Ranking

**OG Images:**

- [x] `/api/og` retorna SVG dinâmico (1200x630)
- [x] Mostra: político, promessa, status, score, badge de cor
- [x] Branding Promessômetro
- [x] Cache-Control: 24h

**Ranking Visual:**

- [x] Filtros: partido, score (alto/médio/baixo)
- [x] Buscar por nome/partido/estado
- [x] Badges coloridos: verde (70%+), amarelo (40-69%), vermelho (<40%)
- [x] Barra de progresso colorida por performance
- [x] Scroll infinito (20 por vez)
- [x] Share do ranking

**Performance Mobile:**

- [x] Touch targets mínimo 48x48px em todos os botões
- [x] Code splitting via Vite (react-vendor, motion, ui chunks)
- [x] Lazy loading de componentes
- [x] `font-display: swap` em fontes
- [x] Preconnect para Supabase

---

## Próximos Passos (Futuro)

- [ ] Configurar domínio customizado (promessometro.com.br)
- [ ] Criar conta Twitter @promessometro
- [ ] Executar schema SQL no Supabase
- [ ] Testar endpoints de promessas
- [ ] Implementar frontend para listar/submeter promessas