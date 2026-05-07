export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  free: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelInfo[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', free: false },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'Groq', free: false },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'Groq', free: false },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'Groq', free: false },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', free: false },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', free: false },
    { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', free: false },
    { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI', free: false },
    { id: 'o1', name: 'o1', provider: 'OpenAI', free: false },
    { id: 'o1-mini', name: 'o1-mini', provider: 'OpenAI', free: false },
  ],
  google: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', free: false },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', free: false },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', free: false },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', free: false },
  ],
  alibaba: [
    { id: 'qwen-plus', name: 'Qwen Plus', provider: 'Alibaba', free: false },
    { id: 'qwen-turbo', name: 'Qwen Turbo', provider: 'Alibaba', free: false },
    { id: 'qwen-max', name: 'Qwen Max', provider: 'Alibaba', free: false },
    { id: 'qvq-max', name: 'QVQ Max', provider: 'Alibaba', free: false },
    { id: 'qwq-32b', name: 'QwQ 32B', provider: 'Alibaba', free: false },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2', provider: 'Ollama', free: true },
    { id: 'llama3.2:70b', name: 'Llama 3.2 70B', provider: 'Ollama', free: true },
    { id: 'llama3.2:8b', name: 'Llama 3.2 8B', provider: 'Ollama', free: true },
    { id: 'llama3.1', name: 'Llama 3.1', provider: 'Ollama', free: true },
    { id: 'llama3:70b', name: 'Llama 3 70B', provider: 'Ollama', free: true },
    { id: 'mistral', name: 'Mistral', provider: 'Ollama', free: true },
    { id: 'codellama', name: 'CodeLlama', provider: 'Ollama', free: true },
    { id: 'phi3', name: 'Phi 3', provider: 'Ollama', free: true },
    { id: 'phi4', name: 'Phi 4', provider: 'Ollama', free: true },
    { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'Ollama', free: true },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'Ollama', free: true },
    { id: 'gemma3', name: 'Gemma 3', provider: 'Ollama', free: true },
    { id: 'qwen2.5', name: 'Qwen 2.5', provider: 'Ollama', free: true },
    { id: 'qwen3', name: 'Qwen 3', provider: 'Ollama', free: true },
    { id: 'llama3.2-vision', name: 'Llama 3.2 Vision', provider: 'Ollama', free: true },
    { id: 'minimax-m2.1', name: 'MiniMax M2.1', provider: 'Ollama', free: true },
  ],
  nvidia: [
    { id: 'nemotron-3-super-8b', name: 'Nemotron 3 Super 8B', provider: 'NVIDIA', free: true },
    { id: 'nemotron-3-super-34b', name: 'Nemotron 3 Super 34B', provider: 'NVIDIA', free: true },
    { id: 'nemotron-3-super-48b', name: 'Nemotron 3 Super 48B', provider: 'NVIDIA', free: true },
    { id: 'nemotron-4-mini', name: 'Nemotron 4 Mini', provider: 'NVIDIA', free: true },
  ],
  anthropic: [
    { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'Anthropic', free: false },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', free: false },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', free: false },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', free: false },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', free: false },
  ],
  openrouter: [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'OpenRouter', free: false },
    { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'OpenRouter', free: false },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'OpenRouter', free: false },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'OpenRouter', free: false },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek', free: false },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', free: false },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek', free: false },
  ],
  opencode: [
    { id: 'big-pickle', name: 'Big Pickle', provider: 'OpenCode Zen', free: false },
    { id: 'small-pickle', name: 'Small Pickle', provider: 'OpenCode Zen', free: false },
    { id: 'ask', name: 'Ask', provider: 'OpenCode Zen', free: false },
    { id: 'build', name: 'Build', provider: 'OpenCode Zen', free: false },
    { id: 'ling-2.6', name: 'Ling 2.6', provider: 'OpenCode Zen', free: false },
  ],
};

export function getAllModels(): ModelInfo[] {
  return Object.values(MODEL_REGISTRY).flat();
}