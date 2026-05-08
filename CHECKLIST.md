### Checklist Promessômetro - Deploy Híbrido

*   **1. Frontend (Vercel):**
    *   [x] Configurar projeto na Vercel
    *   [x] Variáveis de ambiente (VITE_S_URL, VITE_ANON_KEY, VITE_API_URL)
    *   [x] Deploy automático via GitHub
    *   [x] CORS configurado para Render
    *   [x] Rewrites para API no vercel.json

*   **2. Backend (Render):**
    *   [x] render.yaml configurado
    *   [x] Environment Groups criados
    *   [x] Server abre porta imediatamente
    *   [x] Health check funcional
    *   [x] Lazy loading de serviços pesados

*   **3. Branding Promessômetro:**
    *   [x] Footer atualizado em português
    *   [x] GitHub link para repo promessometro
    *   [x] robots.txt e sitemap.xml atualizados
    *   [x] Documentação atualizada

*   **4. Supabase:**
    *   [x] Variáveis renomeadas (S_URL, SERVICE_ROLE_KEY, ANON_KEY)
    *   [x] Frontend usa VITE_S_URL, VITE_ANON_KEY
    *   [x] Backend usa process.env
    *   [x] supabase.ts para server, supabaseClient.ts para frontend

*   **5. Verificação:**
    *   [ ] Testar API health no Render
    *   [ ] Testar CORS entre Vercel e Render
    *   [ ] Verificar redirects do Stripe
    *   [ ] Configurar domínio customizado (futuro)

---
### Pendente:
- Configurar domínio customizado
- Criar conta Twitter @promessometro
- Testar todas as rotas da API