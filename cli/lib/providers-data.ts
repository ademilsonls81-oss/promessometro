export interface ProviderInfo {
  id: string;
  name: string;
  envKey: string;
  defaultModel: string;
  models: string[];
  free: boolean;
}

export const PROVIDERS_DATA: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    free: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    free: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'],
    free: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    free: true,
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    envKey: 'XAI_API_KEY',
    defaultModel: 'grok-2',
    models: ['grok-2', 'grok-2-mini'],
    free: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder'],
    free: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    envKey: '',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'codellama', 'mistral'],
    free: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'google/gemini-2.5-flash',
    models: ['google/gemini-2.5-flash', 'anthropic/claude-3-5-sonnet', 'openai/gpt-4o'],
    free: false,
  },
  {
    id: 'together',
    name: 'Together AI',
    envKey: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    free: false,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    envKey: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    free: false,
  },
];
