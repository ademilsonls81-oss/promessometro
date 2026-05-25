# Licoes v6.3 -> v6.4 (genericas, stack-agnostic)

> Memoria institucional dos anti-patterns + bugs detectados durante execucao
> do harness Cline + LLM local de tamanho medio (~27B) em projeto TS/Node.
>
> **Foco:** principios e fixes que funcionam em QUALQUER projeto futuro,
> independente da stack (Electron, web, API pura, CLI, etc).

---

## Por que esse documento existe

Toda vez que um projeto e desenvolvido com agent + LLM local, surgem
classes recorrentes de bugs e travas. Sem memoria institucional, cada
projeto re-descobre as mesmas armadilhas. Este doc consolida as causas
raiz por categoria + o fix concreto aplicado em v6.4, de forma que possa
ser aplicado direto no proximo projeto.

---

## Classes de bug recorrentes em agent + LLM medio

### Classe A — Bugs de inconsistencia cross-file

**Sintoma:** mesmo simbolo (funcao, variavel, constante) usado de jeitos
diferentes em arquivos diferentes do projeto. Modelo medio nao compara
N arquivos simultaneamente; copia padrao errado de um arquivo pra outro.

**Exemplos:**
- Factory function chamada como `fn(arg)` em metade dos arquivos e como
  `fn` (sem chamar) na outra metade. Resultado: middleware nao executa,
  request orfao trava ate timeout.
- Mesmo path relativo escrito como `'../../../foo'` em um arquivo e
  `'../../foo'` em outro (apenas um esta correto).
- Constante importada em vez de literal duplicado, mas em apenas alguns
  lugares.

**Por que LLMs medios falham:** nao tem janela de atencao grande o
suficiente pra cruzar 5-10 arquivos da sprint atual. Decisao tomada
em arquivo N nao influencia arquivo N+3.

**Fix v6.4:**
- `gate-consistency.py <dir> <symbol>` — detecta uso heterogeneo
- AC obriga: "factory X DEVE ser chamada com `(arg)` em todos os lugares"
- Hints em features de middleware/factory: enumerar todos os arquivos
  consumidores e o padrao canonico

### Classe B — Bugs de path resolution

**Sintoma:** `from '<path>'` aponta pra arquivo que nao existe.

**Por que LLMs medios falham:** aritmetica de paths relativos
(`../`, `../../`, `../../../`) e essencialmente "matematica de string".
Modelos medios contam errado quantos `../` precisam.

**Fix v6.4:**
- `gate-import-resolve.py <file>` — para cada `from '...'`, tenta
  resolver no disco. Falha = path invalido.
- Roda automatico apos cada feature que modifica arquivos TS.

### Classe C — Bugs de unused imports/vars (TS strict)

**Sintoma:** tsc reclama `TS6133 declared but never used` ou
`TS6196 declared but never used`. So aparece no tsc -b final, depois
de N features prontas.

**Por que LLMs medios falham:** geram imports/vars "por costume"
sem reler se realmente usaram. TS strict (`noUnusedLocals: true`)
pega, mas tarde demais.

**Fix v6.4:**
- `gate-unused.sh <files-da-feature>` — roda tsc isolado por arquivo
  com `--noUnusedLocals --noUnusedParameters`. Falha cedo, na propria
  feature, em vez de acumular pra final.

### Classe D — Bugs de async error handling

**Sintoma:** rota async lanca erro, mas request fica orfao (cliente
trava ate timeout, nenhuma resposta enviada).

**Por que LLMs medios falham:** conhecimento sutil "Express 4 NAO
captura async errors automaticamente". Em outras frameworks (Koa,
Fastify, Express 5+) funciona; modelo confunde.

**Patterns proibidos:**
```typescript
// FAIL silencioso em Express 4
router.post('/x', async (req, res) => { await stuff(); res.json(r); });
```

**Patterns permitidos:**
```typescript
// 1. wrapper inline
router.post('/x', (req, res, next) => {
  (async () => { ... res.json(r); })().catch(next);
});

// 2. helper asyncHandler
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 3. middleware global
import 'express-async-errors';  // no topo de server.ts
```

**Fix v6.4:**
- Regra em clinerules §24.b (PROIBIDO async naked em rota Express 4)
- Grep gate: `grep -E 'router\.(get|post|...)\([^,]+,\s*async \(' routes/`
  deve dar 0 ou ter wrapper visivel

### Classe E — Bugs de ordem de inicializacao

**Sintoma:** script tenta usar recurso (arquivo, env var, DB) ANTES
de inicializar.

**Exemplo classico:** script de smoke le arquivo gerado pelo bootstrap
ANTES de chamar o bootstrap.

