# AIFeast CLI — Contexto Master para IAs

> Cole este arquivo no início de qualquer conversa com qualquer IA.
> Ela vai entender o projeto imediatamente sem perguntas.

---

## O que é o projeto

**AIFeast CLI** é um coding agent de terminal (igual ao OpenCode / Claude Code) feito em **TypeScript + Node.js + Ink (React no terminal)**. O usuário roda `aifeast` no terminal e interage com uma IA que lê arquivos, escreve código, executa comandos e navega no projeto — tudo dentro de um loop agêntico automatizado. Multi-provider: suporta Groq (grátis), Gemini (grátis), Ollama (local), Anthropic, OpenAI, etc.

**Repositório:** `github.com/ademilsonls81-oss/AI-Feast-Engine`  
**Pasta do CLI:** `/cli` — IGNORAR tudo fora desta pasta (tem um site React/Vite na raiz que não é o foco)

---

## Stack técnica

```
Runtime:      Node.js 18+ com TypeScript
TUI:          Ink 5 (React no terminal) + ink-text-input + ink-spinner
CLI:          Commander
Config:       Conf (persiste em ~/.aifeast/)
HTTP:         Axios
Build:        tsc com nodenext + "type": "module"
Providers:    Groq, Gemini, Alibaba, Ollama, OpenRouter, Anthropic, OpenAI
```

---

## Estrutura de arquivos (só o que importa)

```
/cli
├── package.json
├── tsconfig.json
├── dist/                    ← build compilado
└── lib/
    ├── ai.ts                ← callAI, streamAI, callAIWithMessages
    ├── chat-engine.ts       ← loop agêntico + slash commands + ChatState
    ├── config.ts            ← providers, chaves API, Conf store
    ├── model-registry.ts    ← lista de todos os modelos disponíveis
    ├── tools.ts             ← 6 ferramentas + parseToolCalls + buildSystemPrompt
    ├── tui.tsx              ← entry point da TUI, carrega agentes de .agent/*.json
    └── ui/
        ├── App.tsx          ← gerencia welcome/conversa, subscribe no ChatEngine
        ├── HistoryList.tsx  ← logo ASCII + histórico de mensagens + spinner
        ├── InputArea.tsx    ← input com menu / navegável, welcomeMode, shell mode
        ├── ModelSelector.tsx← seletor de modelos com busca fuzzy e navegação ↑↓
        └── Sidebar.tsx      ← tokens, % contexto, custo, LSP status

/cli/.agent/
    ├── arquiteto.json       ← { "systemPrompt": "..." }
    ├── dev.json
    └── money.json
```

---

## Como buildar e rodar

```bash
cd cli
npm install
npm run build          # compila TypeScript → dist/
node dist/index.js     # roda direto
aifeast                # alias no PowerShell profile (Windows)
```

---

## Arquitetura do loop agêntico

```
usuário digita mensagem
    ↓
ChatEngine.sendMessage(msg)
    ↓
callAIWithMessages(messages, { systemPrompt })
    ↓
parseToolCalls(response.content)  ← formato XML: <tool>NOME</tool><args>JSON</args>
    ↓
se tem tool calls:
    executa tool → injeta resultado como mensagem "user"
    repete loop
se não tem tool calls:
    exibe resposta final
```

**6 ferramentas disponíveis:**
- `read_file` — lê arquivo
- `write_file` — cria/sobrescreve arquivo
- `patch_file` — substitui trecho específico
- `list_files` — lista com glob (máx 100)
- `search_in_files` — busca texto (máx 50 arquivos)
- `run_command` — executa shell (timeout 30s)

---

## Interface (TUI)

**Welcome screen** (sem mensagens):
- Logo ASCII centralizado (cyan, 6 linhas)
- Input real centralizado (width=60)
- Menu `/` com navegação ↑↓ e Tab autocomplete
- Status bar: `Build · modelo · provider Zen`

**Conversation screen** (após enviar mensagem):
- Histórico de mensagens à esquerda (flexGrow=1)
- Sidebar à direita (width=30) com tokens, custo, LSP
- Input na parte inferior (full width)
- Spinner animado durante processamento

**Transição:** controlada por `hasMessages` no `App.tsx`

---

## ChatState (estado da aplicação)

