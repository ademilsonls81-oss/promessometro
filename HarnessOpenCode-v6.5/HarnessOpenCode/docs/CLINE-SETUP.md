# Cline + LM Studio Setup (configs obrigatorias)

> Sem estas configs, o harness trava em algum momento. Documento curto e direto.

---

## Cline — Settings panel

### Feature Settings

| Setting | Valor | Por que |
|---------|-------|---------|
| **Yolo Mode** | ✅ ON | Sem isso, Cline pede aprovacao humana entre features e quebra autopilot |
| **Auto Compact** | ✅ ON | Previne deadlock por context overflow. NUNCA desligar. |
| **Double-Check Completion** | ✅ ON | Re-valida que a feature realmente terminou antes de marcar done |
| **Native Tool Call** | ✅ ON | Melhor que JSON-fingerprinting |
| **Parallel Tool Calling** | ✅ ON | Mais rapido em comandos independentes |
| **Strict Plan Mode** | ❌ OFF | Adiciona friccao no autopilot |
| **Focus Chain** | ✅ ON | Reminder interval 6 |

### Terminal Settings (CRITICO)

| Setting | Valor | Por que |
|---------|-------|---------|
| **Terminal Execution Mode** | **Background Exec** | Default ("VS Code Terminal") depende de shell integration que falha. Background = subprocess direto via Node, 100% confiavel. |
| **Shell integration timeout** | **30 segundos** | Default 4s e ridiculo. Zsh com plugins demora 5-10s pra carregar. |
| **Enable aggressive terminal reuse** | ❌ OFF | Causa state poluido entre comandos |
| **Terminal output limit** | 200-500 linhas | Limita dump no contexto |
| **Default Terminal Profile** | Default (do VSCode) | Ou bash direto se preferir |

### Advanced

| Setting | Valor |
|---------|-------|
| **Hooks** | ON (se quiser usar) |
| **MCP Display Mode** | Plain Text |

---

## LM Studio — Configuracao do modelo

### Modelo recomendado

- **Qwen 2.5 Coder 32B** Q5_K_M ou Q6_K (qualidade > Qwen 27B base)
- **DeepSeek Coder V2 33B** Q5_K_M (alternativa)
- **Qwen 3 32B** quando lancar

### Context window

| Configuracao | Valor |
|--------------|-------|
| Context Length | **128k a 140k tokens** (max possivel pro modelo + GPU) |
| GPU Offload | **Maximo possivel** (idealmente 100%) |
| KV Cache | Q8_0 (economiza VRAM, perda minima de qualidade) |
| Flash Attention | ✅ ON |

### Inference settings

| Setting | Valor |
|---------|-------|
| Temperature | 0.2 - 0.3 (codigo precisa de determinismo) |
| Top-K | 40 |
| Top-P | 0.9 |
| Repeat Penalty | 1.05 |
| Min P | 0.05 |

---

## VSCode — Configs uteis

### `.vscode/settings.json` (gere durante a Sprint 00)

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "css.lint.unknownAtRules": "ignore"
}
```

### Recomendado

- Extension **TypeScript Importer** (auto-import sugestoes)
- Extension **ESLint** + **Prettier** (formatacao consistente)
- **NAO instalar** extensoes de AI completion (Copilot, Codeium, etc) — conflito com Cline

---

## Validacao pos-config

Antes de rodar `/develop`, abra terminal do VSCode e verifique:

```bash
# 1. Shell integration loaded?
echo $TERM_PROGRAM  # deve retornar 'vscode'

# 2. Comandos basicos disponiveis?
which node npm git python3 grep curl
node --version    # >= 20
python3 --version # >= 3.11

# 3. LM Studio respondendo?
curl -s http://127.0.0.1:1234/v1/models | head -1
# deve retornar JSON com modelos carregados
```

Se algum check falhar, NAO comece. Resolva primeiro.

---

## Troubleshooting comum

### "Shell Integration Unavailable" no Cline

Voce esta em `VS Code Terminal` mode. Troque para `Background Exec` em Cline Settings → Terminal.

### Cline mostra "Running" mas LM Studio ja respondeu (deadlock)

Mesmo problema acima. Mata Cline (Cancel), troca pra Background Exec, reinicia.

### LM Studio trava (CPU 100%, sem progresso)

1. Verifique `nvidia-smi`: se GPU = 0% e RAM cheia, modelo nao foi pra GPU. Ajuste GPU Offload.
2. Se contexto > 90% da janela: reinicia LM Studio + reduz context window OU usa `/compact` no Cline.

### "RuntimeError: out of memory" na inicializacao

Modelo muito grande pra VRAM. Tente:
- Quantizacao menor (Q5_K_M → Q4_K_M)
- Context length menor (140k → 100k)
- KV cache Q4_0 em vez de Q8_0

### Travas longas (5min+) entre comandos

Provavelmente context > 85%. Sintomas:
- Respostas curtas/truncadas
- LLM "esquece" instrucoes recentes
- Repete comandos ja feitos

**Acao:** mata o turno, peca `/compact` ao Cline, retoma.
