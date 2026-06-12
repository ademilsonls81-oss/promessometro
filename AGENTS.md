# Harness v6.5 — AGENTS.md para OpenCode + DeepSeek V4 Flash

> Adaptado de HarnessQwen v6.5 para OpenCode + DeepSeek V4 Flash.
> Este arquivo é carregado automaticamente pelo OpenCode a cada sessão (padrão AGENTS.md).
> INVARIANTES — não alterar durante execução.


---

## Tokens preenchidos (substitui placeholders globais)

> ⚠️ **PREENCHA ESTE BLOCO ANTES DE RODAR `/develop` NO PROJETO NOVO.**

| Token | Valor real (PREENCHA) | Exemplo |
|-------|----------------------|---------|
| `<PROJECT_NAME>` | `Promessômetro` | `meu-app` |
| `<CWD_PATH>` | `C:\Users\user\Desktop\Promessometro\` | `/home/user/MeuApp/` |
| `<TYPECHECK_CMD>` | `npm run lint` | `npm run typecheck` |
| `<TYPECHECK_NOTE>` | `SPA React 19 + Vite + Express server. Path alias @/*.` | `monorepo com 3 tsconfigs` |
| `<TYPECHECK_GREP>` | `select-string -Pattern "error TS"` | (TypeScript) |
| `<DB_FILE_PATH>` | `src/lib/supabaseClient.ts` | `backend/db/client.ts` |
| `<TYPES_DIR>` | `src/types/index.ts` | `shared/types.ts` |
| `<SHELL>` | `powershell` | (Linux/Mac) |
| `<TMP_DIR>` | `C:\Users\user\Desktop\Promessometro\tmp\harness\` | (Windows) |
| `<HARNESS_DIR>` | `.harness/` | (genérico) |
| `<SPEC_PATH>` | `SPEC.md` | (genérico) |
| `<RUN_CMD>` | `npm run dev` | `npm run dev` |
| `<TOTAL_SPRINTS>` | `5` | `12` |

**Após preencher:** verifique que não há mais `<[A-Z_]*>` não preenchidos no AGENTS.md.

---

## Helper scripts em .harness/scripts/ (USE SEMPRE)

Em vez de re-ler sprint JSON inteiro a cada operação, use os scripts:

| Script | Quando usar |
|--------|-------------|
| `feat-context.py <sprint> [feat-id]` | **PRIMEIRO comando ao iniciar feature.** Contexto COMPLETO: info da feature + SPEC.md no range exato + conteúdo dos arquivos. |
| `feat-info.py <sprint> [feat-id]` | Info SÓ da feature, sem SPEC. Use só quando já tem contexto recente. |
| `feat-status.py <sprint> <feat-id> <status>` | Marcar feature in-progress ou done. Atualiza timestamps automaticamente. |
| `sprint-close.py <sprint>` | Fechar sprint (3 operações em 1: marca done, atualiza index, avança current.txt). |
| `sprint-status.py` | Ver status geral de todas sprints. |
| `gate-lifecycle.py <sprint>` | Valida ≤1 in-progress + done tem completedAt. |
| `gate-anti-empty.py <sprint> <feat-id>` | Valida campos do JSON não foram esvaziados. |
| `gate-paths.py <sprint> <feat-id>` | Valida arquivos de `files[]` com `lines:"new"` existem. |
| `gate-idempotency.py` | Valida sprints anteriores fechadas. |
| `gate-sprint-closed.py <sprint>` | Valida 3 marcadores verdes pós-fechamento. |

**Regra dura:** se você está tentando fazer `read_file <sprint>.json` + `write_to_file <sprint>.json` só pra mudar status/timestamp, você está no anti-pattern. Use `feat-status.py`.

---

## §0. Pre-flight (rode UMA vez no início da sessão)

ANTES de qualquer feature, valide que as ferramentas existem no PATH:

```powershell
Get-Command node, npm, git, python, curl -ErrorAction SilentlyContinue
node --version    # >= 20
python --version  # >= 3.11
```

Se algum comando retornar vazio/erro: **PARE e reporte ao humano.** Não prossiga.

**IMPORTANTE:** Em Windows, use `python` (não `python3`). Em WSL/Linux, use `python3`.

---

## §1. Regras de escrita de código

1. **TypeScript strict.** `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`. Sem `// @ts-ignore` ou `any` sem justificativa explícita.
2. **Um arquivo por responsabilidade.** Nenhum arquivo ultrapassa 300 linhas sem justificativa no JSON da feature.
3. **Imports explícitos.** Sem barrel exports (`index.ts`) para módulos internos. Importe direto do arquivo fonte.
4. **Sem magic strings.** Constantes nomeadas sempre. Nenhuma string hardcoded repetida em 2+ arquivos.
5. **Tipos canônicos em `<TYPES_DIR>`.** Front, back e main importam deste arquivo. Proibido redeclarar tipos já definidos lá.

---

## §2. Regras de filesystem e caminhos

6. **Cwd canônico = raiz do projeto (`<CWD_PATH>`).** NUNCA `cd <subdir>/`. Passe sempre o path completo.
7. **Arquivos em `files[]` são relativos à raiz.** Nunca corte prefixos.
8. **Diretórios sagrados:** `node_modules/`, `.git/`, `.harness/sprints/00-index.json` (leitura OK, escrita só via scripts). NUNCA toque sem instrução explícita.

---

## §3. Regras de execução de comandos (v6.3)

9. **TODO comando externo tem `timeout N`.** Default `timeout 90` para gates, `timeout 300` para installs. Se estourar = ERRO.
10. **Output bruto vai para ARQUIVO, nunca direto no chat.**  
    `cmd > /tmp/harness/<step>.log 2>&1` e ler `tail -20` do arquivo.
11. **Gates grep usam `-q` (quiet).** Sempre via scripts dedicados em `.harness/scripts/`.
12. **`npm install` automático** após cada sprint que mudou `package.json`.
13. **Context budget alarm.** Se tokens_used / context_window > 0.85, pause e compacte ANTES de gerar mais.

---

## §4. Post-write gates (parseability + imports)

Após cada escrita de arquivo, rode o parser nativo:

| Extensão | Comando |
|---|---|
| `.json` | `python3 -c "import json; json.load(open(r'<arquivo>'))"` |
| `.yaml/.yml` | `python3 -c "import yaml; yaml.safe_load(open(r'<arquivo>'))"` |
| `.py` | `python3 -m py_compile <arquivo>` |
| `.ts/.tsx` | `<TYPECHECK_CMD>` |
| `.js/.mjs` | `node --check <arquivo>` |

Exit code != 0 = arquivo corrompido. **Não reescreva por cima.** Use `git checkout <arquivo>` e refaça.

---

## §5. Lifecycle de features

14. **Marcar in-progress ANTES de editar** qualquer arquivo da feature.
15. **Gate de paths** antes de marcar done: `python3 .harness/scripts/gate-paths.py <sprint> <feat-id>`.
16. **Gate de consistência** (v6.4): `python3 .harness/scripts/gate-consistency.py <dir> <simbolo>`.
17. **Gate de imports** (v6.4): `python3 .harness/scripts/gate-import-resolve.py <arquivo>`.
18. **Gate de unused** (v6.4): `bash .harness/scripts/gate-unused.sh <arquivo.ts>`.
19. **Marcar done SÓ** depois que TODOS os gates passaram.

---

## §6. Pre-flight typecheck por sprint (v6.3)

A partir da Sprint 02, ANTES de qualquer feature:

```bash
timeout 90 <TYPECHECK_CMD> > /tmp/harness/typecheck_baseline.txt 2>&1
ERROR_COUNT=$(grep -c "error TS" /tmp/harness/typecheck_baseline.txt || echo 0)
echo "BASELINE_ERRORS=$ERROR_COUNT"
```

**BASELINE_ERRORS > 0 = PARE.** Não comece nova sprint com erros herdados.

---

## §7. Sprint Review Final (v6.5 — OBRIGATÓRIA)

A última sprint SEMPRE é a Sprint Review Final. Ela:
1. Roda `python3 .harness/scripts/audit-final.py`
2. Categoriza findings em 7 classes: CONSISTENCY / DEAD_CODE / SECURITY / ANTI_PATTERN / DUPLICATION / TODO / outros
3. Corrige todos os findings HIGH
4. Só fecha com HIGH = 0

**DONE só é permitido se `audit-final.py` retornar zero findings HIGH.**

---

## §8. Invariantes do projeto (REESCREVA para seu projeto)

> ⚠️ Esta seção é o ÚNICO bloco específico do projeto. Reescreva com 5-10 bullets dos invariantes da sua SPEC.

- Stack: React 19 + Vite + TailwindCSS v4 (frontend SPA) | Express/Node (server) | Supabase PostgreSQL (DB) | Groq/OpenAI SDK (AI). Deploy: Vercel + standalone server.
- Path alias: `@/*` → `./src/*` configurado em tsconfig.json + vite.config.ts. Importar componentes com `@/components/...`.
- Middleware de segurança obrigatório em todas as rotas Express: secureHeaders + csrfValidation + sanitizeInput + rateLimitMiddleware. Origem validada contra ALLOWED_ORIGINS.
- Admin auth via JWT (jsonwebtoken) + GitHub OAuth. Token assinado com NEXTAUTH_SECRET, expira 24h. ADMIN_EMAILS controla acesso.
- API routes carregadas via lazy dynamic import: `app.use("/api/...", (req,res,next) => import(...).then(m => m.default(...)))`.
- DB layer via Supabase client: `supabase` (anon key, supabaseClient.ts) e `supabaseAdmin` (service_role, supabaseAdmin.ts). NUNCA expor service_role ao frontend.
- Status de promessas normalizado em 4 valores: `cumprida` | `parcial` | `pendente` | `quebrada`. Mapeamento reverso para dados legados no ranking/cron.
- Metodologia 3 Camadas: C1 Promessas (40%), C2 Indicadores (35%), C3 Fatos Jurídicos (25%). Grade: A(80-100) B(60-79) C(40-59) D(20-39) F(0-19).
- Testes com Vitest em `tests/` (ambiente node, timeout 30s). Comando: `npm test`.
- Variáveis de ambiente lidas com dotenv/config no server e import.meta.env no frontend (Vite). Chaves Supabase obrigatórias: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

---

## §9. Padrões Express (v6.4)

20. **Factory functions para middlewares** com estado: `export function createAuthGuard(opts) { return (req, res, next) => {...} }`. Nunca export default de função já-chamada.
21. **Async handlers com wrapper:** `const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`. NUNCA `async (req, res) => {}` diretamente sem wrapper.
22. **Error handler global** como última rota: `app.use((err, req, res, next) => {...})`.

---

## §10. Regras de dependências

23. **Todas as deps declaradas em `package.json` antes de usar.** Gate `gate-import-resolve.py` pega deps não declaradas.
24. **Versões fixadas** (sem `^` ou `~`) em produção. Dev deps podem ter `^`.
25. **`@types/*` declarados em `devDependencies`**, não em `dependencies`.

---

## Anchored Summary — estado atual do vault (2026-06-09)

> Última atualização: 2026-06-09. Este bloco é lido automaticamente em toda sessão.

### Vault Obsidian (promessas/)

| Métrica | Valor |
|---------|-------|
| Total promessas | **5.402** |
| Políticos (arquivos únicos) | **34** |
| Estados (arquivos únicos) | **27** (26 + Brasil) |
| Categorias | **10** |
| Arquivos sem estado (órfãos) | **33** (preservados, fora dos índices) |

### O que foi feito até aqui

1. **Extração v1** (heurística básica): 5.713 candidatas de 25 PDFs estaduais
2. **Extração v2** (filtros de qualidade): 5.250 promessas limpas (remoção de slogans, ALL CAPS, URLs, truncados, seções, multi-linha)
3. **Importação Supabase**: +1.922 promessas via cron de ranking
4. **Normalização do vault** (09/06/2026):
   - 11 pares de políticos duplicados (com/sem acento) unificados → 34 únicos
   - 64 arquivos de estado (siglas + nomes) → 27 nomes completos
   - 3 categorias duplicadas (Educacao→Educação, Saude→Saúde, Seguranca→Segurança)
   - 1.732 backlinks quebrados → **0 órfãos**
   - Backlinks duplicados removidos (cada promessa tem uma seção única)
5. **Pipeline de sprints**: 11 sprints, 30 features, 100% concluído
6. **Auditoria final**: HIGH=0, MED=0, LOW=278 (strings literais duplicadas entre promessas — esperado)

### Graph View do Obsidian

| Grupo | Query | Cor (hex) |
|-------|-------|-----------|
| Promessas | `path:promessas` | #e0d452 (verde musgo) |
| Políticos | `path:politicos` | #625000 (roxo) |
| Estados | `path:estados` | #54d4e0 (ciano) |
| Categorias | `path:categorias` | #e052b8 (rosa) |
| Execuções | `path:execucoes` | #50d460 (verde) |
| Templates | `path:templates` | #5555ff (azul) |

### Ferramentas úteis

- `tmp/harness/query_vault.py` — CLI de consulta: `--estado SP --count`, `--politico "Paulo"`, `--search "hospit"`
- `00-INDEX.md` — sumário executivo com links para todos os políticos, estados e categorias
- `CONTEXTO.md` — inventário completo do vault

### Próximos passos sugeridos

1. Obter chave Groq/OpenAI/Gemini funcional para extração via IA (qualidade superior)
2. OCR do PDF do Amazonas (único estado sem texto extraído — PDF escaneado)
3. Investigar as 33 promessas sem campo `estado` no frontmatter
4. Normalizar nomes de políticos para usar acentos (ex: "Cláudio Castro" em vez de "Claudio Castro")
5. Rodar `node processar_planos.mjs` com chave válida para inserir promessas no Supabase
