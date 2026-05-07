import { callAIWithMessages } from './ai.js';
import { tools, parseToolCalls, buildSystemPrompt } from './tools.js';
import { getConfig, setConfig, setProvider, saveProviderKey, PROVIDERS } from './config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ChatState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentAgent: string;
  currentModel: string;
  currentProvider: string;
  isThinking: boolean;
  tokens: { input: number; output: number };
  hasRealMessages: boolean; // true only after actual AI interaction (not slash commands)
}

export class ChatEngine {
  private state: ChatState;
  private listeners: Array<(state: ChatState) => void> = [];
  private systemPrompt = '';

  constructor(initialAgent: string, initialModel: string) {
    const cfg = getConfig();
    this.state = {
      messages: [],
      currentAgent: initialAgent,
      currentModel: initialModel,
      currentProvider: cfg.provider || 'groq',
      isThinking: false,
      tokens: { input: 0, output: 0 },
      hasRealMessages: false,
    };
    this.updateSystemPrompt();
  }

  private updateSystemPrompt() {
    this.systemPrompt = buildSystemPrompt(process.cwd());
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.state, messages: [...this.state.messages] }));
  }

  private pushAssistantMessage(content: string) {
    this.state.messages.push({ role: 'assistant', content });
    this.notify();
  }

  private async handleSlashCommand(input: string) {
    const trimmed = input.trim();
    const [command = '', ...rest] = trimmed.slice(1).split(/\s+/).filter(Boolean);
    const args = rest.join(' ').trim();

    if (command !== 'clear' && command !== 'new' && command !== 'exit') {
      this.state.messages.push({ role: 'user', content: trimmed });
    }

    switch (command) {
      case '':
      case 'help':
        this.pushAssistantMessage(
          [
            'Available commands:',
            '/connect     — Connect to AI provider',
            '/models      — Switch AI model',
            '/agents      — Switch agent mode',
            '/new         — Start new session',
            '/clear       — Clear chat history',
            '/status      — Show connection status',
            '/export      — Export chat as markdown',
            '/exit        — Exit AIFeast',
          ].join('\n'),
        );
        return;

      case 'clear':
        this.clearHistory();
        return;

      case 'new':
        this.clearHistory();
        this.pushAssistantMessage('New session started.');
        return;

      case 'exit':
      case 'quit':
        process.exit(0);
        return;

      case 'status': {
        const cfg = getConfig();
        this.pushAssistantMessage(
          `Provider: ${cfg.provider || '(not configured)'}\nModel: ${cfg.model || '(not configured)'}\nAgent: ${this.state.currentAgent}`,
        );
        return;
      }

      case 'agent':
      case 'agents':
        if (!args) {
          this.pushAssistantMessage(`Current agent: ${this.state.currentAgent}`);
          return;
        }
        this.setAgent(args.toUpperCase());
        this.pushAssistantMessage(`Agent switched to ${args}.`);
        return;

      case 'model':
      case 'models': {
        if (!args) {
          const cfg = getConfig();
          const provider = PROVIDERS[cfg.provider] || PROVIDERS['groq'];
          const models = provider?.models?.length ? provider.models.join(', ') : '(any model)';
          this.pushAssistantMessage(
            `Current model: ${this.state.currentModel}\nSuggested models for ${cfg.provider || 'groq'}: ${models}`,
          );
          return;
        }
        setConfig('model', args);
        this.setModel(args);
        this.pushAssistantMessage(`Model switched to ${args}.`);
        return;
      }

      case 'connect': {
        const [providerName = '', ...keyParts] = rest;
        const providerKey = providerName.toLowerCase();
        if (!providerKey) {
          this.pushAssistantMessage(
            'Use the /connect command from the Command Palette (Ctrl+P) to select a provider interactively.',
          );
          return;
        }
        if (!PROVIDERS[providerKey]) {
          this.pushAssistantMessage(
            `Unknown provider: ${providerKey}. Available: ${Object.keys(PROVIDERS).join(', ')}`,
          );
          return;
        }
        setProvider(providerKey);
        const provider = PROVIDERS[providerKey];
        const model = provider.default || this.state.currentModel;
        if (providerKey === 'ollama') {
          setConfig('apiKey', 'ollama-local');
          setConfig('model', model);
          this.state.currentModel = model;
          this.state.currentProvider = providerKey;
          this.updateSystemPrompt();
          this.pushAssistantMessage(`Connected to Ollama (local). Model: ${model}`);
          return;
        }
        const apiKey = keyParts.join(' ').trim();
        if (apiKey) {
          saveProviderKey(providerKey, apiKey);
          setConfig('model', model);
          this.state.currentModel = model;
          this.state.currentProvider = providerKey;
          this.updateSystemPrompt();
          this.pushAssistantMessage(`Connected to ${provider.name}. Model: ${model}`);
        } else {
          this.pushAssistantMessage(
            `To connect ${provider.name}, use: /connect ${providerKey} YOUR_API_KEY`,
          );
        }
        return;
      }

      case 'export': {
        try {
          const exportDir = path.join(os.homedir(), '.aifeast');
          if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const exportPath = path.join(exportDir, `session-${timestamp}.md`);
          const lines: string[] = [`# AIFeast Session — ${new Date().toLocaleString()}`, ''];
          for (const msg of this.state.messages) {
            lines.push(`**${msg.role === 'user' ? 'You' : 'AI'}:**`);
            lines.push(msg.content);
            lines.push('');
          }
          fs.writeFileSync(exportPath, lines.join('\n'), 'utf-8');
          this.pushAssistantMessage(`Chat exported to: ${exportPath}`);
        } catch (err: any) {
          this.pushAssistantMessage(`Export failed: ${err.message}`);
        }
        return;
      }

      default:
        this.pushAssistantMessage(
          `Unknown command: /${command}\nUse /help to see available commands.`,
        );
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
    this.state.hasRealMessages = true; // mark as real conversation
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
            this.state.messages.push({ role: 'user', content: `Tool result (${call.tool}): ${result}` });
          }
        }
        this.notify();
      }
    } catch (error: any) {
      let msg = error.message || 'Unknown error';
      if (msg.includes('429')) {
        msg = 'Rate limit reached (429). Wait a moment and try again, or switch provider with /connect.';
      }
      this.state.messages.push({ role: 'assistant', content: `Error: ${msg}` });
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
    setConfig('model', model);
    this.notify();
  }

  setProvider(providerKey: string) {
    const cfg = getConfig();
    this.state.currentProvider = providerKey;
    if (PROVIDERS[providerKey]?.default && !cfg.model) {
      this.state.currentModel = PROVIDERS[providerKey].default;
    }
    this.notify();
  }

  clearHistory() {
    this.state.messages = [];
    this.state.tokens = { input: 0, output: 0 };
    this.state.hasRealMessages = false;
    this.notify();
  }

  getState() {
    return this.state;
  }
}
