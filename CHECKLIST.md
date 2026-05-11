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

## Próximos Passos (Futuro)

- [ ] Configurar domínio customizado (promessometro.com.br)
- [ ] Criar conta Twitter @promessometro
- [ ] Executar schema SQL no Supabase
- [ ] Testar endpoints de promessas
- [ ] Implementar frontend para listar/submeter promessas