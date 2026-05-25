# Harness v6.5 — AGENTS.md para OpenCode + DeepSeek V4 Flash

> Adaptado de HarnessQwen v6.5 para OpenCode + DeepSeek V4 Flash.
> Este arquivo é carregado automaticamente pelo OpenCode a cada sessão (padrão AGENTS.md).
> INVARIANTES — não alterar durante execução.


---

## Tokens preenchidos (substitui placeholders globais)

> ⚠️ **PREENCHA ESTE BLOCO ANTES DE RODAR `/develop` NO PROJETO NOVO.**

| Token | Valor real (PREENCHA) | Exemplo |
|-------|----------------------|---------|
| `<PROJECT_NAME>` | `<NOME-DO-PROJETO>` | `meu-app` |
| `<CWD_PATH>` | `<CAMINHO-ABSOLUTO-DA-RAIZ-DO-REPO>` | `/home/user/MeuApp/` |
| `<TYPECHECK_CMD>` | `<COMANDO-DE-TYPECHECK>` | `npm run typecheck` |
| `<TYPECHECK_NOTE>` | `<NOTAS-SOBRE-TYPECHECK>` | `monorepo com 3 tsconfigs` |
| `<TYPECHECK_GREP>` | `grep -c "error TS"` | (TypeScript) |
| `<DB_FILE_PATH>` | `<PATH-DO-DB-OU-OMITIR>` | `backend/db/client.ts` |
| `<TYPES_DIR>` | `<PATH-DOS-TIPOS-CANONICOS>` | `shared/types.ts` |
| `<SHELL>` | `bash` | (Linux/Mac) |
| `<TMP_DIR>` | `/tmp/harness/` | (deixe assim) |
| `<HARNESS_DIR>` | `.harness/` | (deixe assim) |
| `<SPEC_PATH>` | `SPEC.md` | (deixe assim) |
| `<RUN_CMD>` | `<COMANDO-PRA-RODAR-O-APP>` | `npm run dev` |
| `<TOTAL_SPRINTS>` | `<N>` | `12` |

**Após preencher:** `grep -n '<[A-Z_]*>' .antigravity/rules.md` deve retornar ZERO matches.

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

```bash
which pnpm uv node python3 git grep curl
node --version    # >= 20
python3 --version # >= 3.11
```

Se algum comando retornar vazio/erro: **PARE e reporte ao humano.** Não prossiga.

**IMPORTANTE:** Use sempre `python3` (nunca `python`). Ubuntu 24+ não tem `python` sem o 3.

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

Exemplos do que colocar aqui:
- Stack: TypeScript + Node.js + Express + SQLite
- Autenticação via JWT em header `Authorization: Bearer <token>`
- Todos os endpoints retornam `{ data, error }` — nunca throw direto para o cliente
- Variáveis de ambiente lidas APENAS em `config/env.ts`
- Frontend em React 18 com Vite — sem SSR

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
