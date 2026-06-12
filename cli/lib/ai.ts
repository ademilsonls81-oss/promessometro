import axios from 'axios';
import { getConfig, getApiKeyForProvider } from './config.js';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

function getProviderEndpoint(providerKey: string): string {
  switch (providerKey) {
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'alibaba':
    case 'dashscope':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    default:
      throw new Error(`Provider não suportado: ${providerKey}`);
  }
}

function mapModel(providerKey: string, modelId: string): string {
  const map: Record<string, string> = {
    'groq:llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
    'openai:gpt-4o': 'gpt-4o',
  };
  return map[`${providerKey}:${modelId}`] || modelId;
}

export async function callAI(messages: Message[], options?: { 
  model?: string; 
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
}): Promise<{ content: string; usage?: { input: number; output: number } }> {
  
  const config = getConfig();
  const providerKey = options?.provider || config.provider || 'groq';
  const modelId = options?.model || config.model || 'llama-3.3-70b-versatile';
  const apiKey = getApiKeyForProvider(providerKey) || process.env[`${providerKey.toUpperCase()}_API_KEY`];
  
  if (!apiKey && providerKey !== 'ollama') {
    throw new Error(`Chave API não encontrada para ${providerKey}. Use /connect ou defina ${providerKey.toUpperCase()}_API_KEY`);
  }
  
  const modelString = mapModel(providerKey, modelId);
  const endpoint = getProviderEndpoint(providerKey);
  
  const systemPrompt = options?.systemPrompt || '';
  const msgs = messages.map(msg => ({ role: msg.role, content: msg.content }));
  
  if (systemPrompt) {
    msgs.unshift({ role: 'system', content: systemPrompt } as any);
  }
  
  try {
    const response = await axios.post(
      endpoint,
      {
        model: modelString,
        messages: msgs,
        temperature: options?.temperature ?? 0,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    const content = response.data.choices?.[0]?.message?.content || '';
    const usage = response.data.usage ? {
      input: response.data.usage.prompt_tokens || 0,
      output: response.data.usage.completion_tokens || 0,
    } : undefined;
    
    return { content, usage };
  } catch (error) {  // any-ok
    throw new Error(`Erro na chamada AI (${providerKey}): ${error.message}`);
  }
}

export async function callAIWithMessages(
  messages: Message[],
  options?: {
    model?: string;
    provider?: string;
    systemPrompt?: string;
  }
): Promise<{ content: string; usage?: { input: number; output: number } }> {
  return callAI(messages, options);
}