**Por que LLMs medios falham:** pensam linearmente "preciso de X pra
fazer Y", esquecendo que Y CRIA o X.

**Fix v6.4:**
- AC explicito em features de smoke: "ordem: boot → fetch dependencia →
  consumir dependencia"
- Hints: pre-condicoes vs post-condicoes claramente separadas

### Classe F — Bugs de state persistente entre execucoes

**Sintoma:** smoke passa na primeira execucao, falha na segunda. OU
testes silenciosamente usam state antigo (DB de execucao anterior).

**Causa raiz:** path default (e.g. `~/.app/db.sqlite`) persiste entre
runs. State antigo + novo conflitam.

**Fix v6.4:**
- Smokes SEMPRE usam path efemero: `/tmp/smoke-<timestamp>.db`
- Setado via env var ANTES de qualquer import do modulo que usa
- Cleanup no `finally`

### Classe G — Travas por context overflow (LLM local)

**Sintoma:** LLM trava por longos periodos (5h+) gerando tokens
infinitos OU sem progresso.

**Causa raiz:** contexto enche silenciosamente (output de gates,
heredoc bash, dumps de grep). Acima de 85% da janela, modelo comeca
a degradar drasticamente.

**Fix v6.4:**
- TODO comando externo tem `timeout N` explicito
- Gates retornam UMA linha (`OK` ou `FAIL`), nao dump
- Output bruto vai pra arquivo: `cmd > /tmp/log.txt 2>&1; tail -20`
- Regra: ao detectar contexto > 85%, parar e pedir `/compact`

### Classe H — Bugs de infra (Cline + LLM local + VSCode)

**Sintomas variados:**
- "Shell Integration Unavailable" intermitente
- Cline mostra "Running" mas LLM ja respondeu (deadlock)
- Pede confirmacao humana entre features mesmo em "autopilot"

**Causa raiz:** defaults do Cline assumem cenario API + IDE bem
configurado. LLM local + shell zsh com plugins pesados quebra
varios assumptions.

**Fix v6.4 (configs Cline):**
| Setting | Valor obrigatorio |
|---------|-------------------|
| Terminal Execution Mode | **Background Exec** (zero dependencia de shell integration) |
| Shell integration timeout | 30s (default 4s e ridiculo) |
| Aggressive terminal reuse | OFF |
| Yolo Mode | ON |
| Auto Compact | ON |
| Double-Check Completion | ON |

---

## Anti-patterns no PROPRIO harness (bugs de "shell scripting trivial")

Lembrete: gates sao CODIGO. Bugs no harness sao tao caros quanto bugs
no projeto. Lista do que NAO fazer:

### A1. Gates como heredoc bash multi-line inline

```bash
# RUIM — gera 'for>' 'for for>' 'for for then>' no contexto
for PATTERN in pat1 pat2 ...; do
  for FILE in file1 file2 ...; do
    if ! grep -qE "$PATTERN" "$FILE"; then ...
    fi
  done
done
```

Cada `for>` que aparece e um token poluindo contexto. 11 patterns × N
arquivos = ~30+ linhas de prompts bash matchados pelo LLM. Trava.

**Correto:** chamar script em arquivo:
```bash
bash .harness/scripts/gate-X.sh <args>  # output: 1 linha
```

### A2. Logica AND quando deveria ser OR (ou vice-versa)

```bash
# RUIM — exige cada pattern em CADA arquivo
for PATTERN in ...; do
  for FILE in ...; do
    grep "$PATTERN" "$FILE" || FAIL
  done
done

# CORRETO — exige cada pattern em PELO MENOS UM arquivo (OR)
for PATTERN in ...; do
  FOUND=0
  for FILE in ...; do
    grep "$PATTERN" "$FILE" && FOUND=1 && break
  done
  [[ $FOUND -eq 0 ]] && FAIL
done
```

Sempre escrever a semantica esperada em comentario no gate. Testar
com caso conhecido bom + caso conhecido ruim.

### A3. Output bruto direto no chat

```bash
# RUIM — cada match imprime linha completa
grep -E "padrao" arquivo.ts && echo OK || echo FAIL
```

Mesmo o grep com 1 match imprime a linha inteira. Multiplique por N
arquivos × N padroes. Catastrofe.

**Correto:** `grep -qE` (silent) + reportar so OK/FAIL:
```bash
grep -qE "padrao" arquivo.ts && echo OK || echo FAIL
```

### A4. Contar SKIPPED como FAIL (ou vice-versa)

Em smoke reports, distinga 3 estados: PASS, FAIL, SKIPPED. NAO
agregue. Skip de step opcional nao e falha.

---

## Os 5 principios que eu queria saber antes