```typescript
interface ChatState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentAgent: string;   // nome do agente ativo
  currentModel: string;   // ex: "llama-3.3-70b-versatile"
  isThinking: boolean;    // true durante geração
  tokens: { input: number; output: number };
}
```

---

## Slash commands implementados

| Comando | O que faz |
|---------|-----------|
| `/help` | Lista comandos |
| `/clear` | Limpa histórico |
| `/status` | Mostra provider, modelo, agente |
| `/agent <nome>` | Troca agente (limpa histórico) |
| `/model <nome>` | Troca modelo atual |
| `/connect <provider> <apiKey>` | Conecta provider |
| `/connect ollama` | Ativa modo local |

---

## Providers suportados

| Provider | Env var | Modelo default | Grátis |
|----------|---------|---------------|--------|
| groq | GROQ_API_KEY | llama-3.3-70b-versatile | ✅ |
| gemini | GEMINI_API_KEY | gemini-1.5-flash | ✅ |
| alibaba | ALIBABA_API_KEY | qwen-plus | ✅ |
| ollama | — | llama3.2 | ✅ local |
| openrouter | OPENROUTER_API_KEY | google/gemini-2.5-flash | ❌ |
| anthropic | ANTHROPIC_API_KEY | claude-3-5-sonnet-20241022 | ❌ |
| openai | OPENAI_API_KEY | gpt-4o-mini | ❌ |

---

## ✅ O que já funciona

- TUI renderizando no terminal via Ink
- Logo ASCII pixel art centralizado
- Welcome screen com input real centralizado
- Menu `/` com navegação ↑↓ e Tab autocomplete
- Dois modos: welcome / conversa com transição
- Sidebar com tokens, % contexto, custo, LSP
- Status bar Build · modelo · provider Zen
- Loop agêntico com 6 tools via XML parsing
- Multi-provider com fallback
- Agentes carregando de `.agent/*.json`
- ModelSelector com busca fuzzy
- Build funcionando com nodenext + "type": "module"
- Alias `aifeast` no PowerShell

---

## 🔴 Bugs conhecidos (próximos a corrigir)

1. **Transição welcome → conversa** não está funcionando corretamente (sidebar não aparece)
2. **Menu `/` navegação ↑↓** pode não estar funcionando no terminal real
3. **Sidebar tokens** pode não estar atualizando durante conversa
4. **Scroll** do histórico em conversas longas
5. **Agentes** podem não estar carregando de `.agent/*.json`
6. `/agent <nome>` pode não estar trocando corretamente

---

## ⏳ Próximo passo EXATO (começar aqui)

**FASE 1 — Corrigir os bugs acima um por um:**

1. Testar: digitar mensagem → verificar se muda para conversation screen + sidebar aparece
2. Testar: digitar `/` → verificar se menu aparece e ↑↓ funcionam
3. Testar: enviar mensagem → verificar se tokens na sidebar atualizam
4. Testar: conversa longa → verificar scroll
5. Testar: `/agent dev` → verificar se troca o agente

**Após Fase 1 → Fase 2: streaming de tokens em tempo real**
(exibir texto enquanto IA responde, não aguardar resposta completa)

---

## Referência: OpenCode (o projeto que inspirou o AIFeast)

O AIFeast é uma versão do OpenCode (github.com/anomalyco/opencode) feita em TypeScript + Ink.
O OpenCode usa TypeScript + opentui (framework próprio em Zig).
Serve como referência de features a implementar.

---

## Roadmap completo — 15 Fases

> Legenda: ✅ Concluído | 🔴 Em andamento | ⏳ Próximo | 🔲 Futuro

### FASE 1 — Bug fixes urgentes 🔴
- ✅ Transição welcome → conversa (sidebar deve aparecer ao enviar msg)
- ✅ Menu `/` navegação ↑↓ no terminal real
- 🔴 Sidebar tokens atualizando durante conversa
- 🔴 Scroll do histórico em conversas longas
- 🔴 Agentes carregando de `.agent/*.json`
- 🔴 `/agent <nome>` trocando agente corretamente

