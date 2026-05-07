import Conf from 'conf';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface CliConfig {
  provider: string;
  apiKey: string;
  model: string;
  apiUrl: string;
  plan: string;
  skillUsage: Record<string, number>;
  keys: Record<string, string>;
}

export interface ProviderConfig {
  name: string;
  models: string[];
  default: string;
  free: boolean;
  keyUrl: string;
  baseUrl: string;
}

const store = new Conf<CliConfig>({
  projectName: 'aifeast',
  defaults: {
    provider: '',
    apiKey: '',
    model: '',
    apiUrl: 'https://api.aifeastengine.com',
    plan: 'free',
    skillUsage: {},
    keys: {},
  },
});

export const PROVIDERS: Record<string, ProviderConfig> = {
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    default: 'gemini-1.5-flash',
    free: true,
    keyUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/v1',
  },
  google: {
    name: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    default: 'gemini-1.5-flash',
    free: true,
    keyUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/v1',
  },
  groq: {
    name: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    default: 'llama-3.3-70b-versatile',
    free: true,
    keyUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'deepseek/deepseek-r1'],
    default: 'google/gemini-2.5-flash',
    free: false,
    keyUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    default: 'claude-3-5-sonnet-20241022',
    free: false,
    keyUrl: 'https://console.anthropic.com/keys',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'],
    default: 'gpt-4o-mini',
    free: false,
    keyUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
  },
  alibaba: {
    name: 'Alibaba (Qwen)',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    default: 'qwen-plus',
    free: true,
    keyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  ollama: {
    name: 'Ollama (Local)',
    models: [],
    default: 'llama3.2',
    free: true,
    keyUrl: 'http://127.0.0.1:11434',
    baseUrl: 'http://127.0.0.1:11434/v1',
  },
};

export function loadDotEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) return;
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value[0] === '"' && value[value.length - 1] === '"') {
        value = value.replace(/\\n/gm, '\n').replace(/(^"|"$)/g, '');
      }
      if (!process.env[key]) process.env[key] = value;
    });
  } catch {}
}

export function getApiKeyForProvider(providerKey: string) {
  const envVarName = `${providerKey.toUpperCase()}_API_KEY`;
  if (process.env[envVarName]) return process.env[envVarName] as string;
  if (providerKey === 'google' && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (providerKey === 'google' && process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  if (providerKey === 'gemini' && process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  if (providerKey === 'gemini' && process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  const keys = store.get('keys') || {};
  if (keys[providerKey]) return keys[providerKey];
  const globalProvider = store.get('provider');
  const globalApiKey = store.get('apiKey');
  if (globalProvider === providerKey && globalApiKey) return globalApiKey;
  return '';
}

export function getConfig() {
  return store.store;
}

export function setConfig<K extends keyof CliConfig>(key: K, value: CliConfig[K]) {
  store.set(key, value);
}

export function saveProviderKey(providerKey: string, apiKey: string) {
  const keys = store.get('keys') || {};
  keys[providerKey] = apiKey;
  store.set('keys', keys);
  store.set('provider', providerKey);
  store.set('apiKey', apiKey);
  if (!store.get('model') && PROVIDERS[providerKey]?.default) {
    store.set('model', PROVIDERS[providerKey].default);
  }
}

export function isConfigured() {
  const providerKey = store.get('provider');
  const model = store.get('model');
  if (!providerKey || !model) return false;
  if (providerKey === 'ollama') return true;
  return !!getApiKeyForProvider(providerKey);
}

export function getSkillsDir() {
  return path.join(os.homedir(), '.aifeast', 'skills');
}

export function getProvider() {
  return PROVIDERS[store.get('provider')];
}

export function setProvider(name: string) {
  const provider = PROVIDERS[name];
  if (!provider) return;
  store.set('provider', name);
  if (provider.default) store.set('model', provider.default);
}
