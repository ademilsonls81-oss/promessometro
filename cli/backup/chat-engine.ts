import { callAIWithMessages } from './ai.js';
import { tools, parseToolCalls, buildSystemPrompt, SLASH_COMMANDS } from './tools.js';
import { getConfig, getApiKeyForProvider, setConfig, setProvider, saveProviderKey, PROVIDERS } from './config.js';

export interface ChatState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentAgent: string;
  currentModel: string;
  isThinking: boolean;
  tokens: { input: number; output: number };
}

export class ChatEngine {
  private state: ChatState;
  private listeners: Array<(state: ChatState) => void> = [];
  private systemPrompt = '';

  constructor(initialAgent: string, initialModel: string) {
    this.state = {
      messages: [],
      currentAgent: initialAgent,
      currentModel: initialModel,
      isThinking: false,
      tokens: { input: 0, output: 0 },
    };
    this.updateSystemPrompt();
  }

  private updateSystemPrompt() {
    this.systemPrompt = buildSystemPrompt(process.cwd());
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  private pushAssistantMessage(content: string) {
    this.state.messages.push({ role: 'assistant', content });
    this.notify();
  }

  private async handleSlashCommand(input: string) {
    const trimmed = input.trim();
    const [command = '', ...rest] = trimmed.slice(1).split(/\s+/).filter(Boolean);
    const args = rest.join(' ').trim();

    if (command !== 'clear') {
      this.state.messages.push({ role: 'user', content: trimmed });
    }

    switch (command) {
      case '':
      case 'help':
        this.pushAssistantMessage(['Comandos disponiveis:', ...SLASH_COMMANDS.map((item) => `${item.name} - ${item.description}`)].join('\n'));
        return;
      case 'clear':
        this.clearHistory();
        this.pushAssistantMessage('Historico limpo.');
        return;
      case 'status': {
        const cfg = getConfig();
        this.pushAssistantMessage(`Provider: ${cfg.provider || '(nao configurado)'}\nModelo: ${cfg.model || '(nao configurado)'}\nAgente: ${this.state.currentAgent}`);
        return;
      }
      case 'agent':
        if (!args) {
          this.pushAssistantMessage(`Agente atual: ${this.state.currentAgent}`);
          return;
        }
        this.setAgent(args);
        this.pushAssistantMessage(`Agente alterado para ${args}.`);
        return;
      case 'model': {
        if (!args) {
          const cfg = getConfig();
          const provider = PROVIDERS[cfg.provider] || PROVIDERS.groq;
          const models = provider.models?.length ? provider.models.join(', ') : '(modelo livre)';
          this.pushAssistantMessage(`Modelo atual: ${this.state.currentModel}\nModelos sugeridos para ${cfg.provider || 'groq'}: ${models}`);
          return;
        }
        setConfig('model', args);
        this.setModel(args);
        this.pushAssistantMessage(`Modelo alterado para ${args}.`);
        return;
      }
      case 'connect': {
        const [providerName = '', ...keyParts] = rest;
        const providerKey = providerName.toLowerCase();
        if (!providerKey) {
          this.pushAssistantMessage('Uso: /connect <provider> <apiKey>\nExemplos:\n/connect groq gsk_xxx\n/connect openrouter sk-or-xxx\n/connect google AIza...\n/connect ollama');
          return;
        }
        if (!PROVIDERS[providerKey]) {
          this.pushAssistantMessage(`Provider invalido: ${providerKey}. Opcoes: ${Object.keys(PROVIDERS).join(', ')}`);
          return;
        }
        setProvider(providerKey);
        const provider = PROVIDERS[providerKey];
        const model = provider.default || this.state.currentModel;
        if (providerKey === 'ollama') {
          setConfig('apiKey', 'ollama-local');
          setConfig('model', model);
          this.state.currentModel = model;
          this.updateSystemPrompt();
          this.pushAssistantMessage(`Conectado ao Ollama local. Modelo atual: ${model}.`);
          return;
        }
        const apiKey = keyParts.join(' ').trim() || getApiKeyForProvider(providerKey);
        if (!apiKey) {
          this.pushAssistantMessage(`Falta a chave API. Uso: /connect ${providerKey} SUA_CHAVE`);
          return;
        }
        saveProviderKey(providerKey, apiKey);
        setConfig('model', model);
        this.state.currentModel = model;
        this.updateSystemPrompt();
        this.pushAssistantMessage(`Conectado em ${provider.name}. Modelo atual: ${model}.`);
        return;
      }
      default:
        this.pushAssistantMessage(`Comando desconhecido: /${command}\nUse /help para ver os comandos.`);
    }
  }

  subscribe(listener: (state: ChatState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  async sendMessage(content: string) {
    if (this.state.isThinking) return;
    if (content.trim().startsWith('/')) {
      await this.handleSlashCommand(content);
      return;
    }

    this.state.messages.push({ role: 'user', content });
    this.state.isThinking = true;
    this.notify();

    try {
      let loop = true;
      while (loop) {
        const response = await callAIWithMessages(this.state.messages, { systemPrompt: this.systemPrompt });
        this.state.tokens.input += response.usage?.input || 0;
        this.state.tokens.output += response.usage?.output || 0;
        this.state.messages.push({ role: 'assistant', content: response.content });
        const toolCalls = parseToolCalls(response.content);
        if (toolCalls.length === 0) {
          loop = false;
        } else {
          for (const call of toolCalls) {
            const tool = tools.find((item) => item.name === call.tool);
            if (!tool) continue;
            const result = await tool.execute(call.args as any, process.cwd());
            this.state.messages.push({ role: 'user', content: `Resultado de ${call.tool}: ${result}` });
          }
        }
        this.notify();
      }
    } catch (error) {  // any-ok
      this.state.messages.push({ role: 'assistant', content: `Erro: ${error.message}` });
    } finally {
      this.state.isThinking = false;
      this.notify();
    }
  }

  setAgent(name: string) {
    this.state.currentAgent = name;
    this.state.messages = [];
    this.notify();
  }

  setModel(model: string) {
    this.state.currentModel = model;
    this.notify();
  }

  clearHistory() {
    this.state.messages = [];
    this.state.tokens = { input: 0, output: 0 };
    this.notify();
  }

  getState() {
    return this.state;
  }
}