### FASE 2 — Core do loop agêntico 🔲
- 🔲 Streaming real — exibir tokens enquanto IA responde (não aguardar completo)
- 🔲 Persistência de sessões em SQLite (`~/.aifeast/sessions.db`)
- 🔲 `/sessions` — listar e retomar sessões anteriores
- 🔲 `/new` — nova sessão preservando texto do input
- 🔲 Ctrl+C durante geração — abortar sem fechar o app (AbortController)
- 🔲 Auto-título da sessão gerado pela IA em background
- 🔲 Limite de steps por agente (`agent.steps`)
- 🔲 Context compaction automática quando tokens se aproximam do limite

### FASE 3 — Input avançado 🔲
- 🔲 Shell mode — `!` no início executa bash direto (border muda de cor)
- 🔲 `@arquivo` — autocomplete de arquivos do projeto com fuzzy search
- 🔲 `@arquivo#10-25` — referenciar linhas específicas
- 🔲 `@agente` — invocar subagente inline
- 🔲 Histórico de prompts navegável com ↑/↓ no input vazio
- 🔲 Ctrl+P — Command Palette com busca fuzzy em todos os comandos
- 🔲 Keybinds Emacs: Ctrl+A, Ctrl+E, Ctrl+K, Ctrl+U, Ctrl+W
- 🔲 Shift+Enter — input multilinha
- 🔲 Prompt stash — `/stash`, `/stash pop`, `/stash list`

### FASE 4 — TUI layout e navegação 🔲
- 🔲 Header com título da sessão (toggle)
- 🔲 Toggle sidebar com keybind (Ctrl+B)
- 🔲 Todo list na sidebar — atualizada em tempo real pelo agente
- 🔲 Page Up/Down no histórico
- 🔲 `g`/`G` — pular para primeira/última mensagem
- 🔲 Auto-scroll e sticky scroll ao receber streaming
- 🔲 Diff viewer — mostrar diffs de arquivos editados com cores +/-
- 🔲 Tool calls collapsible — mostrar/ocultar detalhes
- 🔲 Reasoning blocks — mostrar/ocultar blocos `<thinking>`
- 🔲 Code blocks com syntax highlighting
- 🔲 Timestamps por mensagem (toggle com `/timestamps`)
- 🔲 Copiar última resposta com keybind
- 🔲 Tokens por mensagem individualmente
- 🔲 Indicador de retry quando IA está retentando

### FASE 5 — Agentes e permissões 🔲
- 🔲 Sistema de permissões: allow / deny / ask por tool
- 🔲 Perguntar antes de executar `run_command` — exibir comando + confirmar
- 🔲 Proteção de arquivos `.env` — pedir permissão antes de ler
- 🔲 Agente `plan` — modo read-only, nega edições por padrão
- 🔲 Agente `explore` — subagente rápido read-only
- 🔲 Tab no input vazio — ciclar entre agentes
- 🔲 `AGENTS.md` — detectar e injetar no system prompt automaticamente
- 🔲 `/init` — analisar projeto e gerar `AGENTS.md`
- 🔲 Agentes em `.opencode/agents/*.md` (frontmatter YAML + corpo = prompt)

### FASE 6 — Tools avançadas 🔲
- 🔲 `grep` tool — wrapper do ripgrep
- 🔲 `glob` tool — listar arquivos com glob patterns
- 🔲 `webfetch` tool — buscar conteúdo de URLs
- 🔲 `websearch` tool — busca na web
- 🔲 Staleness check no edit — verificar se arquivo mudou desde a última leitura
- 🔲 Diff como metadata antes de aplicar patch
- 🔲 `todo_write` / `todo_read` tools — lista de tarefas da sessão
- 🔲 `task` tool — delegar subtarefa para subagente

### FASE 7 — Slash commands avançados 🔲
- 🔲 `/sessions` — listar/retomar sessões
- 🔲 `/new` — nova sessão
- 🔲 `/rename` — renomear sessão
- 🔲 `/fork` — bifurcar conversa a partir de mensagem
- 🔲 `/compact` — compactar contexto manualmente
- 🔲 `/undo` — reverter última mensagem (restaura texto no input)
- 🔲 `/redo` — refazer última reversão
- 🔲 `/export` — exportar transcript como `.md`
- 🔲 `/timestamps` — toggle timestamps
- 🔲 `/thinking` — toggle reasoning blocks
- 🔲 `/copy` — copiar transcript completo
- 🔲 `/themes` — seletor de tema
- 🔲 `/editor` — abrir `$EDITOR` com texto do input
- 🔲 `/skills` — listar e selecionar skills
- 🔲 `/review` — template de code review
- 🔲 `exit`, `quit`, `:q` — sair sem `/`

