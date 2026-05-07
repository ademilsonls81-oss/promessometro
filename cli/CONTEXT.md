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

```Runtime:      Node.js 18+ com TypeScript
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
├── tsconfig.json
├── dist/                    ← build compilado
└── lib/
    ├── ai.ts                ← callAI, streamAI, callAIWithMessages
    ├── chat-engine.ts       ← loop agêntico + slash commands + ChatState
    ├── config.ts            ← providers, chaves API, Conf store
    ├── model-registry.ts     ← lista de todos os modelos disponíveis
    ├── tools.ts              ← 6 ferramentas + parseToolCalls + buildSystemPrompt
    ├── tui.tsx              ← entry point da TUI, carrega agentes de .agent/*.json
    └── ui/
        ├── App.tsx           ← gerencia welcome/conversa, subscribe no ChatEngine
        ├── HistoryList.tsx   ← logo ASCII + histórico de mensagens + spinner
        ├── InputArea.tsx      ← input com menu / navegável, welcomeMode, shell mode
        ├── ModelSelector.tsx← seletor de modelos com busca fuzzy e navegação ↑↓
        └── Sidebar.tsx       ← tokens, % contexto, custo, LSP status
    ├── dev.json
    └── money.json
```

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

## 🔴 Bugs conhecidos (em correção)

1. **Transição welcome → conversa** não está funcionando corretamente (sidebar não aparece)
   - Status: ✅ CORRIGIDO
   - Correção: Layout simplificado no App.tsx com input centralizado no modo welcome
2. **Menu `/` navegação ↑↓** pode não estar funcionando no terminal real
   - Status: 🔴 PENDENTE
3. **Sidebar tokens** pode não estar atualizando durante conversa
   - Status: 🔴 PENDENTE
4. **Scroll** do histórico em conversas longas
   - Status: 🔴 PENDENTE
5. **Agentes** podem não estar carregando de `.agent/*.json`
   - Status: 🔴 PENDENTE
6. `/agent <nome>` pode não estar trocando corretamente
   - Status: 🔴 PENDENTE

---

## ⏳ Próximo passo EXATO

**FASE 1 — Correção de bugs críticos:**

1. 🔴 CORRIGINDO: Testar transição welcome → conversa
   - Executar `aifeast` e digitar mensagem
   - Verificar se sidebar aparece
   - Se não aparecer, debugar hasMessages no App.tsx

2. ⏳ Pendente: Menu `/` navegação ↑↓
3. ⏳ Pendente: Sidebar tokens atualização
4. ⏳ Pendente: Scroll em conversas longas
5. ⏳ Pendente: Agentes carregando
6. ⏳ Pendente: /agent swap

**Após Fase 1 → Fase 2:** streaming de tokens em tempo real

---

## Referência: OpenCode (o projeto que inspirou o AIFeast)

O AIFeast é uma versão do OpenCode (github.com/anomalyco/opencode) feita em TypeScript + Ink.
O OpenCode usa TypeScript + opentui (framework próprio em Zig).

Serve como referência de features a implementar — ver CHECKLIST.md para lista completa.

---

## Regras para a IA que está lendo isso

1. **Nunca** mencionar Tailwind, Supabase, Layout.tsx, localhost — não existem neste projeto
2. **Sempre** trabalhar dentro de `/cli/lib/` — ignorar `/src`, `/public`, `vite.config.ts`
3. **Nunca** criar arquivos na raiz — tudo vai em `/cli/lib/` ou `/cli/lib/ui/`
4. Quando for editar, sempre mostrar o arquivo completo corrigido
5. Quando tiver dúvida, perguntar antes de assumir
6. O projeto compila com `nodenext` — todos os imports precisam ter `.js` no final
7. Ink não suporta todos os recursos do React — evitar hooks complexos