1. **Gates sao codigo — precisam teste antes de shipar.** Tratar shell
   scripting de gate como "trivial" introduziu 3 bugs no v6.3.

2. **Output bruto NUNCA vai pro contexto.** Sempre `grep -q` (exit code
   apenas) ou redirect pra arquivo + `tail -20`.

3. **Modelos medios precisam de "rails" extra.** Os 20% que faltam pra
   modelo top-tier sao patterns sutis (factory vs middleware, async
   wrapper, paths relativos). Compensar com gates especificos.

4. **Smoke cedo > smoke tarde.** Cada sprint que "sobe stack" (auth, DB,
   integracao externa) deve ter smoke proprio na sprint. Sem isso,
   bugs acumulam 5+ sprints antes de aparecer.

5. **Infra de execucao e tao critica quanto o agente.** Shell
   integration timeout, terminal reuse, output limit do Cline — tudo
   isso tem que estar configurado direito. Background Exec e
   nao-negociavel pra LLM local.

---

## Quando vale pagar API vs usar LLM local

| Cenario | Recomendacao |
|---------|--------------|
| Projeto < 30 features, prototipo, dev pessoal | LLM local. Tempo de fix manual (~30min) e aceitavel. |
| Projeto > 60 features, producao real, deadline curto | API paga. Bugs sutis pioram exponencialmente com tamanho. |
| Codigo critico (auth, payment, security, infra) | API paga. Erros sutis sao caros. |
| Iteracao rapida com muitas tentativas | LLM local. Sem custo por token. |
| Dados sensiveis (NDA, healthcare, etc) | LLM local. Privacy. |
| Stack obscura ou recente (< 1 ano) | API paga. LLM local nao foi treinado nela. |

Custo aproximado por projeto medio (~60 features via API):
- Claude Sonnet: ~$15-30
- GPT-4 series: ~$10-25
- DeepSeek/menores: ~$3-10 (qualidade similar ao Qwen local)

---

## Pattern: Sprint Review Final (v6.5)

Causa raiz que ESTE pattern resolve: LLM medio nao consegue revisar 60+
arquivos simultaneamente. Mesmo com gates per-feature, bugs sutis
sobrevivem ate o smoke final.

**Solucao:** ultima sprint do pipeline e dedicada a revisao categorizada.

**Template:** `.harness/sprints/REVIEW-TEMPLATE.json` (copie + numere para
o fim do seu pipeline). 5 features, cada uma consumindo UMA categoria:

| Feature | Consome categoria | Foco |
|---------|-------------------|------|
| feat-001 | CONSISTENCY | simbolos cross-file + paths errados |
| feat-002 | DEAD_CODE | unused imports/vars + arquivos orfaos |
| feat-003 | SECURITY | secrets hardcoded, logs sensiveis, defaults framework |
| feat-004 | ANTI_PATTERN | Express async-naked, prepared top-level, innerHTML |
| feat-005 | DUPLICATION + TODO + smoke final | extrai constantes, remove TODOs, gera release notes |

**Script:** `.harness/scripts/audit-final.py` faz scan abrangente e gera
relatorio em `/tmp/harness/audit-final.json` com findings
categorizados por severidade (HIGH/MED/LOW).

**Regra dura:** zero findings `HIGH` antes de marcar DONE no workflow.

**Performance:** roda em ~10-30s pra projeto medio. Custo negligible
versus o valor de pegar bugs sutis ANTES do humano abrir o app.

---

## Checklist pre-execucao do proximo projeto

Antes de rodar `/develop` em projeto novo:

- [ ] Cline settings: **Background Exec** + Yolo + Auto Compact + timeout 30s
- [ ] LM Studio: context window >= 128k carregado e responsivo
- [ ] `nvidia-smi` saudavel, VRAM livre suficiente
- [ ] `.clinerules/clinerules.md` + `workflows/develop.md` na ultima versao
- [ ] `.harness/scripts/` com todos os gates (incluindo v6.4: positive/negative/consistency/import-resolve/unused)
- [ ] Sprint 01 feat-001 declara TODAS as deps + `@types/*` upfront
- [ ] Smoke incremental por classe de funcionalidade (auth → DB → integracoes → renderer)
- [ ] Cwd canonico definido na SPEC
- [ ] Tokens cross-sprint constantes em arquivo unico (SPEC §3.8 pattern)
- [ ] Sprint JSONs validados (parse OK, sem em-dash/smart-quotes)
- [ ] **Sprint Review Final adicionada ao pipeline** (`cp REVIEW-TEMPLATE.json <N>-final-review.json`)
- [ ] `audit-final.py` presente em `.harness/scripts/`
- [ ] Workflow develop.md menciona audit-final.py como gate de encerramento