### FASE 8 — LSP (Language Server Protocol) 🔲
- 🔲 Inicializar LSP servers automaticamente por linguagem detectada
- 🔲 Diagnósticos LSP como tool (erros/warnings no contexto)
- 🔲 Code navigation via LSP (go-to-definition, find-references)
- 🔲 Auto-formatação após editar (Prettier, Black, gofmt)
- 🔲 Status LSP servers na sidebar

### FASE 9 — Sistema de temas 🔲
- 🔲 `~/.aifeast/tui.json` — config de tema
- 🔲 Paleta de cores customizável
- 🔲 `/themes` — seletor com preview
- 🔲 Temas: dark, light, dracula, nord, gruvbox
- 🔲 Detecção automática de tema do terminal

### FASE 10 — Configuração avançada 🔲
- 🔲 `opencode.json` / `.aifeast/config.json` por projeto
- 🔲 `instructions` — instruções extras no system prompt por projeto
- 🔲 Permissões por projeto no config
- 🔲 Carregar `.env` do CWD automaticamente

### FASE 11 — MCP Integration 🔲
- 🔲 Conectar a MCP servers externos
- 🔲 Tools do MCP aparecem automaticamente para o agente
- 🔲 Comandos do MCP no autocomplete `/`
- 🔲 `/mcps` — ativar/desativar MCP servers
- 🔲 OAuth MCP

### FASE 12 — Skills system 🔲
- 🔲 `~/.aifeast/skills/` — pasta de skills em markdown
- 🔲 `/skills` — dialog para selecionar skill
- 🔲 `skill` tool para o agente executar skills

### FASE 13 — Provider e Model avançado 🔲
- 🔲 `/connect` como dialog TUI interativo (não linha de comando)
- 🔲 Salvar auth em `~/.aifeast/auth.json`
- 🔲 Modelos favoritos + ciclar com keybind
- 🔲 Model variants (ex: claude com thinking)
- 🔲 Amazon Bedrock, Azure OpenAI, GitHub Copilot, DeepSeek, LM Studio

### FASE 14 — Revert / Undo system 🔲
- 🔲 Git snapshot antes de editar arquivos
- 🔲 `/undo` — reverter arquivos da última mensagem
- 🔲 `/redo` — refazer reversão
- 🔲 Diff visual das mudanças revertidas

### FASE 15 — Export e sharing 🔲
- 🔲 `/export` — salvar transcript como `.md` com opções
- 🔲 `/share` — gerar URL pública (requer backend)
- 🔲 `/copy` — copiar transcript para clipboard

---

## Tabela de prioridade

| Fase | Impacto | Complexidade | Quando |
|------|---------|-------------|--------|
| 1 — Bug fixes | 🔴 Crítico | Baixa | Agora |
| 2 — Loop agêntico | 🔴 Alto | Alta | Semana 1 |
| 3 — Input avançado | 🟠 Alto | Média | Semana 2 |
| 4 — TUI/Layout | 🟠 Alto | Média | Semana 2 |
| 5 — Agentes/Permissões | 🟡 Médio | Média | Semana 3 |
| 6 — Tools avançadas | 🟡 Médio | Média | Semana 3 |
| 7 — Slash commands | 🟡 Médio | Baixa | Semana 3 |
| 8 — LSP | 🟢 Baixo | Muito alta | Mês 2 |
| 9-15 — Features avançadas | 🔵 Nice to have | Alta | Mês 2+ |

---

## Regras para a IA que está lendo isso

1. **Nunca** mencionar Tailwind, Supabase, Layout.tsx, localhost — não existem neste projeto
2. **Sempre** trabalhar dentro de `/cli/lib/` — ignorar `/src`, `/public`, `vite.config.ts`
3. **Nunca** criar arquivos na raiz — tudo vai em `/cli/lib/` ou `/cli/lib/ui/`
4. Quando for editar, sempre mostrar o arquivo completo corrigido
5. Quando tiver dúvida, perguntar antes de assumir
6. O projeto compila com `nodenext` — todos os imports precisam ter `.js` no final
7. Ink não suporta todos os recursos do React — evitar hooks complexos

