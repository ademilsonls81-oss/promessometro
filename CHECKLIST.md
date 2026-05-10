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

## Promessas e Scraper ✅

*   **API de Promessas:**
    *   [x] POST /api/promises/submit - Submeter promessa
    *   [x] GET /api/promises - Listar promessas
    *   [x] GET /api/promises/:id - Detalhar promessa
    *   [x] PATCH /api/promises/:id/status - Atualizar status

*   **Scraper de Notícias:**
    *   [x] POST /api/scraper/scrape - Iniciar scraping
    *   [x] POST /api/scraper/analyze - Analisar com IA
    *   [x] Fontes: G1, UOL, Folha, Estadão, CNN Brasil, Terra
    *   [x] Análise de IA com Groq

*   **Banco de Dados:**
    *   [x] Tabela promises
    *   [x] Tabela politicians
    *   [x] Tabela promise_evidences
    *   [x] Tabela promise_reports
    *   [x] RLS policies configuradas
    *   [x] Índices para performance

*   **Schema SQL:**
    *   [x] supabase/promessometro_schema.sql

---

## URLs dos Serviços

| Serviço | URL |
|---------|-----|
| Frontend (Vercel) | promessometro-brasil.vercel.app |
| Backend (Render) | promessometro-api.onrender.com |
| Health | promessometro-api.onrender.com/api/health |
| Stats | promessometro-api.onrender.com/api/stats |

---

## Fundação Institucional ✅

*   [x] Termos de Uso em português
*   [x] Política de Privacidade em português
*   [x] Página "Quem Somos"
*   [x] Página "Como Funciona"
*   [x] Página "Metodologia"
*   [x] Página "Correções"
*   [x] Página "Fontes"
*   [ ] Domínio customizado (promessometro.com.br)

---

## Próximos Passos (Futuro)

- [ ] Configurar domínio customizado (promessometro.com.br)
- [ ] Criar conta Twitter @promessometro
- [ ] Executar schema SQL no Supabase
- [ ] Testar endpoints de promessas
- [ ] Implementar frontend para listar/submeter promessas