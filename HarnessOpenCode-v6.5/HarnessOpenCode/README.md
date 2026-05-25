# HarnessOpenCode v6.5 — Para OpenCode + DeepSeek V4 Flash

> Adaptação do HarnessQwen v6.5 para **OpenCode** com **DeepSeek V4 Flash**.
> Mesma lógica de sprints, gates e scripts — estrutura ajustada para o OpenCode.

---

## O que mudou vs HarnessQwen original

| Componente | HarnessQwen (Cline) | HarnessOpenCode (OpenCode) |
|---|---|---|
| Rules do agente | `.clinerules/clinerules.md` | `AGENTS.md` na raiz ✅ |
| Workflow de sprints | `.clinerules/workflows/develop.md` | `.harness/workflows/develop.md` ✅ |
| Configuração da ferramenta | — | `opencode.json` ✅ |
| Scripts de gate | `.harness/scripts/` | `.harness/scripts/` (igual) ✅ |
| Sprints JSON | `.harness/sprints/` | `.harness/sprints/` (igual) ✅ |

---

## Como usar (3 passos)

### Passo 1 — Copie para a raiz do seu projeto

```bash
PROJ=~/Desktop/MeuProjeto

cp AGENTS.md                   "$PROJ"/
cp opencode.json               "$PROJ"/
cp -r .harness                 "$PROJ"/
cp -r docs                     "$PROJ"/
cp -r templates                "$PROJ"/

cd "$PROJ"
mkdir -p /tmp/harness/
chmod +x .harness/scripts/*.sh .harness/scripts/*.py
```

### Passo 2 — Preencha os tokens

Edite **`AGENTS.md`** na raiz:
- Preencha a tabela de tokens (`<PROJECT_NAME>`, `<CWD_PATH>`, `<TYPECHECK_CMD>`, etc.)
- Reescreva a **§8 Invariantes do projeto** com os bullets do SEU projeto

Edite **`.harness/workflows/develop.md`**:
- Preencha a mesma tabela de tokens

Crie **`SPEC.md`** a partir de `templates/SPEC-TEMPLATE.md`.

Crie as sprints em **`.harness/sprints/`** a partir de `templates/SPRINT-TEMPLATE.md`.

Crie **`.harness/sprints/00-index.json`** listando todas as sprints.

```bash
echo "00-bootstrap.json" > .harness/current.txt
```

Valide que não sobrou placeholder:
```bash
grep -nE '<[A-Z_]+>' AGENTS.md .harness/workflows/develop.md
# Deve retornar ZERO matches
```

### Passo 3 — Inicie o OpenCode e cole o workflow

Abra o OpenCode na pasta do projeto:

```bash
cd MeuProjeto
opencode
```

No chat, cole o conteúdo de `.harness/workflows/develop.md` ou simplesmente escreva:

```
Leia o arquivo .harness/workflows/develop.md e execute o workflow descrito nele.
```

O DeepSeek V4 Flash vai executar todas as sprints em autopilot até `current.txt == "DONE"`.

---

## Como o OpenCode carrega as configurações

- **`AGENTS.md`** na raiz → carregado automaticamente pelo OpenCode a cada sessão, sem nenhuma configuração extra. São as "system instructions" do agente para o projeto.
- **`opencode.json`** → aponta para o `AGENTS.md` e o workflow, e define o modelo padrão como DeepSeek.
- **`.harness/scripts/`** → executados pelo agente via terminal (o OpenCode tem acesso ao bash do projeto).

---

## Validação antes de rodar

```bash
# Estrutura existe?
test -f AGENTS.md && test -f opencode.json && test -d .harness/sprints && test -f SPEC.md && echo "STRUCT OK"

# Sprints parseavéis?
python3 -c "
import json, os
for f in sorted(os.listdir('.harness/sprints')):
    if not f.endswith('.json'): continue
    try:
        data = json.load(open(f'.harness/sprints/{f}'))
        print(f'  {f}: features={len(data.get(\"features\",[]))}')
    except Exception as e:
        print(f'  {f}: ERROR {e}')
"

# Status das sprints
python3 .harness/scripts/sprint-status.py
```

---

## Stack suportada

- ✅ TypeScript / JavaScript (Node.js, Vite, Next.js, Express, Fastify)
- ✅ Python (FastAPI, Django, scripts)
- ✅ Bun / Deno (com ajustes de comandos)
- ⚠️ Go, Rust — adapte os gates de typecheck/lint
